/**
 * Video Sources API Route
 * Fetches video sources from the local Consumet API (AnimeSaturn provider)
 * Proxies requests to avoid CORS issues
 *
 * Note: AnimeSaturn is used as the primary provider as AnimeKai is blocked by Cloudflare
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Get API base URL from environment or use localhost
const API_BASE_URL = process.env.VIDEO_API_BASE_URL || "http://localhost:3001";

interface AnimeSaturnEpisode {
  id: string;
  number: number;
}

interface AnimeSaturnInfo {
  id: string;
  title: string;
  episodes?: AnimeSaturnEpisode[];
}

interface AnimeSaturnSourcesResponse {
  headers?: {
    Referer?: string;
  };
  sources?: Array<{
    url: string;
    isM3U8?: boolean;
    quality?: string;
  }>;
  subtitles?: Array<{
    url: string;
    lang: string;
  }>;
}

/**
 * Search for anime on AnimeSaturn by title
 * Returns the anime ID if found
 */
async function searchAnimeId(
  title: string,
  malId: number | null
): Promise<string | null> {
  // Build search strategies - try various title formats
  const searchStrategies: string[] = [];

  // Strategy 1: Direct title
  if (title) {
    const cleanTitle = title.toLowerCase().trim();
    searchStrategies.push(cleanTitle);
  }

  // Strategy 2: Extract key words and try combinations
  if (title) {
    const words = title.split(" ").filter(w => w.length > 3);
    if (words.length >= 2) {
      searchStrategies.push(`${words[0]} ${words[1]}`.toLowerCase());
    }
    if (words.length >= 3) {
      searchStrategies.push(`${words[0]} ${words[1]} ${words[2]}`.toLowerCase());
    }
  }

  // Strategy 3: Remove common prefixes/suffixes and search
  if (title) {
    const cleanMainTitle = title
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/:\s*.*$/, "") // Remove subtitles
      .replace(/[^\w\s]/g, "")
      .trim();
    if (cleanMainTitle && cleanMainTitle.length > 3) {
      searchStrategies.push(cleanMainTitle);
    }
  }

  // Strategy 4: First word only (if distinctive)
  if (title) {
    const firstWord = title.split(" ")[0];
    if (firstWord.length > 4) {
      searchStrategies.push(firstWord.toLowerCase());
    }
  }

  // Remove duplicates while preserving order
  const uniqueStrategies = [...new Set(searchStrategies)];

  // Try each search strategy
  for (const searchTerm of uniqueStrategies) {
    try {
      const searchUrl = `${API_BASE_URL}/anime/animesaturn/${encodeURIComponent(searchTerm)}`;
      const response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Try to find the best match
        const searchTermLower = searchTerm.toLowerCase();

        // Look for exact or close title match
        let bestMatch = data.results.find((r: { title?: string; id: string }) => {
          const titleLower = (r.title || "").toLowerCase();
          return titleLower.includes(searchTermLower) ||
                 searchTermLower.includes(titleLower.split(" ")[0]);
        });

        // Fallback to first result
        if (!bestMatch) {
          bestMatch = data.results[0];
        }

        return bestMatch.id;
      }
    } catch {
      continue;
    }
  }

  // Strategy 5: Fallback - try using MAL ID via Jikan API to get better title matching
  if (malId) {
    try {
      const jikanUrl = `https://api.jikan.moe/v4/anime/${malId}`;
      const jikanResponse = await fetch(jikanUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (jikanResponse.ok) {
        const jikanData = await jikanResponse.json();
        const jikanTitle = jikanData.data?.title;
        const jikanTitles = jikanData.data?.titles || [];

        // Try with Jikan's main title
        if (jikanTitle) {
          for (const titleData of jikanTitles) {
            const searchTerm = titleData.title?.toLowerCase().replace(/[^\w\s]/g, " ").trim();
            if (searchTerm && searchTerm.length > 3) {
              const searchUrl = `${API_BASE_URL}/anime/animesaturn/${encodeURIComponent(searchTerm)}`;
              const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
              if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                  return data.results[0].id;
                }
              }
            }
          }
        }
      }
    } catch {
      // Silently skip Jikan fallback failures
    }
  }

  return null;
}

