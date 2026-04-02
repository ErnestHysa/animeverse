/**
 * MAL OAuth Callback Handler
 * GET /auth/mal/callback?code=XXX
 *
 * Exchanges the authorization code for a token using PKCE verifier stored in cookie.
 * Redirects back to /settings with token and user data in URL hash.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  const settingsUrl = new URL("/settings", origin);

  if (errorParam || !code) {
    settingsUrl.searchParams.set("mal_auth", "error");
    settingsUrl.searchParams.set("message", errorParam || "no_code");
    return NextResponse.redirect(settingsUrl);
  }

  const verifier = request.cookies.get("mal_code_verifier")?.value;
  if (!verifier) {
    settingsUrl.searchParams.set("mal_auth", "error");
    settingsUrl.searchParams.set("message", "verifier_missing");
    return NextResponse.redirect(settingsUrl);
  }

  const clientId = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
  if (!clientId) {
    settingsUrl.searchParams.set("mal_auth", "error");
    settingsUrl.searchParams.set("message", "mal_not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/mal/callback`
    : `${origin}/auth/mal/callback`;

  try {
    // Exchange code for token
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    // If a client_secret is configured, include it
    const clientSecret = process.env.MAL_CLIENT_SECRET;
    if (clientSecret) {
      tokenBody.set("client_secret", clientSecret);
    }

    const tokenResponse = await fetch("https://myanimelist.net/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      console.error("MAL token exchange failed:", text);
      settingsUrl.searchParams.set("mal_auth", "error");
      settingsUrl.searchParams.set("message", "token_exchange_failed");
      return NextResponse.redirect(settingsUrl);
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile
    let userData = null;
    try {
      const userResponse = await fetch(
        "https://api.myanimelist.net/v2/users/@me?fields=id,name,picture,joined_at",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );
      if (userResponse.ok) {
        userData = await userResponse.json();
      }
    } catch (err) {
      console.error("MAL user fetch error:", err);
    }

    // Redirect with token in hash (client-side reads it)
    settingsUrl.searchParams.set("mal_auth", "success");
    const hashData = {
      token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in ?? 2592000) * 1000,
      user: userData,
    };
    settingsUrl.hash = encodeURIComponent(JSON.stringify(hashData));

    const response = NextResponse.redirect(settingsUrl);

    // Clear the verifier cookie
    response.cookies.set("mal_code_verifier", "", { maxAge: 0, path: "/" });

    // Store token in httpOnly cookie as well
    response.cookies.set("mal_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in ?? 2592000,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("MAL OAuth callback error:", err);
    settingsUrl.searchParams.set("mal_auth", "error");
    settingsUrl.searchParams.set("message", "unknown_error");
    return NextResponse.redirect(settingsUrl);
  }
}
