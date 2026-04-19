/**
 * Torrent Finder Module
 * Discovers and validates magnet links for anime episodes
 *
 * Phase 1: Infrastructure setup
 * Phase 2: Implement scrapers for Nyaa.si, Nyaa.land, AniDex
 */

import parseTorrent from "parse-torrent";

// ===================================
// Constants
// ===================================

const SCRAPER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ===================================
// Rate Limiter
// ===================================

const domainRequests: Map<string, number[]> = new Map();
const MIN_INTERVAL_MS = 2000; // 2 seconds between requests to same domain
const MAX_PER_MINUTE = 10;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const domain = new URL(url).hostname;
  let now = Date.now();
  const timestamps = domainRequests.get(domain) || [];
  // Clean old timestamps
  const recent = timestamps.filter(t => now - t < 60000);
  if (recent.length >= MAX_PER_MINUTE) {
    const waitMs = 60000 - (now - recent[0]) + 100;
    await new Promise(r => setTimeout(r, waitMs));
  }
  // Recapture now after any awaits to avoid stale timestamp
  now = Date.now();
  // Check per-request interval
  if (recent.length > 0) {
    const elapsed = now - recent[recent.length - 1];
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
  }
  recent.push(Date.now());
  domainRequests.set(domain, recent);
  return fetch(url, options);
}

// ===================================
// Types
// ===================================

export interface MagnetLink {
  magnet: string;
  infoHash: string;
  title: string;
  quality: string;
  size: number; // bytes
  seeders: number;
  leechers: number;
  provider: string;
  uploadedAt?: number;
}

export interface TorrentSearchResult {
  animeId: number;
  episode: number;
  magnets: MagnetLink[];
  timestamp: number;
}

export interface TorrentDatabaseSchema {
  magnet_links: {
    animeId: number;
    episode: number;
    quality: string;
    magnet_hash: string; // infoHash
    magnet: string;
    seeders: number;
    leechers: number;
    lastChecked: number;
    createdAt: number;
  };
  torrent_sources: {
    id: number;
    provider: string; // nyaa, nyaa-land, anidex, manual
    url: string;
    isActive: boolean;
    lastUsed: number;
  };
}

// ===================================
// Helper Functions
// ===================================

// Cached textarea for decoding HTML entities (avoids creating DOM element on every call)
let _decodeTextarea: HTMLTextAreaElement | null = null;

/**
 * Decode HTML entities (e.g., &amp; -> &)
 */
function decodeHtmlEntities(text: string): string {
  if (typeof document !== 'undefined') {
    if (!_decodeTextarea) {
      _decodeTextarea = document.createElement('textarea');
    }
    _decodeTextarea.innerHTML = text;
    return _decodeTextarea.value;
  }
  // Server-side regex fallback
  return text
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Parse size string (e.g., "1.5 GiB") to bytes
 */
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    kb: 1000,
    mb: 1000 * 1000,
    gb: 1000 * 1000 * 1000,
    tb: 1000 * 1000 * 1000 * 1000,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Retry wrapper for network requests
 * Retries once on network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND) after a 2s delay
 * Does not retry on 4xx HTTP errors
 */
async function withRetry<T>(fn: () => Promise<T>, retries: number = 1, delayMs: number = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isNetworkError =
      error?.code === 'ECONNRESET' ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ECONNREFUSED' ||
      error?.name === 'AbortError' ||
      (error?.message && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('fetch failed')
      ));

    const is4xx = typeof error?.message === 'string' && /HTTP [45]\d\d/.test(error.message);

    if (retries > 0 && isNetworkError && !is4xx) {
      console.log(`[Retry] Network error, retrying in ${delayMs}ms...`, error?.message || error);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return withRetry(fn, retries - 1, delayMs);
    }

    throw error;
  }
}

// ===================================
// Magnet Link Utilities
// ===================================

/**
 * Parse a magnet link and extract metadata
 */