/**
 * Get anime info including episode list
 */
async function getAnimeInfo(animeId: string): Promise<AnimeSaturnInfo | null> {
  try {
    const url = `${API_BASE_URL}/anime/animesaturn/info?id=${encodeURIComponent(animeId)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get episode sources from AnimeSaturn
 */
async function getEpisodeSources(
  episodeId: string
): Promise<{
  sources: Array<{
    url: string;
    quality: "360p" | "480p" | "720p" | "1080p" | "auto";
    label: string;
    provider: string;
    type: "mp4" | "hls" | "webm";
  }>;
  subtitles: Array<{
    url: string;
    lang: string;
    label: string;
  }>;
  referer?: string;
} | null> {
  try {
    const url = `${API_BASE_URL}/anime/animesaturn/watch/${encodeURIComponent(episodeId)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data: AnimeSaturnSourcesResponse = await response.json();

    if (!data.sources || data.sources.length === 0) return null;

    // Map sources to our format
    const sources = data.sources
      .filter(s => !s.url.includes("thumbnails.vtt")) // Filter out thumbnail streams
      .map((s) => ({
        url: s.url,
        quality: "auto" as const, // AnimeSaturn doesn't provide quality info
        label: s.quality || "Auto",
        provider: "AnimeSaturn",
        type: (s.isM3U8 ? "hls" : "mp4") as "mp4" | "hls" | "webm",
      }));

    // Map subtitles
    const subtitles = (data.subtitles || []).map((sub) => ({
      url: sub.url,
      lang: sub.lang.split(" ")[0].toLowerCase(), // Take first part of language
      label: sub.lang,
    }));

    return {
      sources,
      subtitles,
      referer: data.headers?.Referer,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/video-sources/[animeId]/[episode]
 * Returns video sources for the requested episode
 * Query params:
 * - title: Anime title for searching
 * - malId: MyAnimeList ID for better matching
 * - language: "sub" or "dub" (default: "sub") - Note: AnimeSaturn primarily has Italian subs
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
    const malId = searchParams.get("malId");
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
    let referer: string | undefined;

    const availableLanguages: Array<{ type: "sub" | "dub"; available: boolean }> = [
      { type: "sub", available: true },
      { type: "dub", available: false }, // AnimeSaturn primarily has subs
    ];

    // Search for the anime on AnimeSaturn
    if (title) {
      const animeSaturnId = await searchAnimeId(
        title,
        malId ? parseInt(malId) : null
      );

      if (animeSaturnId) {
        // Get anime info to find the episode ID
        const animeInfo = await getAnimeInfo(animeSaturnId);

        if (animeInfo?.episodes) {
          const episodeData = animeInfo.episodes.find(
            (ep) => ep.number === episodeNumber
          );

          if (episodeData) {
            // Get sources for this episode
            const sourcesData = await getEpisodeSources(episodeData.id);

            if (sourcesData && sourcesData.sources.length > 0) {
              sources = sourcesData.sources;
              subtitles.push(...sourcesData.subtitles);
              referer = sourcesData.referer;
              provider = "animesaturn";
            }
          }
        }
      }
    }

    // Return error if no sources found
    if (sources.length === 0) {
      return NextResponse.json(
        {
          animeId: parseInt(animeId),
          episodeNumber,
          sources: [],
          subtitles,
          provider: "none",
          language,
          availableLanguages,
          intro: null,
          outro: null,
          error: "NO_SOURCES",
          message: `No video sources found for episode ${episodeNumber}. The anime might not be available on AnimeSaturn.`,
        },
        { status: 404 }
      );
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
      referer,
    });
  } catch (error) {
    console.error("Error fetching video sources:", error);

    // Return fallback on error
    return NextResponse.json(
      {
        sources: [],
        provider: "none",
        error: "FETCH_ERROR",
        message: "Failed to load video sources. The API might be unavailable.",
      },
      { status: 503 }
    );
  }
}
