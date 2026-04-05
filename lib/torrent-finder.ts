/**
 * Torrent Finder Module
 * Discovers and validates magnet links for anime episodes
 *
 * Phase 1: Infrastructure setup
 * Phase 2: Implement scrapers for Nyaa.si, Nyaa.land, AniDex
 */

import parseTorrent from "parse-torrent";

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

  // Must contain xt=urn:btih: parameter
  const xtMatch = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
  if (!xtMatch) {
    return false;
  }

  return true;
}

/**
 * Extract quality label from torrent title
 */
export function extractQuality(title: string): string {
  const qualityPatterns = [
    /\b(2160p|4K)\b/i,
    /\b(1080p|Full.?HD)\b/i,
    /\b(720p|HD)\b/i,
    /\b(480p|SD)\b/i,
    /\b(360p)\b/i,
  ];

  for (const pattern of qualityPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toLowerCase().replace("full.hd", "1080p");
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
// TODO: Phase 2 - Scraper Functions
// ===================================

/**
 * Scrape Nyaa.si for anime torrents
 * TODO: Implement in Phase 2
 */
export async function scrapeNyaa(
  animeTitle: string,
  episode: number
): Promise<MagnetLink[]> {
  // Placeholder for Phase 2 implementation
  console.log(`[Phase 2] Would scrape Nyaa.si for: ${animeTitle} Episode ${episode}`);
  return [];
}

/**
 * Scrape Nyaa.land (mirror) for anime torrents
 * TODO: Implement in Phase 2
 */
export async function scrapeNyaaLand(
  animeTitle: string,
  episode: number
): Promise<MagnetLink[]> {
  // Placeholder for Phase 2 implementation
  console.log(`[Phase 2] Would scrape Nyaa.land for: ${animeTitle} Episode ${episode}`);
  return [];
}

/**
 * Scrape AniDex for anime torrents
 * TODO: Implement in Phase 2
 */
export async function scrapeAniDex(
  animeTitle: string,
  episode: number
): Promise<MagnetLink[]> {
  // Placeholder for Phase 2 implementation
  console.log(`[Phase 2] Would scrape AniDex for: ${animeTitle} Episode ${episode}`);
  return [];
}

// ===================================
// TODO: Phase 2 - DHT Validation
// ===================================

/**
 * Validate magnet link via DHT to check seeders
 * TODO: Implement in Phase 2
 */
export async function validateMagnetViaDHT(magnet: string): Promise<{
  infoHash: string;
  seeders: number;
  leechers: number;
  hasVideo: boolean;
}> {
  // Placeholder for Phase 2 implementation
  console.log(`[Phase 2] Would validate magnet via DHT: ${magnet.substring(0, 50)}...`);
  return {
    infoHash: "",
    seeders: 0,
    leechers: 0,
    hasVideo: false,
  };
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
// Phase 1: Cache Utilities
// ===================================

/**
 * In-memory cache for magnet links (Phase 1)
 * TODO: Replace with database in Phase 1
 */
const magnetCache = new Map<string, TorrentSearchResult>();

/**
 * Cache key generator
 */
export function getCacheKey(animeId: number, episode: number): string {
  return `${animeId}-${episode}`;
}

/**
 * Get cached magnet links
 */
export function getCachedMagnets(
  animeId: number,
  episode: number
): TorrentSearchResult | undefined {
  const key = getCacheKey(animeId, episode);
  return magnetCache.get(key);
}

/**
 * Cache magnet links with 5-minute TTL
 */
export function cacheMagnets(
  animeId: number,
  episode: number,
  magnets: MagnetLink[]
): void {
  const key = getCacheKey(animeId, episode);
  magnetCache.set(key, {
    animeId,
    episode,
    magnets,
    timestamp: Date.now(),
  });

  // Clear cache after 5 minutes
  setTimeout(() => {
    magnetCache.delete(key);
  }, 5 * 60 * 1000);
}

/**
 * Clear all cached magnet links
 */
export function clearMagnetCache(): void {
  magnetCache.clear();
}

// ===================================
// Phase 1: Main Entry Point
// ===================================

/**
 * Find torrent sources for an anime episode
 * Phase 1: Returns empty array (infrastructure only)
 * Phase 2: Will scrape Nyaa and validate via DHT
 */
export async function findTorrentSources(
  animeId: number,
  episode: number,
  animeTitle?: string
): Promise<MagnetLink[]> {
  // Check cache first
  const cached = getCachedMagnets(animeId, episode);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.magnets;
  }

  // TODO: Phase 2 - Implement scraping logic
  // if (animeTitle) {
  //   const results = await Promise.allSettled([
  //     scrapeNyaa(animeTitle, episode),
  //     scrapeNyaaLand(animeTitle, episode),
  //     scrapeAniDex(animeTitle, episode),
  //   ]);
  //
  //   const magnets = results
  //     .filter((r) => r.status === "fulfilled")
  //     .flatMap((r) => r.status === "fulfilled" ? r.value : []);
  //
  //   cacheMagnets(animeId, episode, magnets);
  //   return magnets;
  // }

  return [];
}

/**
 * Get torrent sources from multiple providers with fallback
 * Phase 1: Infrastructure only
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

  return {
    torrents,
    sources: [], // TODO: Phase 2 - Track which sources were queried
    primarySource: undefined, // TODO: Phase 2 - Return primary source
  };
}
