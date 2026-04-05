/**
 * Torrent Stream Loader
 * Resolves magnet links and selects the best quality torrent for streaming
 *
 * Phase 3: WebTorrent Player Integration
 * - Resolve magnet to torrent info
 * - Select best quality based on seed count
 * - Handle torrent errors (no seeds, dead torrent)
 */

import type { MagnetLink } from "./torrent-finder";

// ===================================
// Types
// ===================================

export interface TorrentStreamInfo {
  magnet: string;
  infoHash: string;
  title: string;
  quality: string;
  seeders: number;
  leechers: number;
  size: number;
  provider: string;
  fileIndex?: number; // For multi-file torrents
}

export interface TorrentStreamOptions {
  preferredQuality?: "1080p" | "720p" | "480p" | "auto";
  minSeeders?: number;
  maxFileSize?: number; // bytes (default: 5GB)
  allowMultiFile?: boolean;
}

export interface TorrentStreamResult {
  success: boolean;
  stream?: TorrentStreamInfo;
  error?: string;
  alternatives?: TorrentStreamInfo[];
}

// ===================================
// Quality Selection
// ===================================

/**
 * Quality priority weights
 * Higher is better
 */
const QUALITY_WEIGHTS: Record<string, number> = {
  "1080p": 100,
  "720p": 75,
  "480p": 50,
  "360p": 25,
  "unknown": 10,
};

/**
 * Calculate torrent score for selection
 * Considers seed count, quality, and size
 */
function calculateTorrentScore(
  magnet: MagnetLink,
  options: TorrentStreamOptions
): number {
  let score = 0;

  // Seed count is most important (base score)
  score += magnet.seeders * 10;

  // Quality bonus
  score += QUALITY_WEIGHTS[magnet.quality] || QUALITY_WEIGHTS["unknown"];

  // Size penalty (prefer reasonable file sizes)
  const sizeGB = magnet.size / (1024 ** 3);
  if (sizeGB > 5) {
    score -= 20; // Too large
  } else if (sizeGB > 3) {
    score -= 10; // Large but acceptable
  } else if (sizeGB < 0.5) {
    score -= 5; // Too small (likely low quality)
  }

  // Provider reliability bonus
  if (magnet.provider === "nyaa.si") {
    score += 5;
  } else if (magnet.provider === "nyaa.land") {
    score += 3;
  }

  return score;
}

/**
 * Select best quality torrent based on seed count and preferences
 */
export function selectBestTorrent(
  magnets: MagnetLink[],
  options: TorrentStreamOptions = {}
): TorrentStreamResult {
  const {
    preferredQuality = "auto",
    minSeeders = 1,
    maxFileSize = 5 * 1024 ** 3, // 5GB
  } = options;

  // Filter by minimum seeders
  const withSeeders = magnets.filter((m) => m.seeders >= minSeeders);

  if (withSeeders.length === 0) {
    return {
      success: false,
      error: `No torrents found with minimum ${minSeeders} seeders`,
      alternatives: magnets.slice(0, 3).map(toStreamInfo),
    };
  }

  // Filter by file size
  const validSize = withSeeders.filter((m) => m.size <= maxFileSize);

  if (validSize.length === 0) {
    return {
      success: false,
      error: `No torrents found under ${formatBytes(maxFileSize)}`,
      alternatives: withSeeders.slice(0, 3).map(toStreamInfo),
    };
  }

  // If user prefers specific quality, try exact match first
  if (preferredQuality !== "auto") {
    const exactMatch = validSize.filter((m) => m.quality === preferredQuality);

    if (exactMatch.length > 0) {
      // Score exact matches and pick best
      exactMatch.sort((a, b) => calculateTorrentScore(b, options) - calculateTorrentScore(a, options));
      return {
        success: true,
        stream: toStreamInfo(exactMatch[0]),
        alternatives: validSize.slice(0, 5).map(toStreamInfo),
      };
    }
  }

  // No exact match or auto quality: score all and pick best
  const sorted = [...validSize].sort(
    (a, b) => calculateTorrentScore(b, options) - calculateTorrentScore(a, options)
  );

  return {
    success: true,
    stream: toStreamInfo(sorted[0]),
    alternatives: sorted.slice(1, 6).map(toStreamInfo),
  };
}

/**
 * Convert MagnetLink to TorrentStreamInfo
 */
function toStreamInfo(magnet: MagnetLink): TorrentStreamInfo {
  return {
    magnet: magnet.magnet,
    infoHash: magnet.infoHash,
    title: magnet.title,
    quality: magnet.quality,
    seeders: magnet.seeders,
    leechers: magnet.leechers,
    size: magnet.size,
    provider: magnet.provider,
  };
}

// ===================================
// Error Handling
// ===================================

export class TorrentError extends Error {
  constructor(
    message: string,
    public code: "NO_SEEDS" | "DEAD_TORRENT" | "INVALID_MAGNET" | "TIMEOUT" | "UNKNOWN"
  ) {
    super(message);
    this.name = "TorrentError";
  }
}

/**
 * Validate magnet link
 */
export function validateMagnet(magnet: string): { valid: boolean; error?: string } {
  if (!magnet || typeof magnet !== "string") {
    return { valid: false, error: "Magnet link must be a string" };
  }

  if (!magnet.startsWith("magnet:?")) {
    return { valid: false, error: "Invalid magnet link format" };
  }

  // Extract infoHash
  const xtMatch = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
  if (!xtMatch) {
    return { valid: false, error: "No valid infoHash found in magnet link" };
  }

  return { valid: true };
}

