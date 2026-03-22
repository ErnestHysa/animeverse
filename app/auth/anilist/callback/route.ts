/**
 * AniList OAuth Callback Handler
 *
 * Uses Authorization Code Grant flow with client_secret:
 * - Server-side token exchange with client_secret
 * - More secure than Implicit Grant
 * - Full OAuth 2.0 compliance
 *
 * Flow:
 * 1. User clicks login -> redirected to AniList authorize page
 * 2. User approves -> redirected back with authorization code
 * 3. Server exchanges code for access token (with client_secret)
 * 4. Token stored securely and user data fetched
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
 * 2. Exchanges it for an access token (using client_secret)
 * 3. Fetches user info from AniList
 * 4. Redirects to settings with success
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const { origin } = new URL(request.url);

    if (!code) {
      // No code provided - redirect with error
      const redirectUrl = new URL("/settings", origin);
      redirectUrl.searchParams.set("auth", "error");
      redirectUrl.searchParams.set("message", "no_code");
      return NextResponse.redirect(redirectUrl);
    }

    const clientId = process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID;
    const clientSecret = process.env.ANILIST_CLIENT_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/anilist/callback`
      : `${origin}/auth/anilist/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("AniList credentials not configured");
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
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);

      // Parse error for better debugging
      let errorMessage = "token_exchange_failed";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
        console.error("AniList OAuth Error:", errorJson);
      } catch {
        // Not JSON, use raw text
        if (errorText.includes("redirect_uri")) {
          errorMessage = "redirect_uri_mismatch";
        }
      }

      const redirectUrl = new URL("/settings", origin);
      redirectUrl.searchParams.set("auth", "error");
      redirectUrl.searchParams.set("message", errorMessage);
      redirectUrl.searchParams.set("debug", redirectUri); // Include expected redirect URI
      return NextResponse.redirect(redirectUrl);
    }

    const tokenData = await tokenResponse.json();

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
    // Pass token and user data via URL hash (for client-side access)
    const redirectUrl = new URL("/settings", origin);
    redirectUrl.searchParams.set("auth", "success");

    const hashData = {
      token: tokenData.access_token,
      expires_at: Date.now() + (tokenData.expires_in || 31536000) * 1000,
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
      maxAge: tokenData.expires_in || 31536000,
      path: "/",
    });

    if (userData) {
      response.cookies.set("anilist_user", JSON.stringify(userData), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokenData.expires_in || 31536000,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);

    const { origin } = new URL(request.url);
    const redirectUrl = new URL("/settings", origin);
    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set("message", "unknown_error");

    return NextResponse.redirect(redirectUrl);
  }
}
