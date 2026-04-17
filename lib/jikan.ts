/**
 * Jikan API Client
 * Unofficial MyAnimeList API - excellent fallback/supplement to AniList GraphQL
 * Documentation: https://docs.api.jikan.moe/
 *
 * Jikan is more stable for certain operations and provides richer metadata
 */

import type { Media } from "@/types/anilist";

const JIKAN_API_BASE = "https://api.jikan.moe/v4";

// Global rate limiter for Jikan API (v4 limits: 3 req/sec, 60/min)
const jikanRateLimiter = {
  timestamps: [] as number[],
  maxPerSecond: 2,
  maxPerMinute: 50,

  async wait(): Promise<void> {
    const now = Date.now();
    // Clean old timestamps
    this.timestamps = this.timestamps.filter(t => now - t < 60000);
    if (this.timestamps.length >= this.maxPerMinute) {
      const waitMs = 60000 - (now - this.timestamps[0]) + 100;
      await new Promise(r => setTimeout(r, waitMs));
    }
    // Also check per-second limit
    const recentSecond = this.timestamps.filter(t => now - t < 1000);
    if (recentSecond.length >= this.maxPerSecond) {
      await new Promise(r => setTimeout(r, 1100));
    }
    this.timestamps.push(Date.now());
  }
};

// ============================================
// Types
// ============================================

interface JikanAnime {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailers?: {
    youtube_id?: string;
    url?: string;
    embed_url?: string;
  }[];
  title: string;
  title_english?: string;
  title_japanese?: string;
  title_synonyms: string[];
  type: string;
  source: string;
  status: string;
  airing: boolean;
  aired: {
    from: string;
    to: string | null;
    prop: {
      from: Day | null;
      to: Day | null;
    };
  };
  duration?: string;
  rating?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  background?: string;
  season?: string;
  year?: number;
  genres: Array<{ mal_id: number; type: string; name: string; url: string }>;
  studios: Array<{ mal_id: number; type: string; name: string; url: string }>;
  episodes?: number;
}

interface Day {
  day: number;
  month: number;
  year: number;
}

