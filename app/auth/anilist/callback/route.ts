/**
 * AniList OAuth Callback Handler
 *
 * Uses Authorization Code Grant flow with client_secret:
 * - Server-side token exchange with client_secret
 * - More secure than Implicit Grant
 * - Full OAuth 2.0 compliance
 *
 * Fix H8: CSRF state parameter validation (mirrors MAL PKCE/cookie pattern)
 * Fix L5: Token no longer exposed in URL hash — only stored in httpOnly cookies
 *
 * Flow:
 * 1. User clicks login -> redirected to /auth/anilist (sets state cookie)
 * 2. /auth/anilist redirects to AniList authorize page with state param
 * 3. User approves -> redirected back with authorization code + state
 * 4. Server validates state, exchanges code for access token (with client_secret)
 * 5. Token stored securely in httpOnly cookies, user data fetched
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth Callback Handler
 * GET /auth/anilist/callback?code={authorization_code}&state={csrf_state}
 *
 * This route:
 * 1. Validates the CSRF state parameter against the cookie
 * 2. Receives the authorization code from AniList
 * 3. Exchanges it for an access token (using client_secret)
 * 4. Fetches user info from AniList
 * 5. Redirects to settings with token in httpOnly cookies only (not URL hash)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const { origin } = new URL(request.url);

    // Fix H8: Validate CSRF state parameter
    const storedState = request.cookies.get("anilist_oauth_state")?.value;

    if (!code) {
      const redirectUrl = new URL("/settings", origin);
      redirectUrl.searchParams.set("auth", "error");
      redirectUrl.searchParams.set("message", "no_code");
      return NextResponse.redirect(redirectUrl);
    }

    if (!state || !storedState || state !== storedState) {
      // State mismatch — possible CSRF attack
      console.error("[AniList OAuth] State validation failed:", {
        hasState: !!state,
        hasStoredState: !!storedState,
        match: state === storedState,
      });
      const redirectUrl = new URL("/settings", origin);
      redirectUrl.searchParams.set("auth", "error");
      redirectUrl.searchParams.set("message", "invalid_state");
      const clearResponse = NextResponse.redirect(redirectUrl);
      // Clear state cookie on failure
      clearResponse.cookies.set("anilist_oauth_state", "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return clearResponse;
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
      const errResponse = NextResponse.redirect(redirectUrl);
      // Clear state cookie
      errResponse.cookies.set("anilist_oauth_state", "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return errResponse;
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

    // Fix L5: Token is NO LONGER placed in the URL hash.
    // Only stored in httpOnly cookies to prevent Referer header leakage.
    // The client settings page reads auth status via the cookie (or can call
    // an API endpoint to retrieve user data).
    const redirectUrl = new URL("/settings", origin);
    redirectUrl.searchParams.set("auth", "success");

    const response = NextResponse.redirect(redirectUrl);

    // Clear the state cookie (one-time use)
    response.cookies.set("anilist_oauth_state", "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    // Store token in httpOnly cookie (primary secure storage)
    response.cookies.set("anilist_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in || 31536000,
      path: "/",
    });

    if (userData) {
      response.cookies.set("anilist_user", JSON.stringify(userData), {
        httpOnly: false, // Client needs to read user display data
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
