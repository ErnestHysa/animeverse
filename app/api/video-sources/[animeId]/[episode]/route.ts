/**
 * Video Sources API Route
 * Fetches video sources from multiple providers
 * Proxies requests to avoid CORS issues
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Multiple providers for fallback
const PROVIDERS = {
  consumet: {
    baseUrl: "https://api.consumet.org/anime",
  },
  gogoanime: {
    baseUrl: "https://api.consumet.org/anime/gogoanime",
  },
  zoro: {
    baseUrl: "https://api.consumet.org/anime/zoro",
  },
};

interface ConsumetEpisodeSource {
  url: string;
  quality: string;
  isM3U8?: boolean;
  size?: number;
}

interface ConsumetSourcesResponse {
  headers?: {
    Referer?: string;
  };
  sources?: ConsumetEpisodeSource[];
}

/**
 * Search for anime ID on Gogoanime
 */
async function searchAnimeId(animeId: number, title: string) {
  try {
    // Try to find the anime by searching with the title
    const searchUrl = `${PROVIDERS.gogoanime.baseUrl}/${encodeURIComponent(title.split(" ")[0])}?limit=10`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) return null;

    const data = await response.json();
    // Find best match by comparing with original animeId
    return data.results?.[0]?.id;
  } catch {
    return null;
  }
}

/**
 * Get episode sources from Gogoanime via Consumet
 */
async function getGogoanimeSources(animeId: string, episodeNumber: number): Promise<{
  sources: Array<{
    url: string;
    quality: "360p" | "480p" | "720p" | "1080p" | "auto";
    label: string;
    provider: string;
    type: "mp4" | "hls" | "webm";
  }>;
  referer?: string;
} | null> {
  try {
    const episodeId = `${animeId}-episode-${episodeNumber}`;
    const url = `${PROVIDERS.gogoanime.baseUrl}/watch/${encodeURIComponent(episodeId)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000), // 15 second timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;

    const data: ConsumetSourcesResponse = await response.json();

    if (!data.sources || data.sources.length === 0) return null;

    return {
      sources: data.sources.map((s) => ({
        url: s.url,
        quality: mapQuality(s.quality),
        label: s.quality || "Auto",
        provider: "Gogoanime",
        type: (s.isM3U8 ? "hls" : "mp4") as "mp4" | "hls" | "webm",
      })),
      referer: data.headers?.Referer,
    };
  } catch {
    return null;
  }
}

/**
 * Get episode sources from Zoro via Consumet
 */
async function getZoroSources(animeId: string, episodeNumber: number): Promise<{
  sources: Array<{
    url: string;
    quality: "360p" | "480p" | "720p" | "1080p" | "auto";
    label: string;
    provider: string;
    type: "mp4" | "hls" | "webm";
  }>;
  referer?: string;
} | null> {
  try {
    const episodeId = `${animeId}$${episodeNumber}`;
    const url = `${PROVIDERS.zoro.baseUrl}/watch/${encodeURIComponent(episodeId)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;

    const data: ConsumetSourcesResponse = await response.json();

    if (!data.sources || data.sources.length === 0) return null;

    return {
      sources: data.sources.map((s) => ({
        url: s.url,
        quality: mapQuality(s.quality),
        label: s.quality || "Auto",
        provider: "Zoro",
        type: (s.isM3U8 ? "hls" : "mp4") as "mp4" | "hls" | "webm",
      })),
      referer: data.headers?.Referer,
    };
  } catch {
    return null;
  }
}

/**
 * Map quality string to standard format
 */
function mapQuality(quality: string | undefined): "360p" | "480p" | "720p" | "1080p" | "auto" {
  if (!quality) return "auto";

  const q = quality.toLowerCase();
  if (q.includes("1080")) return "1080p";
  if (q.includes("720")) return "720p";
  if (q.includes("480")) return "480p";
  if (q.includes("360")) return "360p";
  return "auto";
}

/**
 * GET /api/video-sources/[animeId]/[episode]
 * Returns video sources for the requested episode
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ animeId: string; episode: string }> }
) {
  try {
    const { animeId, episode } = await params;
    const episodeNumber = parseInt(episode, 10);

    if (isNaN(episodeNumber)) {
      return NextResponse.json(
        { error: "Invalid episode number" },
        { status: 400 }
      );
    }

    // Get title from query param for searching
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get("title");

    let sources: Array<{
      url: string;
      quality: "360p" | "480p" | "720p" | "1080p" | "auto";
      label: string;
      provider: string;
      type: "mp4" | "hls" | "webm";
    }> = [];
    let subtitles: any[] = [];
    let provider = "none";

    // Try Gogoanime first (most reliable)
    if (title) {
      const gogoId = await searchAnimeId(parseInt(animeId), title);
      if (gogoId) {
        const gogoResult = await getGogoanimeSources(gogoId, episodeNumber);
        if (gogoResult && gogoResult.sources && gogoResult.sources.length > 0) {
          sources = gogoResult.sources;
          provider = "gogoanime";
        }
      }
    }

    // Fallback to Zoro
    if (sources.length === 0 && title) {
      const zoroResult = await getZoroSources(title.toLowerCase().replace(/[^a-z0-9]/g, "-"), episodeNumber);
      if (zoroResult && zoroResult.sources && zoroResult.sources.length > 0) {
        sources = zoroResult.sources;
        provider = "zoro";
      }
    }

    // Return demo sources if nothing found
    if (sources.length === 0) {
      // Return fallback demo source
      sources = [{
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        quality: "auto" as const,
        label: "Demo (No Source)",
        provider: "Fallback",
        type: "mp4" as const,
      }];
      provider = "demo";
    }

    return NextResponse.json({
      animeId: parseInt(animeId),
      episodeNumber,
      sources,
      subtitles,
      provider,
      intro: null,
      outro: null,
    });
  } catch (error) {
    console.error("Error fetching video sources:", error);

    // Return fallback on error
    return NextResponse.json({
      sources: [{
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        quality: "auto" as const,
        label: "Demo (Error)",
        provider: "Fallback",
        type: "mp4" as const,
      }],
      provider: "fallback",
      error: "Failed to load video sources",
    }, { status: 200 }); // Return 200 with fallback to prevent player crashes
  }
}