export function parseMagnetLink(magnet: string): {
  infoHash: string;
  title?: string;
  trackers?: string[] | string | undefined;
} | null {
  try {
    const parsed = parseTorrent(magnet);
    if (!parsed || !parsed.infoHash) {
      return null;
    }

    // Handle cases where name might be an array
    const title = parsed.name
      ? typeof parsed.name === "string"
        ? parsed.name
        : Array.isArray(parsed.name)
        ? parsed.name[0]
        : undefined
      : undefined;

    return {
      infoHash: parsed.infoHash,
      title: title || undefined,
      trackers: parsed.announce || undefined,
    };
  } catch (error) {
    console.error("Failed to parse magnet link:", error);
    return null;
  }
}

/**
 * Validate magnet link format
 */
export function isValidMagnetLink(magnet: string): boolean {
  if (!magnet || typeof magnet !== "string") {
    return false;
  }

  // Must start with magnet:?
  if (!magnet.startsWith("magnet:?")) {
    return false;
  }

  // Must contain xt=urn:btih: parameter (supports 40-char hex and 32-char Base32)
  const xtMatch = magnet.match(/xt=urn:btih:([a-zA-Z2-7]{32}|[a-fA-F0-9]{40})/);
  if (!xtMatch) {
    return false;
  }

  return true;
}

/**
 * Normalize quality aliases to a canonical form
 */
const QUALITY_NORMALIZE: Record<string, string> = {
  '4k': '2160p',
  'uhd': '2160p',
  'full hd': '1080p',
  'full.hd': '1080p',
  'fullhd': '1080p',
  'fhd': '1080p',
  'hd': '720p',
  'sd': '480p',
};

/**
 * Extract quality label from torrent title
 */
export function extractQuality(title: string): string {
  const qualityPatterns = [
    /\b(2160p|UHD|4K)\b/i,
    /\b(1080p|Full.?HD|FHD)\b/i,
    /\b(720p|HD)\b/i,
    /\b(480p|SD)\b/i,
    /\b(360p)\b/i,
  ];

  for (const pattern of qualityPatterns) {
    const match = title.match(pattern);
    if (match) {
      const raw = match[1].toLowerCase();
      const normalized = QUALITY_NORMALIZE[raw] || raw;
      return normalized;
    }
  }

  return "unknown";
}

/**
 * Identify fansub group from torrent title
 */
