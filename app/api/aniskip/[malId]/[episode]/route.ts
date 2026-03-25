/**
 * AniSkip API Proxy
 * Proxies requests to api.aniskip.com server-side to avoid CORS restrictions.
 * AniSkip provides crowd-sourced intro/outro timestamps for anime episodes.
 */

import { NextRequest, NextResponse } from "next/server";

const ANISKIP_BASE = "https://api.aniskip.com/v2";
const TIMEOUT_MS = 8000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ malId: string; episode: string }> }
) {
  const { malId, episode } = await params;

  // Validate params
  const malIdNum = parseInt(malId, 10);
  const episodeNum = parseInt(episode, 10);
  if (isNaN(malIdNum) || isNaN(episodeNum) || malIdNum <= 0 || episodeNum <= 0) {
    return NextResponse.json({ found: false, results: [], message: "Invalid parameters" }, { status: 400 });
  }

  // Forward query params (types, episodeLength)
  const searchParams = request.nextUrl.searchParams;
  const upstreamUrl = `${ANISKIP_BASE}/skip-times/${malIdNum}/${episodeNum}?${searchParams.toString()}`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const resp = await fetch(upstreamUrl, {
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 86400 }, // Cache for 24 hours (skip times don't change)
    });

    clearTimeout(tid);

    // 400/404 = episode not in AniSkip DB — not an error, just no data
    if (resp.status === 400 || resp.status === 404) {
      return NextResponse.json({ found: false, results: [], message: null }, { status: 200 });
    }

    if (!resp.ok) {
      return NextResponse.json({ found: false, results: [], message: null }, { status: 200 });
    }

    const data = await resp.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    // Network error or timeout — return empty result gracefully
    return NextResponse.json({ found: false, results: [], message: null }, { status: 200 });
  }
}