/**
 * Check if torrent is likely dead
 */
export function isTorrentDead(magnet: MagnetLink): boolean {
  // No seeders
  if (magnet.seeders === 0) {
    return true;
  }

  // Very old with no seeders
  if (magnet.uploadedAt && Date.now() - magnet.uploadedAt > 365 * 24 * 60 * 60 * 1000) {
    return magnet.seeders < 3;
  }

  return false;
}

/**
 * Analyze torrent quality based on metadata
 */
export function analyzeTorrentQuality(magnet: MagnetLink): {
  quality: "excellent" | "good" | "fair" | "poor";
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // Seed count check
  if (magnet.seeders >= 50) {
    score += 3;
    reasons.push("High seed count");
  } else if (magnet.seeders >= 10) {
    score += 2;
    reasons.push("Good seed count");
  } else if (magnet.seeders >= 3) {
    score += 1;
    reasons.push("Low seed count");
  } else {
    reasons.push("Very low seed count");
  }

  // Quality check
  if (magnet.quality === "1080p") {
    score += 2;
  } else if (magnet.quality === "720p") {
    score += 1;
  }

  // Size check (reasonable size for quality)
  const sizeGB = magnet.size / (1024 ** 3);
  if (magnet.quality === "1080p" && sizeGB >= 1 && sizeGB <= 4) {
    score += 1;
    reasons.push("Good size for quality");
  } else if (magnet.quality === "720p" && sizeGB >= 0.5 && sizeGB <= 2.5) {
    score += 1;
    reasons.push("Good size for quality");
  }

  // Provider check
  if (magnet.provider === "nyaa.si") {
    score += 1;
  }

  // Determine overall quality
  let quality: "excellent" | "good" | "fair" | "poor";
  if (score >= 6) {
    quality = "excellent";
  } else if (score >= 4) {
    quality = "good";
  } else if (score >= 2) {
    quality = "fair";
  } else {
    quality = "poor";
  }

  return { quality, reasons };
}

// ===================================
// Utilities
// ===================================

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Get quality fallback chain
 * e.g., if 1080p not available, try 720p, then 480p
 */
export function getQualityFallback(preferredQuality: string): string[] {
  const fallbacks: Record<string, string[]> = {
    "1080p": ["1080p", "720p", "480p", "360p", "unknown"],
    "720p": ["720p", "480p", "360p", "unknown", "1080p"],
    "480p": ["480p", "360p", "unknown", "720p", "1080p"],
    "360p": ["360p", "unknown", "480p", "720p", "1080p"],
    "auto": ["1080p", "720p", "480p", "360p", "unknown"],
  };

  return fallbacks[preferredQuality] || fallbacks["auto"];
}

/**
 * Find best alternative torrent
 */
export function findAlternative(
  magnets: MagnetLink[],
  currentInfoHash: string,
  options: TorrentStreamOptions = {}
): TorrentStreamInfo | null {
  const alternatives = magnets.filter((m) => m.infoHash !== currentInfoHash);
  const result = selectBestTorrent(alternatives, options);

  return result.stream || null;
}

// ===================================
// Main Loading Function
// ===================================

/**
 * Load torrent stream with intelligent selection and fallback
 */
export async function loadTorrentStream(
  magnets: MagnetLink[],
  options: TorrentStreamOptions = {}
): Promise<TorrentStreamResult> {
  // Validate input
  if (!magnets || magnets.length === 0) {
    return {
      success: false,
      error: "No torrents provided",
    };
  }

  // Validate magnet links
  const validMagnets = magnets.filter((m) => validateMagnet(m.magnet).valid);

  if (validMagnets.length === 0) {
    return {
      success: false,
      error: "No valid magnet links found",
    };
  }

  // Select best torrent
  const result = selectBestTorrent(validMagnets, options);

  if (!result.success) {
    return result;
  }

  // Validate torrent is not dead
  if (result.stream && isTorrentDead(result.stream as any)) {
    return {
      success: false,
      error: "Selected torrent appears to be dead (no seeds)",
      alternatives: result.alternatives,
    };
  }

  return result;
}

// ===================================
// Quality Selector Component Props
// ===================================

export interface TorrentQualityOption {
  quality: string;
  seeders: number;
  leechers: number;
  size: number;
  infoHash: string;
  magnet: string;
  title: string;
  provider: string;
}

/**
 * Group torrents by quality for selector UI
 */
export function groupTorrentsByQuality(magnets: MagnetLink[]): Map<string, TorrentQualityOption[]> {
  const groups = new Map<string, TorrentQualityOption[]>();

  for (const magnet of magnets) {
    const option: TorrentQualityOption = {
      quality: magnet.quality,
      seeders: magnet.seeders,
      leechers: magnet.leechers,
      size: magnet.size,
      infoHash: magnet.infoHash,
      magnet: magnet.magnet,
      title: magnet.title,
      provider: magnet.provider,
    };

    const existing = groups.get(magnet.quality) || [];
    existing.push(option);
    groups.set(magnet.quality, existing);
  }

  // Sort each group by seeders (descending)
  for (const [quality, options] of groups.entries()) {
    options.sort((a, b) => b.seeders - a.seeders);
  }

  return groups;
}
