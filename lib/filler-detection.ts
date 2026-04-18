/**
 * Filler Episode Detection
 * Uses the animefillerlist.com API to detect filler episodes
 */

export interface FillerData {
  id: number;
  title: string;
  episodes: {
    number: number;
    title: string;
    type: "canon" | "mixed_canon" | "filler" | "mixed_filller";
    aired?: string;
  }[];
}

const FILLER_CACHE_KEY = "filler_data_cache";
const FILLER_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ===================================
// API Functions
// ===================================

/**
 * Fetch filler data for an anime by MAL ID
 */
export async function getFillerData(malId: number): Promise<FillerData | null> {
  if (typeof window === "undefined") return null;

  try {
    // Check cache first
    const cached = getCachedFillerData(malId);
    if (cached) return cached;

    // Fetch via server-side proxy to avoid CORS issues
    const url = `/api/filler/${malId}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Cache the result
    cacheFillerData(malId, data);

    return data;
  } catch {
    // Silently fail - filler detection is optional
    return null;
  }
}

/**
 * Check if an episode is a filler
 */
export async function isFillerEpisode(
  malId: number,
  episodeNumber: number
): Promise<boolean> {
  const fillerData = await getFillerData(malId);

  if (!fillerData) return false;

  const episode = fillerData.episodes.find((ep) => ep.number === episodeNumber);

  if (!episode) return false;

  return (
    episode.type === "filler" ||
    episode.type === "mixed_filller"
    // mixed_canon is NOT filler -- contains canonical plot content
  );
}

/**
 * Get all filler episodes for an anime
 */
export async function getFillerEpisodes(malId: number): Promise<number[]> {
  const fillerData = await getFillerData(malId);

  if (!fillerData) return [];

  return fillerData.episodes
    .filter(
      (ep) =>
        ep.type === "filler" ||
        ep.type === "mixed_filller"
        // mixed_canon is NOT filler -- contains canonical plot content
    )
    .map((ep) => ep.number);
}

/**
 * Get the next non-filler episode
 */
export async function getNextNonFillerEpisode(
  malId: number,
  currentEpisode: number,
  totalEpisodes: number
): Promise<number> {
  // Fetch filler data ONCE, then iterate locally instead of fetching per episode
  const fillerData = await getFillerData(malId);

  if (!fillerData) return currentEpisode + 1;

  // Build a Set of filler episode numbers for O(1) lookup
  const fillerSet = new Set(
    fillerData.episodes
      .filter(
        (ep) =>
          ep.type === "filler" ||
          ep.type === "mixed_filller" ||
          ep.type === "mixed_canon"
      )
      .map((ep) => ep.number)
  );

  for (let ep = currentEpisode + 1; ep <= totalEpisodes; ep++) {
    if (!fillerSet.has(ep)) return ep;
  }

  return currentEpisode + 1; // Fallback if all remaining are filler
}

/**
 * Get episode type label
 */
export function getEpisodeTypeLabel(type: string): string {
  switch (type) {
    case "canon":
      return "Canon";
    case "mixed_canon":
      return "Mixed Canon";
    case "filler":
      return "Filler";
    case "mixed_filller":
      return "Mixed Filler";
    default:
      return "Unknown";
  }
}

/**
 * Get episode type color
 */
export function getEpisodeTypeColor(type: string): string {
  switch (type) {
    case "canon":
      return "text-green-500";
    case "mixed_canon":
      return "text-yellow-500";
    case "filler":
      return "text-red-500";
    case "mixed_filller":
      return "text-orange-500";
    default:
      return "text-gray-500";
  }
}

// ===================================
// Cache Functions
// ===================================

interface FillerCache {
  [malId: string]: {
    data: FillerData;
    timestamp: number;
  };
}

function getCachedFillerData(malId: number): FillerData | null {
  try {
    const cacheJson = localStorage.getItem(FILLER_CACHE_KEY);
    if (!cacheJson) return null;

    const cache: FillerCache = JSON.parse(cacheJson);
    const cached = cache[malId.toString()];

    if (!cached) return null;

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > FILLER_CACHE_DURATION) {
      // Remove expired cache entry
      delete cache[malId.toString()];
      localStorage.setItem(FILLER_CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

function cacheFillerData(malId: number, data: FillerData): void {
  try {
    const cacheJson = localStorage.getItem(FILLER_CACHE_KEY) || "{}";
    const cache: FillerCache = JSON.parse(cacheJson);

    cache[malId.toString()] = {
      data,
      timestamp: Date.now(),
    };

    localStorage.setItem(FILLER_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Error caching filler data:", error);
  }
}

/**
 * Clear filler data cache
 */
export function clearFillerCache(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(FILLER_CACHE_KEY);
}
