/**
 * Video Sources API Route
 * Fetches video sources from the local Consumet API (AnimePahe provider)
 * Proxies requests to avoid CORS issues
 *
 * Note: AnimePahe is used as the primary provider for English content and better quality options
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Get API base URL from environment or use localhost
const API_BASE_URL = process.env.VIDEO_API_BASE_URL || "http://localhost:3001";

interface AnimePaheEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  duration?: string;
  url?: string;
}

interface AnimePaheInfo {
  id: string;
  title: string;
  episodes?: AnimePaheEpisode[];
}

interface AnimePaheSourcesResponse {
  headers?: {
    Referer?: string;
  };
  sources?: Array<{
    url: string;
    isM3U8?: boolean;
    quality: string;
    isDub?: boolean;
  }>;
  download?: Array<{
    url: string;
    quality: string;
  }>;
}

/**
 * Clean and normalize anime title for better search matching
 * Removes season info, special characters, and extra details
 */
function cleanTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove "Season X:" or "Season X" but keep the content after
    .replace(/\s+season\s+\d+/gi, "")
    // Remove "Part X" or "Part X:" at the end but keep content
    .replace(/\s+part\s+\d+(:?\s*)?$/gi, "")
    // Remove colons (but keep content)
    .replace(/:/g, " ")
    // Remove content in parentheses
    .replace(/\s*\(.*?\)\s*/g, " ")
    // Remove common prefixes
    .replace(/^(the|a|an)\s+/i, "")
    // Remove special characters but keep spaces and basic word characters
    .replace(/[^\w\s]/g, " ")
    // Replace multiple spaces with single space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the main title (first 2-3 words) for broader search
 */
function extractMainTitle(title: string): string {
  const words = cleanTitle(title).split(" ").filter(w => w.length > 2);
  if (words.length >= 2) {
    return words.slice(0, 2).join(" ");
  }
  return words[0] || "";
}

/**
 * Search for anime on AnimePahe by title
 * Returns the anime ID if found
 * Uses multiple search strategies with progressively simpler titles
 */
