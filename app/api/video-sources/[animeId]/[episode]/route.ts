/**
 * Video Sources API Route
 * Uses robust multi-strategy video source fetching
 */

import { NextRequest, NextResponse } from "next/server";
import { getEpisodeSources } from "@/lib/video-sources-robust";

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
  const allowDemoPreview = searchParams.get("preview") === "1";

  try {
    const result = await getEpisodeSources(
      animeIdNum,
      episodeNumber,
      { title, malId, language },
      { allowDemoFallback: allowDemoPreview }
    );

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      availableLanguages: [
        { type: "sub", available: true },
        { type: "dub", available: false },
      ],
      hasSubtitles: (result.subtitles?.length || 0) > 0,
      previewMode: Boolean(result.isDemo),
      responseTime: elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    const message = error instanceof Error ? error.message : "Failed to fetch video sources";
    const isTimeout = error instanceof Error && message.toLowerCase().includes("timeout");

    return NextResponse.json(
      {
        error: isTimeout ? "SOURCE_TIMEOUT" : "SCRAPER_ERROR",
        message,
        sources: [],
        previewAvailable: true,
        responseTime: elapsed,
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}

function getAllowedVideoOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (
        originHost === 'localhost' ||
        originHost === '127.0.0.1' ||
        originHost.endsWith('.animeverse.app') ||
        (appUrl && new URL(appUrl).hostname === originHost)
      ) {
        return origin;
      }
    } catch (error) {
      // Fix M9: Log CORS validation errors instead of silently swallowing
      console.warn('CORS origin validation failed:', error);
    }
  }
  const host = request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": getAllowedVideoOrigin(request),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
