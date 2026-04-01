/**
 * MAL OAuth Initiation Route
 * GET /auth/mal — Generates PKCE verifier, stores in cookie, redirects to MAL.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate a random code verifier using Node's crypto */
function generateVerifier(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** SHA-256 → BASE64URL */
async function sha256Challenge(verifier: string): Promise<string> {
  const { createHash } = require("crypto") as typeof import("crypto");
  const hash = createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
  if (!clientId) {
    const { origin } = new URL(request.url);
    const url = new URL("/settings", origin);
    url.searchParams.set("mal_auth", "error");
    url.searchParams.set("message", "mal_not_configured");
    return NextResponse.redirect(url);
  }

  const { origin } = new URL(request.url);
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/mal/callback`
    : `${origin}/auth/mal/callback`;

  const verifier = generateVerifier();
  const challenge = await sha256Challenge(verifier);

  const authUrl = new URL("https://myanimelist.net/v1/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", "mal_auth");

  const response = NextResponse.redirect(authUrl.toString());

  // Store verifier in httpOnly cookie for the callback route
  response.cookies.set("mal_code_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