export function extractFansubGroup(title: string): string | null {
  const fansubPatterns = [
    /\[([^\]]+)\]/, // [GroupName]
    /\b(HorribleSubs|Erai-raws|SubsPlease|Commie|FFF|Horizon|Asenshi)\b/i,
  ];

  for (const pattern of fansubPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

// ===================================
// Phase 2: Scraper Functions
// ===================================

/**
 * Scrape Nyaa.si for anime torrents
 * @param animeTitle - Anime title to search
 * @param episode - Episode number
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Array of magnet links with metadata
 */
export async function scrapeNyaa(
  animeTitle: string,
  episode: number,
  maxResults: number = 10,
  outerSignal?: AbortSignal
): Promise<MagnetLink[]> {
  return withRetry(async () => {
  try {
    // Build search query
    const searchQuery = `${animeTitle} episode ${episode}`.replace(/\s+/g, " ");
    const searchUrl = `https://nyaa.si/?q=${encodeURIComponent(searchQuery)}&s=seeders&o=desc`;

    console.log(`[Nyaa.si] Searching: ${searchQuery}`);

    // Fetch the page
    const controller = new AbortController();
    // Abort if either the outer signal or our internal timeout fires
    outerSignal?.addEventListener('abort', () => controller.abort());
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await rateLimitedFetch(searchUrl, {
        headers: {
          "User-Agent": SCRAPER_USER_AGENT,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML and extract torrent data
    const magnets: MagnetLink[] = [];

    // Match torrent rows using a more compatible pattern
    const rows: string[] = [];
    let currentRow = "";
    let inRow = false;

    for (const line of html.split("\n")) {
      if (line.includes('<tr class="default"')) {
        inRow = true;
        currentRow = line;
      } else if (inRow) {
        currentRow += line;
        if (line.includes("</tr>")) {
          rows.push(currentRow);
          inRow = false;
          currentRow = "";
        }
      }
    }

    if (rows.length === 0) {
      console.log(`[Nyaa.si] No results found for: ${searchQuery}`);
      return [];
    }

    // Parse each row
    for (const row of rows.slice(0, maxResults)) {
      // Extract title
      const titleMatch = row.match(
        /<a[^>]*href="\/view\/\d+"[^>]*title="([^"]+)"/
      );
      const title = titleMatch ? titleMatch[1].trim() : "";
      if (!title) continue;

      // Extract magnet link
      const magnetMatch = row.match(/href="(magnet:\?[^"]+)"/);
      if (!magnetMatch) continue;

      const magnet = decodeHtmlEntities(magnetMatch[1]);
      const parsed = parseMagnetLink(magnet);
      if (!parsed) continue;

      // Extract seeders and leechers
      const seedersMatch = row.match(/<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/g);
      const seeders =
        seedersMatch && seedersMatch.length >= 2
          ? parseInt(seedersMatch[seedersMatch.length - 2].replace(/<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/, "$1"))
          : 0;
      const leechers =
        seedersMatch && seedersMatch.length >= 1
          ? parseInt(seedersMatch[seedersMatch.length - 1].replace(/<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/, "$1"))
          : 0;

      // Extract size
      const sizeMatch = row.match(/(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB)/i);
      const size = sizeMatch ? parseSize(sizeMatch[0]) : 0;

      // Extract quality
      const quality = extractQuality(title);

      magnets.push({
        magnet,
        infoHash: parsed.infoHash,
        title,
        quality,
        size,
        seeders,
        leechers,
        provider: "nyaa.si",
      });
    }

    console.log(`[Nyaa.si] Found ${magnets.length} results for: ${searchQuery}`);
    return magnets;
  } catch (error) {
    console.error(`[Nyaa.si] Error scraping:`, error);
    return [];
  }
  });
}

/**
 * Scrape Nyaa.land (mirror) for anime torrents
 * @param animeTitle - Anime title to search
 * @param episode - Episode number
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Array of magnet links with metadata
 */
export async function scrapeNyaaLand(
  animeTitle: string,
  episode: number,
  maxResults: number = 10,
  outerSignal?: AbortSignal
): Promise<MagnetLink[]> {
  return withRetry(async () => {
  try {
    // Nyaa.land is a mirror with the same structure
    const searchQuery = `${animeTitle} episode ${episode}`.replace(/\s+/g, " ");
    const searchUrl = `https://nyaa.land/?q=${encodeURIComponent(searchQuery)}&s=seeders&o=desc`;

    console.log(`[Nyaa.land] Searching: ${searchQuery}`);

    const nyaaLandController = new AbortController();
    // Abort if either the outer signal or our internal timeout fires
    outerSignal?.addEventListener('abort', () => nyaaLandController.abort());
    const nyaaLandTimeoutId = setTimeout(() => nyaaLandController.abort(), 15000);
    let response: Response;
    try {
      response = await rateLimitedFetch(searchUrl, {
        headers: {
          "User-Agent": SCRAPER_USER_AGENT,
        },
        signal: nyaaLandController.signal,
      });
    } finally {
      clearTimeout(nyaaLandTimeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Same parsing logic as Nyaa.si
    const magnets: MagnetLink[] = [];
    const rows: string[] = [];
    let currentRow = "";
    let inRow = false;

    for (const line of html.split("\n")) {
      if (line.includes('<tr class="default"')) {
        inRow = true;
        currentRow = line;
      } else if (inRow) {
        currentRow += line;
        if (line.includes("</tr>")) {
          rows.push(currentRow);
          inRow = false;
          currentRow = "";
        }
      }
    }

    if (rows.length === 0) {
      console.log(`[Nyaa.land] No results found for: ${searchQuery}`);
      return [];
    }

    for (const row of rows.slice(0, maxResults)) {
      const titleMatch = row.match(
        /<a[^>]*href="\/view\/\d+"[^>]*title="([^"]+)"/
      );
      const title = titleMatch ? titleMatch[1].trim() : "";
      if (!title) continue;

      const magnetMatch = row.match(/href="(magnet:\?[^"]+)"/);
      if (!magnetMatch) continue;

      const magnet = decodeHtmlEntities(magnetMatch[1]);
      const parsed = parseMagnetLink(magnet);
      if (!parsed) continue;

      const seedersMatch = row.match(/<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/g);
      const seeders =
        seedersMatch && seedersMatch.length >= 2
          ? parseInt(seedersMatch[seedersMatch.length - 2].replace(/<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/, "$1"))
          : 0;
      const leechers =
        seedersMatch && seedersMatch.length >= 1
          ? parseInt(seedersMatch[seedersMatch.length - 1].replace(/<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/, "$1"))
          : 0;

      const sizeMatch = row.match(/(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB)/i);
      const size = sizeMatch ? parseSize(sizeMatch[0]) : 0;

      const quality = extractQuality(title);

      magnets.push({
        magnet,
        infoHash: parsed.infoHash,
        title,
        quality,
        size,
        seeders,
        leechers,
        provider: "nyaa.land",
      });
    }

    console.log(`[Nyaa.land] Found ${magnets.length} results for: ${searchQuery}`);
    return magnets;
  } catch (error) {
    console.error(`[Nyaa.land] Error scraping:`, error);
    return [];
  }
  });
}

