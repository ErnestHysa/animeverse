/**
 * AniList OAuth Initiation Route
 * GET /auth/anilist — Generates CSRF state parameter, stores in cookie, redirects to AniList.
 *
 * Fix H8: CSRF protection via state parameter (mirrors MAL PKCE pattern)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate a random state parameter using Node's crypto */
function generateState(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const { origin } = new URL(request.url);
    const url = new URL("/settings", origin);
    url.searchParams.set("auth", "error");
    url.searchParams.set("message", "anilist_not_configured");
    return NextResponse.redirect(url);
  }

  const { origin } = new URL(request.url);
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/anilist/callback`
    : `${origin}/auth/anilist/callback`;

  const state = generateState();

  const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());

  // Store state in httpOnly cookie for the callback route to validate
  response.cookies.set("anilist_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
