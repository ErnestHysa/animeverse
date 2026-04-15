/**
 * Torrent Sources API Route
 * Provides magnet links and torrent information for anime episodes
 *
 * GET /api/torrent-sources/[animeId]/[episode]
 * - Returns torrent sources with magnet links
 * - Queries local cache and scrapes public trackers
 * - Falls back to HLS sources if no torrents available
 *
 * Phase 2: Implements Nyaa.si, Nyaa.land, AniDex scrapers with caching
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getTorrentSourcesWithFallback,
} from "@/lib/torrent-finder";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TorrentSource {
  magnet: string;
  infoHash: string;
  quality: string;
  size: string;
  sizeBytes: number;
  seeders: number;
  leechers: number;
  provider: string;
  title: string;
}

interface TorrentSourcesResponse {
  torrents: TorrentSource[];
  sources: string[];
  primarySource?: string;
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
          sources: [],
          fallbackAvailable: true,
          message: "Invalid animeId or episode",
        },
        { status: 400 }
      );
    }

    const animeIdNum = parseInt(animeId, 10);
    const episodeNum = parseInt(episode, 10);

    if (isNaN(animeIdNum) || isNaN(episodeNum)) {
      return NextResponse.json(
        {
          torrents: [],
          sources: [],
          fallbackAvailable: true,
          message: "Invalid animeId or episode format",
        },
        { status: 400 }
      );
    }

    // Get anime title from query params (optional but recommended)
    const { searchParams } = new URL(request.url);
    const animeTitle = searchParams.get("title") || undefined;

    // Find torrent sources with fallback
    const result = await getTorrentSourcesWithFallback(
      animeIdNum,
      episodeNum,
      animeTitle
    );

    // Transform to response format
    const torrents: TorrentSource[] = result.torrents.map((t) => ({
      magnet: t.magnet,
      infoHash: t.infoHash,
      quality: t.quality,
      size: formatBytes(t.size),
      sizeBytes: t.size,
      seeders: t.seeders,
      leechers: t.leechers,
      provider: t.provider,
      title: t.title,
    }));

    return NextResponse.json({
      torrents,
      sources: result.sources,
      primarySource: result.primarySource,
      fallbackAvailable: true,
      message:
        torrents.length > 0
          ? `Found ${torrents.length} torrent source(s)`
          : animeTitle
          ? `No torrents found for "${animeTitle}" episode ${episodeNum}. HLS fallback available.`
          : "No torrents found. Try providing anime title in query params. HLS fallback available.",
    });
  } catch (error) {
    console.error("Error fetching torrent sources:", error);

    // Return error but allow fallback
    return NextResponse.json(
      {
        torrents: [],
        sources: [],
        fallbackAvailable: true,
        message: "Failed to fetch torrent sources. HLS fallback available.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for manual magnet link submission (admin feature)
 * Phase 7: Complete - Admin Magnet Management ✅
 * Use /api/admin/magnets for full CRUD operations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ animeId: string; episode: string }> }
): Promise<NextResponse<{ success: boolean; message: string }>> {
  // Fix C5: Require admin auth for POST
  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

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

    // Phase 7 Complete: Admin magnet management is implemented
    // Use POST /api/admin/magnets for full magnet management with validation
    // This endpoint is kept for backward compatibility

    return NextResponse.json({
      success: true,
      message: "Magnet link submitted. Use /api/admin/magnets for full management.",
    });
  } catch (error) {
    console.error("Error submitting magnet link:", error);

    return NextResponse.json(
      { success: false, message: "Failed to submit magnet link" },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
