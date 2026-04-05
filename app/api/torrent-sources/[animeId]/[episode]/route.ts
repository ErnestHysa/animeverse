/**
 * Torrent Sources API Route
 * Provides magnet links and torrent information for anime episodes
 *
 * GET /api/torrent-sources/[animeId]/[episode]
 * - Returns torrent sources with magnet links
 * - Queries local database and public trackers
 * - Falls back to HLS sources if no torrents available
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TorrentSource {
  magnet: string;
  infoHash: string;
  quality: string;
  size: string;
  seeders: number;
  leechers: number;
  provider: string;
  title: string;
}

interface TorrentSourcesResponse {
  torrents: TorrentSource[];
  fallbackAvailable: boolean;
  message?: string;
}

/**
 * GET handler for torrent sources
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ animeId: string; episode: string }> }
): Promise<NextResponse<TorrentSourcesResponse>> {
  const { animeId, episode } = await params;

  try {
    // Validate inputs
    if (!animeId || !episode) {
      return NextResponse.json(
        {
          torrents: [],
          fallbackAvailable: true,
          message: "Invalid animeId or episode",
        },
        { status: 400 }
      );
    }

    // TODO: Phase 2 - Query local database for cached magnet links
    // const cachedTorrents = await queryTorrentDatabase(animeId, episode);

    // TODO: Phase 2 - Scrape Nyaa.si for torrent sources
    // const nyaaTorrents = await scrapeNyaa(animeId, episode);

    // TODO: Phase 2 - Validate magnet links via DHT
    // const validatedTorrents = await validateMagnets(nyaaTorrents);

    // For now, return empty response with fallback flag
    // This allows the frontend to fall back to HLS streaming
    return NextResponse.json({
      torrents: [],
      fallbackAvailable: true,
      message: "Torrent sources coming soon in Phase 2. HLS fallback available.",
    });
  } catch (error) {
    console.error("Error fetching torrent sources:", error);

    // Return error but allow fallback
    return NextResponse.json(
      {
        torrents: [],
        fallbackAvailable: true,
        message: "Failed to fetch torrent sources. HLS fallback available.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for manual magnet link submission (admin feature)
 * TODO: Phase 7 - Implement admin magnet management
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ animeId: string; episode: string }> }
): Promise<NextResponse<{ success: boolean; message: string }>> {
  const { animeId, episode } = await params;

  try {
    const body = await request.json();
    const { magnet, quality } = body;

    if (!magnet) {
      return NextResponse.json(
        { success: false, message: "Magnet link is required" },
        { status: 400 }
      );
    }

    // TODO: Phase 7 - Validate and store magnet link in database
    // await storeMagnetLink(animeId, episode, { magnet, quality, submittedAt: Date.now() });

    return NextResponse.json({
      success: true,
      message: "Magnet link submitted successfully. Coming in Phase 7.",
    });
  } catch (error) {
    console.error("Error submitting magnet link:", error);

    return NextResponse.json(
      { success: false, message: "Failed to submit magnet link" },
      { status: 500 }
    );
  }
}