async function searchAnimeId(
  title: string,
  malId: number | null
): Promise<string | null> {
  // Build search strategies - from specific to general
  const searchStrategies: string[] = [];

  if (title) {
    // Strategy 1: Cleaned full title (without season/part info)
    const cleaned = cleanTitle(title);
    if (cleaned.length > 3) {
      searchStrategies.push(cleaned);
    }

    // Strategy 2: Main title only (first 2-3 words)
    const mainTitle = extractMainTitle(title);
    if (mainTitle && mainTitle !== cleaned && mainTitle.length > 2) {
      searchStrategies.push(mainTitle);
    }

    // Strategy 3: Try first word only if it's distinctive
    const firstWord = title.split(" ")[0].toLowerCase();
    if (firstWord.length > 5) {
      searchStrategies.push(firstWord);
    }

    // Strategy 4: Try distinctive words (season, movie, culling, game, etc.)
    const distinctiveWords = ["season", "movie", "ova", "ona", "special", "culling", "game", "part"];
    const titleWords = title.toLowerCase().split(" ");
    for (const dw of distinctiveWords) {
      if (titleWords.includes(dw)) {
        // Combine first word with distinctive word
        const firstWordWithDistinctive = titleWords[0] + " " + dw;
        if (!searchStrategies.includes(firstWordWithDistinctive)) {
          searchStrategies.push(firstWordWithDistinctive);
        }
      }
    }

    // Strategy 5: Original title (lowercased) if different from cleaned
    const originalLower = title.toLowerCase().trim();
    if (originalLower !== cleaned && originalLower.length > 3) {
      searchStrategies.push(originalLower);
    }
  }

  // Remove duplicates while preserving order
  const uniqueStrategies = Array.from(new Set(searchStrategies));

  console.log(`[Video Search] Searching for: "${title}"`);
  console.log(`[Video Search] Search strategies:`, uniqueStrategies);

  // Try each search strategy
  for (const searchTerm of uniqueStrategies) {
    try {
      const searchUrl = `${API_BASE_URL}/anime/animepahe/${encodeURIComponent(searchTerm)}`;

      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const responsePromise = fetch(searchUrl, { signal: controller.signal });
      const searchResponse = await responsePromise;
      clearTimeout(timeoutId);

      if (!searchResponse.ok) continue;

      const data = await searchResponse.json();

      if (data.results && data.results.length > 0) {
        console.log(`[Video Search] Found ${data.results.length} results for "${searchTerm}"`);

        // Try to find the best match using a scoring system
        const searchTermLower = searchTerm.toLowerCase();
        const searchWords = searchTermLower.split(" ").filter(w => w.length > 2);

        // Score each result and pick the best one
        const scoredResults = data.results.map((r: { title?: string; id: string }) => {
          const resultTitle = (r.title || "").toLowerCase();
          const cleanedResult = cleanTitle(r.title || "");
          const resultWords = resultTitle.split(" ").filter(w => w.length > 2);
          let score = 0;

          console.log(`[Video Search] Comparing "${searchTermLower}" with "${resultTitle}"`);

          // Exact match - highest score
          if (resultTitle === searchTermLower || cleanedResult === searchTermLower) {
            score += 100;
            console.log(`[Video Search] Exact match, score = ${score}`);
          }

          // Result title contains search term (partial match)
          if (resultTitle.includes(searchTermLower) || cleanedResult.includes(searchTermLower)) {
            score += 50;
            console.log(`[Video Search] Result contains search term, score = ${score}`);
          }

          // Search term contains main words of result
          if (searchWords.length >= 2 && resultWords.length >= 2) {
            const searchPrefix = searchWords.slice(0, 2).join(" ");
            const resultPrefix = resultWords.slice(0, 2).join(" ");
            if (searchPrefix === resultPrefix) {
              score += 40;
              console.log(`[Video Search] First 2 words match, score = ${score}`);
            }
          }

          // Count matching words
          const matchingWords = searchWords.filter(w =>
            resultWords.some(rw => rw.includes(w) || w.includes(rw))
          );
          score += matchingWords.length * 15;

          // Bonus for matching distinctive words (culling, game, part, etc.)
          const distinctiveWords = ["culling", "game", "part", "season", "movie", "ova", "hidden", "inventory", "premature", "death"];
          for (const word of distinctiveWords) {
            if (searchWords.includes(word) && resultWords.some(rw => rw.includes(word))) {
              score += 25;
              console.log(`[Video Search] Distinctive word "${word}" matched, score = ${score}`);
            }
          }

          // Prefer shorter title differences (closer match in length)
          const lengthDiff = Math.abs(resultTitle.length - searchTermLower.length);
          score -= lengthDiff / 20;

          console.log(`[Video Search] Final score for "${resultTitle}": ${score}`);

          return { result: r, score };
        });

        // Sort by score descending and pick the best
        scoredResults.sort((a, b) => b.score - a.score);
        let bestMatch = scoredResults[0]?.result;

        // Fallback to first result
        if (!bestMatch) {
          bestMatch = data.results[0];
        }

        console.log(`[Video Search] Selected: "${bestMatch.title}" (${bestMatch.id})`);
        return bestMatch.id;
      }
    } catch (error) {
      console.log(`[Video Search] Error searching for "${searchTerm}":`, error);
      continue;
    }
  }

  // Strategy 5: Fallback - try using MAL ID via Jikan API to get better title matching
  if (malId) {
    try {
      console.log(`[Video Search] Trying Jikan API fallback for MAL ID: ${malId}`);
      const jikanUrl = `https://api.jikan.moe/v4/anime/${malId}`;

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const jikanResponsePromise = fetch(jikanUrl, { signal: ctrl.signal });
      const jikanResponse = await jikanResponsePromise;
      clearTimeout(tid);

      if (jikanResponse.ok) {
        const jikanData = await jikanResponse.json();
        const jikanTitle = jikanData.data?.title;
        const jikanTitles = jikanData.data?.titles || [];

        console.log(`[Video Search] Jikan title: "${jikanTitle}"`);

        // Try with Jikan's main title
        if (jikanTitle) {
          const cleanedJikan = cleanTitle(jikanTitle);
          const mainJikan = extractMainTitle(jikanTitle);

          for (const searchTerm of [cleanedJikan, mainJikan].filter(Boolean)) {
            if (searchTerm.length > 3) {
              const searchUrl = `${API_BASE_URL}/anime/animepahe/${encodeURIComponent(searchTerm)}`;
              const ctrl = new AbortController();
              const tid = setTimeout(() => ctrl.abort(), 5000);
              const response = await fetch(searchUrl, { signal: ctrl.signal });
              clearTimeout(tid);
              if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                  console.log(`[Video Search] Found via Jikan: "${data.results[0].title}"`);
                  return data.results[0].id;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`[Video Search] Jikan fallback failed:`, error);
    }
  }

  console.log(`[Video Search] No results found for "${title}"`);
  return null;
}

/**
 * Get anime info including episode list
 */
async function getAnimeInfo(animeId: string): Promise<AnimePaheInfo | null> {
  try {
    // AnimePahe uses path parameter for info endpoint
    const url = `${API_BASE_URL}/anime/animepahe/info/${encodeURIComponent(animeId)}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const infoResponsePromise = fetch(url, { signal: ctrl.signal });
    const infoResponse = await infoResponsePromise;
    clearTimeout(tid);

    if (!infoResponse.ok) return null;

    return await infoResponse.json();
  } catch {
    return null;
  }
}

/**
 * Get episode sources from AnimePahe
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
    // AnimePahe uses query parameter for episodeId
    const url = `${API_BASE_URL}/anime/animepahe/watch?episodeId=${encodeURIComponent(episodeId)}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const sourcesResponsePromise = fetch(url, { signal: ctrl.signal });
    const sourcesResponse = await sourcesResponsePromise;
    clearTimeout(tid);

    if (!sourcesResponse.ok) return null;

    const data: AnimePaheSourcesResponse = await sourcesResponse.json();

    // Combine streaming and download sources
    const allSources = [
      ...(data.sources || []),
      ...(data.download || [])
    ];

    if (allSources.length === 0) return null;

    // Map sources to our format
    const sources = allSources.map((s) => ({
      url: s.url,
      quality: mapQuality(s.quality),
      label: s.quality || "Auto",
      provider: "AnimePahe",
      type: (('isM3U8' in s && (s as { isM3U8?: boolean }).isM3U8) ? "hls" : "mp4") as "mp4" | "hls" | "webm",
    }));

    // AnimePahe doesn't provide separate subtitle files (hardcoded)
    const subtitles: Array<{
      url: string;
      lang: string;
      label: string;
    }> = [];

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
 * Map quality string to standard format
 * AnimePahe quality format: "Vodes · 360p BD" or "800p"
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
 * - malId: MyAnimeList ID for better matching
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
      { type: "dub", available: false },
    ];

    // Search for the anime on AnimePahe
    let animePaheId: string | null = null;

    if (title) {
      animePaheId = await searchAnimeId(
        title,
        malId ? parseInt(malId) : null
      );

      if (animePaheId) {
        // Get anime info to find the episode ID
        const animeInfo = await getAnimeInfo(animePaheId);

        if (animeInfo?.episodes) {
          // Try to find the exact episode
          let episodeData = animeInfo.episodes.find(
            (ep) => ep.number === episodeNumber
          );

          // If not found, use the first available episode (for continuation seasons)
          if (!episodeData && animeInfo.episodes.length > 0) {
            console.log(`[Video Search] Episode ${episodeNumber} not found, using first available episode ${animeInfo.episodes[0].number}`);
            episodeData = animeInfo.episodes[0];
          }

          if (episodeData) {
            console.log(`[Video Search] Found episode ${episodeData.number}: ${episodeData.id}`);

            // Get sources for this episode
            const sourcesData = await getEpisodeSources(episodeData.id);

            if (sourcesData && sourcesData.sources.length > 0) {
              sources = sourcesData.sources;
              subtitles.push(...sourcesData.subtitles);
              referer = sourcesData.referer;
              provider = "animepahe";
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
          message: `No video sources found for episode ${episodeNumber}. The anime might not be available on AnimePahe.`,
        },
        { status: 404 }
      );
    }

    console.log(`[Video Search] Returning ${sources.length} sources from ${provider}`);

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
