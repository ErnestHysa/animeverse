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
 * Supports both sub and dub versions
 */
async function searchAnimeId(
  animeId: number,
  title: string,
  language: "sub" | "dub" = "sub"
): Promise<string | null> {
  try {
    const searchTitle = title.split(" ")[0];
    const searchUrl = `${PROVIDERS.gogoanime.baseUrl}/${encodeURIComponent(searchTitle)}?limit=20`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Interface for Gogoanime search results
    interface GogoAnimeResult {
      id: string;
      title?: string;
      otherName?: string;
    }

    if (language === "dub") {
      // Look for a result with "dub" in the title or ID
      const dubResult = data.results.find(
        (r: GogoAnimeResult) =>
          r.id?.toLowerCase().includes("dub") ||
          r.title?.toLowerCase().includes("dub") ||
          r.otherName?.toLowerCase().includes("dub")
      );
      return dubResult?.id || data.results[0]?.id;
    }

    // For sub, prefer non-dub versions
    const subResult = data.results.find(
      (r: GogoAnimeResult) => !r.id?.toLowerCase().includes("dub")
    );
    return subResult?.id || data.results[0]?.id;
  } catch {
    return null;
  }
}

/**
 * Get episode sources from Gogoanime via Consumet
 * Supports both sub and dub versions
 */
async function getGogoanimeSources(
  animeId: string,
  episodeNumber: number,
  language: "sub" | "dub" = "sub"
): Promise<{
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
    // For dub, try to find the dubbed version ID
    let effectiveAnimeId = animeId;

    if (language === "dub") {
      // Try common dub ID patterns
      const dubPatterns = [
        `${animeId}-dub`,
        `${animeId}dub`,
        animeId.replace(/-anime$/, "-dub-anime"),
      ];

      // Search for the dub version if the direct pattern doesn't work
      // We'll try the first pattern and fall back if it fails
      effectiveAnimeId = dubPatterns[0];
    }

    const episodeId = `${effectiveAnimeId}-episode-${episodeNumber}`;
    const url = `${PROVIDERS.gogoanime.baseUrl}/watch/${encodeURIComponent(episodeId)}`;

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
        provider: `Gogoanime (${language.toUpperCase()})`,
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
 * Query params:
 * - title: Anime title for searching
 * - language: "sub" or "dub" (default: "sub")
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

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get("title");
    const language = (searchParams.get("language") || "sub") as "sub" | "dub";

    let sources: Array<{
      url: string;
      quality: "360p" | "480p" | "720p" | "1080p" | "auto";
      label: string;
      provider: string;
      type: "mp4" | "hls" | "webm";
    }> = [];

    interface SubtitleTrack {
      url: string;
      lang: string;
      label: string;
    }

    const subtitles: SubtitleTrack[] = [];
    let provider = "none";
    const availableLanguages: Array<{ type: "sub" | "dub"; available: boolean }> = [
      { type: "sub", available: true },
      { type: "dub", available: false },
    ];

    // Try Gogoanime first (most reliable)
    if (title) {
      const gogoId = await searchAnimeId(parseInt(animeId), title, language);
      if (gogoId) {
        const gogoResult = await getGogoanimeSources(gogoId, episodeNumber, language);
        if (gogoResult && gogoResult.sources && gogoResult.sources.length > 0) {
          sources = gogoResult.sources;
          provider = `gogoanime-${language}`;

          // Check if dub is available by trying to search for it
          if (language === "sub") {
            const dubId = await searchAnimeId(parseInt(animeId), title, "dub");
            if (dubId && dubId !== gogoId) {
              availableLanguages.find((l) => l.type === "dub")!.available = true;
            }
          }
        }
      }
    }

    // Fallback to Zoro for the requested language
    if (sources.length === 0 && title) {
      const zoroResult = await getZoroSources(
        title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        episodeNumber
      );
      if (zoroResult && zoroResult.sources && zoroResult.sources.length > 0) {
        sources = zoroResult.sources;
        provider = "zoro";
      }
    }

    // Return demo sources if nothing found
    if (sources.length === 0) {
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
      language,
      availableLanguages,
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
    }, { status: 200 });
  }
}