/**
 * Scrape AniDex for anime torrents
 * @param animeTitle - Anime title to search
 * @param episode - Episode number
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Array of magnet links with metadata
 */
export async function scrapeAniDex(
  animeTitle: string,
  episode: number,
  maxResults: number = 10,
  outerSignal?: AbortSignal
): Promise<MagnetLink[]> {
  return withRetry(async () => {
  try {
    // AniDex has different HTML structure
    const searchQuery = `${animeTitle} episode ${episode}`.replace(/\s+/g, " ");
    const searchUrl = `https://anidex.info/?q=${encodeURIComponent(searchQuery)}`;

    console.log(`[AniDex] Searching: ${searchQuery}`);

    const anidexController = new AbortController();
    // Abort if either the outer signal or our internal timeout fires
    outerSignal?.addEventListener('abort', () => anidexController.abort());
    const anidexTimeoutId = setTimeout(() => anidexController.abort(), 15000);
    let response: Response;
    try {
      response = await rateLimitedFetch(searchUrl, {
        headers: {
          "User-Agent": SCRAPER_USER_AGENT,
        },
        signal: anidexController.signal,
      });
    } finally {
      clearTimeout(anidexTimeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    const magnets: MagnetLink[] = [];

    // AniDex structure: Look for torrent entries
    const entries: string[] = [];
    let currentEntry = "";
    let inEntry = false;

    for (const line of html.split("\n")) {
      if (line.includes('<tr') && (line.includes('torrent') || line.includes('table-row') || line.includes('torrent-row'))) {
        inEntry = true;
        currentEntry = line;
      } else if (inEntry) {
        currentEntry += line;
        if (line.includes("</tr>")) {
          entries.push(currentEntry);
          inEntry = false;
          currentEntry = "";
        }
      }
    }

    if (entries.length === 0) {
      console.log(`[AniDex] No results found for: ${searchQuery}`);
      return [];
    }

    for (const entry of entries.slice(0, maxResults)) {
      // Extract title from link
      const titleMatch = entry.match(/<td[^>]*class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
      const title = titleMatch ? titleMatch[1].trim() : "";
      if (!title) continue;

      const magnetMatch = entry.match(/href="(magnet:\?[^"]+)"/);
      if (!magnetMatch) continue;

      const magnet = decodeHtmlEntities(magnetMatch[1]);
      const parsed = parseMagnetLink(magnet);
      if (!parsed) continue;

      // Extract seeders/leechers from AniDex structure
      const seedersMatch = entry.match(/<td[^>]*class="[^"]*seeders?[^"]*"[^>]*>(\d+)<\/td>/);
      const leechersMatch = entry.match(/<td[^>]*class="[^"]*leechers?[^"]*"[^>]*>(\d+)<\/td>/);

      const seeders = seedersMatch ? parseInt(seedersMatch[1]) : 0;
      const leechers = leechersMatch ? parseInt(leechersMatch[1]) : 0;

      const sizeMatch = entry.match(/(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB)/i);
      const size = sizeMatch ? parseSize(sizeMatch[0]) : 0;

      const quality = extractQuality(title);

      magnets.push({
        magnet,
        infoHash: parsed.infoHash,
        title,
        quality,
        size,
        seeders,
        leechers,
        provider: "anidex",
      });
    }

    console.log(`[AniDex] Found ${magnets.length} results for: ${searchQuery}`);
    return magnets;
  } catch (error) {
    console.error(`[AniDex] Error scraping:`, error);
    return [];
  }
  });
}

// ===================================
// Phase 2: DHT Validation
// ===================================

/**
 * Validate magnet link via DHT to check seeders
 * Note: This is a simplified validation. Full DHT requires WebTorrent client.
 * @param magnet - Magnet link to validate
 * @returns Validation result with seeder/leecher counts and video check
 */
export async function validateMagnetViaDHT(magnet: string): Promise<{
  infoHash: string;
  seeders: number;
  leechers: number;
  hasVideo: boolean;
}> {
  const parsed = parseMagnetLink(magnet);
  if (!parsed) {
    return {
      infoHash: "",
      seeders: 0,
      leechers: 0,
      hasVideo: false,
    };
  }

  // Phase 2: Basic validation
  // Full DHT validation requires WebTorrent client which is browser-side
  // For now, we'll validate the magnet link structure and cache it
  // Real seeder/leecher counts will come from the scraper

  console.log(`[DHT Validation] Checking infoHash: ${parsed.infoHash}`);

  // Check if title suggests video content
  const title = parsed.title || "";
  const hasVideo = isVideoTorrent(title);

  return {
    infoHash: parsed.infoHash,
    seeders: 0, // Will be updated by scraper
    leechers: 0, // Will be updated by scraper
    hasVideo,
  };
}

/**
 * Check if torrent is likely to contain video based on title
 */
function isVideoTorrent(title: string): boolean {
  const videoExtensions = [".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"];
  const videoKeywords = [
    "x264",
    "x265",
    "h264",
    "h265",
    "hevc",
    "1080p",
    "720p",
    "480p",
    "webrip",
    "bluray",
    "bd",
  ];

  const titleLower = title.toLowerCase();

  // Check for video file extensions
  for (const ext of videoExtensions) {
    if (titleLower.includes(ext)) {
      return true;
    }
  }

  // Check for video keywords
  for (const keyword of videoKeywords) {
    if (titleLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

// ===================================
// Phase 1: Database Schema (Documentation)
// ===================================

/**
 * Database Schema for Torrent Tracking
 *
 * This will be implemented in Phase 1 with SQLite/PostgreSQL
 *
 * Table: magnet_links
 * - animeId: INTEGER (foreign key to anime)
 * - episode: INTEGER
 * - quality: TEXT (1080p, 720p, 480p)
 * - magnet_hash: TEXT UNIQUE (infoHash from magnet link)
 * - magnet: TEXT (full magnet link)
 * - seeders: INTEGER (cached seeder count)
 * - leechers: INTEGER (cached leecher count)
 * - lastChecked: INTEGER (timestamp)
 * - createdAt: INTEGER (timestamp)
 *
 * Table: torrent_sources
 * - id: INTEGER PRIMARY KEY
 * - provider: TEXT (nyaa, nyaa-land, anidex, manual)
 * - url: TEXT (source URL)
 * - isActive: BOOLEAN
 * - lastUsed: INTEGER (timestamp)
 */

export const TORRENT_DATABASE_SCHEMA = {
  magnet_links: `
    CREATE TABLE IF NOT EXISTS magnet_links (
      animeId INTEGER NOT NULL,
      episode INTEGER NOT NULL,
      quality TEXT NOT NULL,
      magnet_hash TEXT UNIQUE NOT NULL,
      magnet TEXT NOT NULL,
      seeders INTEGER DEFAULT 0,
      leechers INTEGER DEFAULT 0,
      lastChecked INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (animeId, episode, quality)
    );
  `,
  torrent_sources: `
    CREATE TABLE IF NOT EXISTS torrent_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      url TEXT NOT NULL,
      isActive BOOLEAN DEFAULT 1,
      lastUsed INTEGER NOT NULL
    );
  `,
  indexes: `
    CREATE INDEX IF NOT EXISTS idx_magnet_anime_episode ON magnet_links(animeId, episode);
    CREATE INDEX IF NOT EXISTS idx_magnet_quality ON magnet_links(quality);
    CREATE INDEX IF NOT EXISTS idx_magnet_seeders ON magnet_links(seeders DESC);
  `,
} as const;

// ===================================
// Phase 2: Database Cache (File-Based)
// ===================================

// Module-level write lock to prevent TOCTOU race conditions
let cacheWriteLock: Promise<any> = Promise.resolve();

/**
 * Simple file-based cache for magnet links
 * Database path: .data/torrent-cache.json
 */
const CACHE_DIR = ".data";
const CACHE_FILE = `${CACHE_DIR}/torrent-cache.json`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  animeId: number;
  episode: number;
  magnets: MagnetLink[];
  timestamp: number;
}

interface CacheData {
  entries: Record<string, CacheEntry>;
  lastUpdated: number;
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  if (typeof window === "undefined") {
    // Node.js environment
    try {
      const fs = await import('fs');
      const path = await import('path');
      const cachePath = path.join(process.cwd(), CACHE_DIR);
      await fs.promises.mkdir(cachePath, { recursive: true });
    } catch (error) {
      // Silent error handling - directory may already exist
    }
  }
}

/**
 * Load cache from file
 */
async function loadCache(): Promise<CacheData> {
  try {
    if (typeof window !== "undefined") {
      // Browser environment - use localStorage
      const cached = localStorage.getItem("torrent-cache");
      return cached ? JSON.parse(cached) : { entries: {}, lastUpdated: 0 };
    } else {
      // Node.js environment
      const fs = await import('fs');
      const path = await import('path');
      const cachePath = path.join(process.cwd(), CACHE_FILE);
      try {
        const data = await fs.promises.readFile(cachePath, "utf-8");
        return JSON.parse(data);
      } catch {
        // File doesn't exist or can't be read
      }
    }
  } catch (error) {
    console.error("[Cache] Error loading cache:", error);
  }
  return { entries: {}, lastUpdated: 0 };
}

/**
 * Save cache to file
 */
async function saveCache(data: CacheData): Promise<void> {
  try {
    data.lastUpdated = Date.now();
    if (typeof window !== "undefined") {
      // Browser environment - use localStorage
      localStorage.setItem("torrent-cache", JSON.stringify(data));
    } else {
      // Node.js environment
      await ensureCacheDir();
      const fs = await import('fs');
      const path = await import('path');
      const cachePath = path.join(process.cwd(), CACHE_FILE);
      await fs.promises.writeFile(cachePath, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("[Cache] Error saving cache:", error);
  }
}

/**
 * Cache key generator
 */
export function getCacheKey(animeId: number, episode: number): string {
  return `${animeId}-${episode}`;
}

/**
 * Get cached magnet links
 */
export async function getCachedMagnets(
  animeId: number,
  episode: number
): Promise<MagnetLink[] | undefined> {
  const cache = await loadCache();
  const key = getCacheKey(animeId, episode);
  const entry = cache.entries[key];

  if (!entry) {
    return undefined;
  }

  // Check if cache is still valid
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    // Cache expired, remove it
    delete cache.entries[key];
    await saveCache(cache);
    return undefined;
  }

  console.log(`[Cache] HIT for ${key} (${Math.round(age / 1000)}s old)`);
  return entry.magnets;
}

/**
 * Cache magnet links with TTL
 */
export function cacheMagnets(
  animeId: number,
  episode: number,
  magnets: MagnetLink[]
): void {
  cacheWriteLock = cacheWriteLock.then(async () => {
    const cache = await loadCache();
    const key = getCacheKey(animeId, episode);

    cache.entries[key] = {
      animeId,
      episode,
      magnets,
      timestamp: Date.now(),
    };

    await saveCache(cache);
    console.log(`[Cache] STORED ${key} with ${magnets.length} magnets`);

    // Clean up old entries
    await cleanupOldCache(cache);
  }).catch((err) => {
    console.error('[Cache] Error in cacheMagnets:', err);
  });
}

/**
 * Clean up old cache entries
 */
async function cleanupOldCache(cache: CacheData): Promise<void> {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of Object.entries(cache.entries)) {
    const age = now - entry.timestamp;
    // Delete entries older than 1 hour
    if (age > 60 * 60 * 1000) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    delete cache.entries[key];
  }

  if (keysToDelete.length > 0) {
    await saveCache(cache);
    console.log(`[Cache] Cleaned up ${keysToDelete.length} old entries`);
  }
}

/**
 * Clear all cached magnet links
 */
export function clearMagnetCache(): void {
  const cache = { entries: {}, lastUpdated: Date.now() };
  saveCache(cache);
  console.log("[Cache] Cleared all cache");
}

// ===================================
// Phase 1: Main Entry Point
// ===================================

// ===================================
// Phase 2: Main Entry Point with Fallback
// ===================================

/**
 * Find torrent sources for an anime episode
 * @param animeId - Anilist anime ID
 * @param episode - Episode number
 * @param animeTitle - Anime title for searching (optional but recommended)
 * @returns Array of magnet links sorted by seeders (descending)
 */
export async function findTorrentSources(
  animeId: number,
  episode: number,
  animeTitle?: string
): Promise<MagnetLink[]> {
  // Input validation (M1)
  if (!animeTitle || typeof animeTitle !== 'string') return [];
  animeTitle = animeTitle.slice(0, 200).replace(/[<>"'\\]/g, '');
  episode = Math.max(1, Math.floor(Number(episode) || 1));

  // Check cache first
  const cached = await getCachedMagnets(animeId, episode);
  if (cached && cached.length > 0) {
    return cached;
  }

  console.log(`[Torrent] Finding sources for: ${animeTitle} Episode ${episode}`);

  // Try all sources in parallel with timeout, threading AbortController through
  const nyaaController = new AbortController();
  const nyaaLandController = new AbortController();
  const anidexController = new AbortController();

  const results = await Promise.allSettled([
    withTimeout(scrapeNyaa(animeTitle, episode, 10, nyaaController.signal), 15000, nyaaController),
    withTimeout(scrapeNyaaLand(animeTitle, episode, 10, nyaaLandController.signal), 15000, nyaaLandController),
    withTimeout(scrapeAniDex(animeTitle, episode, 10, anidexController.signal), 15000, anidexController),
  ]);

  // Collect all successful results
  const allMagnets: MagnetLink[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allMagnets.push(...result.value);
    }
  }

  // Remove duplicates by infoHash
  const uniqueMagnets = removeDuplicateMagnets(allMagnets);

  // Sort by seeders (descending)
  uniqueMagnets.sort((a, b) => b.seeders - a.seeders);

  // Cache the results
  if (uniqueMagnets.length > 0) {
    cacheMagnets(animeId, episode, uniqueMagnets);
  }

  console.log(
    `[Torrent] Found ${uniqueMagnets.length} unique magnets for ${animeTitle} Episode ${episode}`
  );

  return uniqueMagnets;
}

/**
 * Get torrent sources from multiple providers with fallback
 * @param animeId - Anilist anime ID
 * @param episode - Episode number
 * @param animeTitle - Anime title for searching
 * @returns Torrents with metadata about which sources were used
 */
export async function getTorrentSourcesWithFallback(
  animeId: number,
  episode: number,
  animeTitle?: string
): Promise<{
  torrents: MagnetLink[];
  sources: string[];
  primarySource?: string;
}> {
  const torrents = await findTorrentSources(animeId, episode, animeTitle);

  // Determine which sources contributed
  const sources = new Set<string>();
  torrents.forEach((t) => sources.add(t.provider));

  return {
    torrents,
    sources: Array.from(sources),
    primarySource: torrents.length > 0 ? torrents[0].provider : undefined,
  };
}

/**
 * Remove duplicate magnet links by infoHash
 */
function removeDuplicateMagnets(magnets: MagnetLink[]): MagnetLink[] {
  const seen = new Set<string>();
  const unique: MagnetLink[] = [];

  for (const magnet of magnets) {
    if (!seen.has(magnet.infoHash)) {
      seen.add(magnet.infoHash);
      unique.push(magnet);
    }
  }

  return unique;
}

/**
 * Add timeout to a promise with optional abort controller support
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, abortController?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (abortController) abortController.abort();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
