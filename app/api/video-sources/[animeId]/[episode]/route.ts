/**
 * Video Sources API Route
 * Uses robust multi-strategy video source fetching
 */

import { NextRequest, NextResponse } from "next/server";
import { getEpisodeSources, getDemoSources } from "@/lib/video-sources-robust";

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

  // Validate inputs
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
  const language = searchParams.get("language") === "dub" ? "dub" : "sub";

  try {
    // Set overall timeout for the request
    const controller = new AbortController();
    const SERVER_TIMEOUT = 15000; // 15 seconds server timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SERVER_TIMEOUT);

    // Fetch video sources using robust implementation
    const result = await Promise.race([
      getEpisodeSources(animeIdNum, episodeNumber, { title, malId, language }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Server timeout')), SERVER_TIMEOUT)
      ),
    ]);

    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      availableLanguages: [
        { type: "sub", available: true },
        { type: "dub", available: false },
      ],
      hasSubtitles: (result.subtitles?.length || 0) > 0,
      responseTime: elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // Check if timeout
    const isTimeout = error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('aborted')
    );

    if (isTimeout) {
      // Return demo video on timeout
      const demoResult = getDemoSources(animeIdNum, episodeNumber, title);
      return NextResponse.json({
        ...demoResult,
        availableLanguages: [
          { type: "sub", available: true },
          { type: "dub", available: false },
        ],
        hasSubtitles: false,
        isTimeout: true,
        responseTime: elapsed,
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
