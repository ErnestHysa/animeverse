/**
 * Video Sources API Route
 * Uses stealth scraper with anti-bot bypass
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    animeId: string;
    episode: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: PageProps
) {
  const startTime = Date.now();
  const { animeId, episode } = await params;
  const episodeNumber = parseInt(episode, 10);
  const animeIdNum = parseInt(animeId, 10);

  if (isNaN(animeIdNum) || isNaN(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json(
      { error: "Invalid animeId or episode number" },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get("title") || `Anime ${animeId}`;
  const malId = searchParams.get("malId")
    ? parseInt(searchParams.get("malId")!, 10)
    : animeIdNum;

  console.log(`[VideoSources] START: ${title} (ID: ${animeIdNum}) - Episode ${episodeNumber}`);

  try {
    // Add server-side timeout to prevent hanging requests
    const controller = new AbortController();
    const SERVER_TIMEOUT = 32000; // 32 seconds server timeout
    const timeoutId = setTimeout(() => {
      console.warn(`[VideoSources] TIMEOUT after ${SERVER_TIMEOUT}ms`);
      controller.abort();
    }, SERVER_TIMEOUT);

    // Use API-based sources (more reliable than scraping)
    const { getEpisodeSources } = await import("@/lib/video-sources-api");

    const result = await getEpisodeSources(animeIdNum, episodeNumber, {
      title,
      malId,
      language: "sub",
    });

    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;
    console.log(`[VideoSources] DONE in ${elapsed}ms: Provider=${result.provider}, IsFallback=${result.isFallback ? 'yes' : 'no'}`);

    return NextResponse.json({
      ...result,
      availableLanguages: [
        { type: "sub", available: true },
        { type: "dub", available: false },
      ],
      hasSubtitles: (result.subtitles?.length || 0) > 0,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[VideoSources] ERROR after ${elapsed}ms:`, error);

    // Check if error is due to timeout
    const isTimeout = error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('aborted')
    );

    if (isTimeout) {
      console.warn('[VideoSources] Request timeout - returning demo video');
      // Return demo video on timeout instead of error
      const { getDemoSources } = await import("@/lib/video-sources-api");
      const demoResult = getDemoSources(animeIdNum, episodeNumber);
      return NextResponse.json({
        ...demoResult,
        availableLanguages: [
          { type: "sub", available: true },
          { type: "dub", available: false },
        ],
        hasSubtitles: false,
      });
    }

    return NextResponse.json(
      {
        error: "SCRAPER_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch video sources",
        sources: [],
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