interface JikanResponse<T> {
  data: T[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
}

interface JikanSingleResponse<T> {
  data: T;
}

// ============================================
// Helper Functions
// ============================================

const JIKAN_FORMAT_MAP: Record<string, string> = {
  'tv': 'TV',
  'ova': 'OVA',
  'movie': 'MOVIE',
  'special': 'SPECIAL',
  'music': 'MUSIC',
  'ona': 'ONA',
  'tv_short': 'TV_SHORT',
};

/**
 * Parse Jikan duration string (e.g. "1 hr 34 min" or "24 min per ep") into total minutes
 */
function parseJikanDuration(duration: string | null): number | null {
  if (!duration) return null;
  let totalMinutes = 0;
  const hrMatch = duration.match(/(\d+)\s*hr/);
  const minMatch = duration.match(/(\d+)\s*min/);
  if (hrMatch) totalMinutes += parseInt(hrMatch[1]) * 60;
  if (minMatch) totalMinutes += parseInt(minMatch[1]);
  return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Convert Jikan anime to our Media format
 */
function jikanToMedia(jikan: JikanAnime): Media {
  return {
    id: jikan.mal_id,
    idMal: jikan.mal_id,
    title: {
      romaji: jikan.title,
      english: jikan.title_english || jikan.title,
      native: jikan.title_japanese || null,
      userPreferred: jikan.title_english || jikan.title,
    },
    format: (JIKAN_FORMAT_MAP[jikan.type?.toLowerCase()] || jikan.type?.toUpperCase() || 'TV') as Media["format"],
    type: "ANIME",
    status: jikan.status.toUpperCase().replace(" ", "_") as Media["status"],
    description: jikan.synopsis || null,
    episodes: jikan.episodes || null,
    duration: parseJikanDuration(jikan.duration ?? null),
    averageScore: jikan.score ? jikan.score * 10 : null,
    meanScore: null,
    popularity: jikan.popularity || 0,
    favourites: jikan.favorites || 0,
    trending: 0,
    coverImage: {
      large: jikan.images.jpg.large_image_url,
      extraLarge: jikan.images.jpg.large_image_url,
      medium: jikan.images.jpg.small_image_url,
      color: null,
    },
    bannerImage: null,
    trailer: jikan.trailers?.[0]
      ? {
          id: jikan.trailers[0].youtube_id || "",
          site: "youtube",
        }
      : null,
    genres: jikan.genres.map(g => g.name),
    studios: jikan.studios.length > 0
      ? {
          nodes: jikan.studios.map(s => ({
            id: s.mal_id,
            name: s.name,
            isAnimationStudio: true,
          })),
        }
      : null,
    season: jikan.season?.toUpperCase() || null,
    seasonYear: jikan.year || null,
    startDate: jikan.aired?.prop.from
      ? {
          year: jikan.aired.prop.from.year || null,
          month: jikan.aired.prop.from.month || null,
          day: jikan.aired.prop.from.day || null,
        }
      : null,
    endDate: null,
    seasonInt: null,
    synonyms: jikan.title_synonyms,
    isLicensed: null,
    source: jikan.source,
    countryOfOrigin: "JP",
    isAdult: false,
    tags: null,
    relations: null,
    characters: null,
    staff: null,
    externalLinks: null,
    streamingEpisodes: null,
    nextAiringEpisode: null,
    airingSchedule: null,
  } as Media;
}

/**
 * Fetch from Jikan API with timeout
 */
async function fetchFromJikan<T>(endpoint: string, timeout = 10000): Promise<T | null> {
  try {
    await jikanRateLimiter.wait();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${JIKAN_API_BASE}${endpoint}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AnimeVerse-Stream/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Jikan] API error: ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[Jikan] Timeout for ${endpoint}`);
    } else {
      console.error(`[Jikan] Fetch error for ${endpoint}:`, error);
    }
    return null;
  }
}

// ============================================
// API Functions
// ============================================

/**
 * Search for anime by title
 */
export async function searchAnime(
  query: string,
  page = 1,
  limit = 20
): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/anime?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&sfw=true`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get anime by MyAnimeList ID
 */
export async function getAnimeById(malId: number): Promise<Media | null> {
  const result = await fetchFromJikan<JikanSingleResponse<JikanAnime>>(
    `/anime/${malId}/full`
  );

  if (!result?.data) return null;

  return jikanToMedia(result.data);
}

/**
 * Get anime by multiple IDs (batch)
 */
export async function getAnimeByIds(malIds: number[]): Promise<Media[]> {
  const results: (Media | null)[] = [];
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 1000; // 1 second between batches

  for (let i = 0; i < malIds.length; i += BATCH_SIZE) {
    const batch = malIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(id => getAnimeById(id))
    );
    results.push(...batchResults);

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < malIds.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  return results.filter((m): m is Media => m !== null);
}

/**
 * Get trending anime
 */
export async function getTrendingAnime(page = 1, limit = 24): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/top/anime?page=${page}&limit=${limit}`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get popular anime
 */
export async function getPopularAnime(page = 1, limit = 24): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/anime?page=${page}&limit=${limit}&order_by=popularity&sort=desc`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get currently airing anime
 */
export async function getAiringAnime(page = 1, limit = 24): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/anime?page=${page}&limit=${limit}&status=airing&order_by=start_date&sort=desc`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get anime by season
 */
export async function getSeasonalAnime(
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL",
  year = new Date().getFullYear(),
  page = 1,
  limit = 24
): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/seasons/${year}/${season.toLowerCase()}?page=${page}&limit=${limit}`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get anime by genre
 */
export async function getAnimeByGenre(
  genreId: number,
  page = 1,
  limit = 24
): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/anime?genres=${genreId}&page=${page}&limit=${limit}&order_by=score&sort=desc`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get anime by studio
 */
export async function getAnimeByStudio(
  studioId: number,
  page = 1,
  limit = 24
): Promise<Media[]> {
  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/anime?producers=${studioId}&page=${page}&limit=${limit}&order_by=score&sort=desc`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get recommendations for an anime
 */
export async function getRecommendations(malId: number): Promise<Media[]> {
  const result = await fetchFromJikan<{ data: Array<{ entry: JikanAnime }> }>(
    `/anime/${malId}/recommendations`
  );

  if (!result?.data) return [];

  return result.data
    .slice(0, 12)
    .map(r => r.entry)
    .filter((m): m is JikanAnime => m !== null && m.mal_id > 0)
    .map(jikanToMedia);
}

/**
 * Search anime by specific filters
 */
export async function searchAnimeWithFilters(params: {
  query?: string;
  type?: string;
  status?: string;
  genre?: string;
  year?: number;
  page?: number;
}): Promise<Media[]> {
  const {
    query = "",
    type,
    status,
    genre,
    year,
    page = 1,
  } = params;

  const queryParams = new URLSearchParams();
  if (query) queryParams.append("q", query);
  if (page) queryParams.append("page", page.toString());
  if (type) queryParams.append("type", type);
  if (status) queryParams.append("status", status.toLowerCase());
  if (year) queryParams.append("start_date", `${year}-01-01`);
  if (genre) queryParams.append("genres", genre);
  queryParams.append("limit", "24");
  queryParams.append("order_by", "score");
  queryParams.append("sort", "desc");

  const result = await fetchFromJikan<JikanResponse<JikanAnime>>(
    `/anime?${queryParams.toString()}`
  );

  if (!result?.data) return [];

  return result.data.map(jikanToMedia);
}

/**
 * Get current season info
 */
export function getCurrentSeason(): "WINTER" | "SPRING" | "SUMMER" | "FALL" {
  const month = new Date().getMonth();
  if (month >= 0 && month <= 2) return "WINTER";
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  return "FALL";
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// ============================================
// Genre ID Mapping
// ============================================

export const GENRE_IDS: Record<string, number> = {
  "Action": 1,
  "Adventure": 2,
  "Comedy": 4,
  "Drama": 8,
  "Sci-Fi": 24,
  "Fantasy": 10,
  "Slice of Life": 36,
  "Romance": 22,
  "Supernatural": 37,
  "Mystery": 7,
  "Horror": 14,
  "Psychological": 40,
  "Thriller": 41,
  "Sports": 30,
  "Music": 19,
};

/**
 * Get list of all genres with IDs
 */
export function getGenreList(): { id: number; name: string }[] {
  return Object.entries(GENRE_IDS).map(([name, id]) => ({ id, name }));
}
