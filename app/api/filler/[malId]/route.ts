/**
 * Filler Detection API Proxy
 * Server-side proxy for animefillerlist.com to avoid browser CORS issues.
 * Caching is handled client-side in filler-detection.ts.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ malId: string }> }
) {
  const { malId } = await params;

  const id = parseInt(malId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid MAL ID" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://api.animefillerlist.com/v1/anime/${id}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Service returned an error — return empty filler data gracefully
      return NextResponse.json(
        { episodes: [], fillerCount: 0, available: false },
        {
          status: 200,
          headers: { "Cache-Control": "public, max-age=3600" },
        }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    // Service unavailable (timeout, network error, etc.) — return empty data gracefully
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.warn(
      `Filler API unavailable for MAL ID ${malId}:`,
      isTimeout ? "timeout" : (error instanceof Error ? error.message : error)
    );
    return NextResponse.json(
      { episodes: [], fillerCount: 0, available: false },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=3600" },
      }
    );
  }
}
