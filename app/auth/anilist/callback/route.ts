/**
 * AniList OAuth Callback Handler
 * Handles the OAuth callback from AniList after user authorization
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * OAuth Callback Handler
 * GET /auth/anilist/callback?code={authorization_code}
 *
 * This route:
 * 1. Receives the authorization code from AniList
 * 2. Exchanges it for an access token
 * 3. Stores the token securely
 * 4. Redirects the user back to the app with the token
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");

    if (!code) {
      // No code provided - redirect with error
      const redirectUrl = new URL("/settings", request.url);
      redirectUrl.searchParams.set("auth", "error");
      redirectUrl.searchParams.set("message", "no_code");
      return NextResponse.redirect(redirectUrl);
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID || "16500",
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/auth/anilist/callback`,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);

      const redirectUrl = new URL("/settings", request.url);
      redirectUrl.searchParams.set("auth", "error");
      redirectUrl.searchParams.set("message", "token_exchange_failed");
      return NextResponse.redirect(redirectUrl);
    }

    const tokenData = await tokenResponse.json();

    // Add expiration timestamp (1 hour from now)
    tokenData.expires_at = Date.now() + tokenData.expires_in * 1000;

    // Fetch user info
    let userData = null;
    try {
      const userResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `
            query {
              Viewer {
                id
                name
                avatar { large medium }
                options { displayAdultContent }
                mediaListOptions { scoreFormat rowOrder }
              }
            }
          `,
        }),
      });

      if (userResponse.ok) {
        const userResult = await userResponse.json();
        userData = userResult.data?.Viewer;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }

    // Redirect back to settings with success
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("auth", "success");

    // Create response with token and user data in URL hash (for client-side access)
    const hashData = {
      token: tokenData.access_token,
      expires_at: tokenData.expires_at,
      user: userData,
    };

    // Use hash fragment to pass data to client (more secure than query params)
    redirectUrl.hash = encodeURIComponent(JSON.stringify(hashData));

    const response = NextResponse.redirect(redirectUrl);

    // Set HTTP-only cookie as additional storage
    response.cookies.set("anilist_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in,
      path: "/",
    });

    if (userData) {
      response.cookies.set("anilist_user", JSON.stringify(userData), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokenData.expires_in,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);

    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set("message", "unknown_error");

    return NextResponse.redirect(redirectUrl);
  }
}
