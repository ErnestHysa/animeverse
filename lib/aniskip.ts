/**
 * AniSkip API Integration
 * Fetches crowd-sourced intro/outro timestamps for anime episodes
 * API Documentation: https://api.aniskip.com/v2
 */

// ===================================
// Types
// ===================================

export interface SkipInterval {
  startTime: number;
  endTime: number;
}

export interface SkipResult {
  interval: SkipInterval;
  skipType: string;
  skipId: string;
  episodeLength: number;
}

export interface AniSkipResponse {
  found: boolean;
  results: SkipResult[];
  message: string | null;
}

export type SkipType = "op" | "ed" | "mixed-op" | "mixed-ed" | "recap";

export interface IntroOutroTimestamps {
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  recap?: { start: number; end: number };
}

// ===================================
// Cache Management
// ===================================

const CACHE_PREFIX = "aniskip-";
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

interface CacheEntry {
  data: IntroOutroTimestamps;
  timestamp: number;
}

function getCacheKey(malId: number, episodeNumber: number): string {
  return `${CACHE_PREFIX}${malId}-${episodeNumber}`;
}

function getCachedTimestamps(malId: number, episodeNumber: number): IntroOutroTimestamps | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(getCacheKey(malId, episodeNumber));
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    // Return cached data if still valid
    if (age < CACHE_DURATION) {
      return entry.data;
    }

    // Remove expired cache
    localStorage.removeItem(getCacheKey(malId, episodeNumber));
    return null;
  } catch {
    return null;
  }
}

function setCachedTimestamps(
  malId: number,
  episodeNumber: number,
  data: IntroOutroTimestamps
): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(getCacheKey(malId, episodeNumber), JSON.stringify(entry));
  } catch {
    // Silently fail if localStorage is full
  }
}

// ===================================
// Custom Timestamps (User Overrides)
// ===================================

const CUSTOM_PREFIX = "custom-skip-";
const CUSTOM_TIMESTAMP_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getCustomTimestamps(animeId: number, episodeNumber: number): IntroOutroTimestamps | null {
  if (typeof window === "undefined") return null;

  try {
    const key = `${CUSTOM_PREFIX}${animeId}-${episodeNumber}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const custom: IntroOutroTimestamps & { _timestamp?: number } = JSON.parse(raw);

    // Validate timestamp ranges
    if (custom.intro && custom.intro.start >= custom.intro.end) {
      delete custom.intro;
    }
    if (custom.outro && custom.outro.start >= custom.outro.end) {
      delete custom.outro;
    }
    if (custom.recap && custom.recap.start >= custom.recap.end) {
      delete custom.recap;
    }

    // Check expiration
    if (custom._timestamp && Date.now() - custom._timestamp > CUSTOM_TIMESTAMP_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    // Return only the IntroOutroTimestamps fields
    const result: IntroOutroTimestamps = {};
    if (custom.intro) result.intro = custom.intro;
    if (custom.outro) result.outro = custom.outro;
    if (custom.recap) result.recap = custom.recap;
    return result;
  } catch {
    return null;
  }
}

export function setCustomTimestamps(
  animeId: number,
  episodeNumber: number,
  timestamps: IntroOutroTimestamps
): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${CUSTOM_PREFIX}${animeId}-${episodeNumber}`;
    const entry = { ...timestamps, _timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Silently fail
  }
}

export function clearCustomTimestamps(animeId: number, episodeNumber: number): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${CUSTOM_PREFIX}${animeId}-${episodeNumber}`;
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

// ===================================
// AniSkip API
// ===================================

/**
 * Fetch skip times from AniSkip API (via server-side proxy to avoid CORS)
 */
export async function fetchSkipTimes(
  malId: number,
  episodeNumber: number,
  options: {
    types?: SkipType[];
    episodeLength?: number;
  } = {}
): Promise<AniSkipResponse> {
  const { types = ["op", "ed", "mixed-op", "mixed-ed", "recap"], episodeLength = 0 } = options;

  // Build query parameters
  const params = new URLSearchParams();
  types.forEach((type) => params.append("types", type));
  if (episodeLength > 0) {
    params.append("episodeLength", episodeLength.toString());
  }

  // Use our server-side proxy to avoid CORS restrictions when called from the browser
  const isClient = typeof window !== "undefined";
  const baseUrl = isClient ? "" : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  const url = `${baseUrl}/api/aniskip/${malId}/${episodeNumber}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 400 means episode not found in database - expected, not an error
    // 404 means no data available - expected, not an error
    if (response.status === 400 || response.status === 404) {
      return { found: false, results: [], message: null };
    }

    if (!response.ok) {
      // Only log for unexpected errors (500, etc.)
      if (response.status >= 500) {
        console.warn(`AniSkip API error: ${response.status}`);
      }
      return { found: false, results: [], message: null };
    }

    let result;
    try {
      result = await response.json();
    } catch {
      return { found: false, results: [], message: null };
    }
    return result;
  } catch (error) {
    // Silently handle network errors and timeouts
    return { found: false, results: [], message: null };
  }
}

/**
 * Parse AniSkip results into intro/outro timestamps
 */
function parseSkipResults(results: SkipResult[]): IntroOutroTimestamps {
  const timestamps: IntroOutroTimestamps = {};

  for (const result of results) {
    const { startTime, endTime } = result.interval;
    const skipType = result.skipType;

    // Opening/intro types
    if (skipType === "op" || skipType === "mixed-op") {
      if (!timestamps.intro || startTime < timestamps.intro.start) {
        timestamps.intro = { start: Math.floor(startTime), end: Math.ceil(endTime) };
      }
    }

    // Ending/outro types
    if (skipType === "ed" || skipType === "mixed-ed") {
      // For outros, use the last one (closest to end)
      if (!timestamps.outro || endTime > timestamps.outro.end) {
        timestamps.outro = { start: Math.floor(startTime), end: Math.ceil(endTime) };
      }
    }

    // Recap types
    if (skipType === "recap") {
      if (!timestamps.recap || startTime < timestamps.recap.start) {
        timestamps.recap = { start: Math.floor(startTime), end: Math.ceil(endTime) };
      }
    }
  }

  return timestamps;
}

/**
 * Get intro/outro timestamps for an episode
 * Priority: Custom > Cache > AniSkip API > Defaults
 */
export async function getIntroOutroTimestamps(
  malId: number,
  episodeNumber: number,
  animeId?: number,
  options?: {
    types?: SkipType[];
    episodeLength?: number;
    skipCache?: boolean;
  }
): Promise<IntroOutroTimestamps> {
  // 1. Check custom timestamps first (user overrides)
  if (animeId) {
    const custom = getCustomTimestamps(animeId, episodeNumber);
    if (custom && (custom.intro || custom.outro)) {
      return custom;
    }
  }

  // 2. Check cache
  if (!options?.skipCache) {
    const cached = getCachedTimestamps(malId, episodeNumber);
    if (cached && (cached.intro || cached.outro)) {
      return cached;
    }
  }

  // 3. Fetch from AniSkip API
  const response = await fetchSkipTimes(malId, episodeNumber, options);

  if (response.found && response.results.length > 0) {
    const timestamps = parseSkipResults(response.results);

    // Cache the results
    setCachedTimestamps(malId, episodeNumber, timestamps);

    return timestamps;
  }

  // 4. Return empty object if no data found
  return {};
}

/**
 * Get estimated intro/outro times based on episode duration
 * Falls back to typical anime patterns if no exact data available
 */
export function getEstimatedTimestamps(episodeDuration?: number): IntroOutroTimestamps {
  // Most anime follow similar patterns:
  // - Intro: 60-90 seconds starting around 60-90 seconds in
  // - Outro: 60-90 seconds starting 60-90 seconds before end

  const duration = episodeDuration || 1440; // Default 24 minutes

  return {
    intro: { start: 85, end: 170 }, // Typical OP
    outro: { start: duration - 90, end: duration - 5 }, // Typical ED
  };
}

/**
 * Batch fetch timestamps for multiple episodes
 */
export async function batchFetchTimestamps(
  malId: number,
  episodeNumbers: number[],
  options?: {
    types?: SkipType[];
    episodeLength?: number;
  }
): Promise<Map<number, IntroOutroTimestamps>> {
  const results = new Map<number, IntroOutroTimestamps>();

  // Check cache first for all episodes
  const uncached: number[] = [];

  for (const ep of episodeNumbers) {
    const cached = getCachedTimestamps(malId, ep);
    if (cached && (cached.intro || cached.outro)) {
      results.set(ep, cached);
    } else {
      uncached.push(ep);
    }
  }

  // Fetch uncached episodes in batches with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const fetchPromises = batch.map(async (ep) => {
      const timestamps = await getIntroOutroTimestamps(malId, ep, undefined, {
        ...options,
        skipCache: true,
      });
      return { episode: ep, timestamps };
    });

    const fetched = await Promise.allSettled(fetchPromises);

    for (const result of fetched) {
      if (result.status === "fulfilled") {
        results.set(result.value.episode, result.value.timestamps);
      }
    }
  }

  return results;
}

/**
 * Clear all AniSkip cache
 */
export function clearAniSkipCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Silently fail
  }
}
