/**
 * Hybrid Stream Manager
 *
 * Phase 4: Hybrid Fallback System
 * Manages fallback between HLS (direct) and WebTorrent streaming methods
 *
 * Features:
 * - Try primary method first (user-selected)
 * - Fall back to secondary on failure
 * - Timeout thresholds: WebTorrent (30s), HLS (15s)
 * - Smart fallback based on seed count and source availability
 * - Manual override support via settings
 *
 * Phase 9: Analytics tracking integrated
 */

// ===================================
// Types
// ===================================

export type StreamingMethod = "hls" | "webtorrent" | "hybrid";

export interface VideoQuality {
  url: string;
  quality: "360p" | "480p" | "720p" | "1080p" | "auto";
  label: string;
  size?: string;
}

export interface StreamSource {
  type: "magnet" | "torrent" | "direct";
  url: string;
  qualities?: VideoQuality[];
  referer?: string;
  provider?: string;
  seeders?: number; // For torrents
}

export interface HybridStreamOptions {
  primaryMethod: StreamingMethod;
  animeId: number;
  episodeNumber: number;
  language: "sub" | "dub";
  animeTitle?: string;
  malId?: number | null;
  timeoutWebTorrent?: number; // Default: 30s
  timeoutHLS?: number; // Default: 15s
  onFallback?: (from: StreamingMethod, to: StreamingMethod, reason: string) => void;
}

export interface HybridStreamResult {
  source: StreamSource | null;
  method: StreamingMethod;
  fallbackOccurred: boolean;
  fallbackReason?: string;
  error?: Error;
}

// ===================================
// Constants
// ===================================

const DEFAULT_TIMEOUT_WEBTORRENT = 30000; // 30 seconds
const DEFAULT_TIMEOUT_HLS = 15000; // 15 seconds
const MIN_SEED_THRESHOLD = 3; // Minimum seeds for WebTorrent to be viable

// ===================================
// Analytics (Phase 9)
// ===================================

let analyticsEnabled = false;
let fallbackStartTime = 0;

export function enableAnalytics() {
  analyticsEnabled = true;
}

export function disableAnalytics() {
  analyticsEnabled = false;
}

// ===================================
// Hybrid Stream Manager
// ===================================

class HybridStreamManagerImpl {
  private activeAttempts: Map<string, AbortController> = new Map();
  private static instance: HybridStreamManagerImpl;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): HybridStreamManagerImpl {
    if (!HybridStreamManagerImpl.instance) {
      HybridStreamManagerImpl.instance = new HybridStreamManagerImpl();
    }
    return HybridStreamManagerImpl.instance;
  }

  // ===================================
  // Public API
  // ===================================

  /**
   * Load video source using hybrid fallback strategy
   */
  async loadStream(options: HybridStreamOptions): Promise<HybridStreamResult> {
    const {
      primaryMethod,
      animeId,
      episodeNumber,
      language,
      animeTitle,
      malId,
      timeoutWebTorrent = DEFAULT_TIMEOUT_WEBTORRENT,
      timeoutHLS = DEFAULT_TIMEOUT_HLS,
      onFallback,
    } = options;

    const attemptKey = `${animeId}-${episodeNumber}-${language}`;

    // Cancel any existing attempt for this episode
    this.cancelAttempt(attemptKey);

    // Create abort controller for this attempt
    const abortController = new AbortController();
    this.activeAttempts.set(attemptKey, abortController);

    try {
      // Determine primary and secondary methods
      const methods = this.getMethodOrder(primaryMethod);
      const [primary, secondary] = methods;

      logger.info(
        `[HybridStream] Loading stream for anime ${animeId} episode ${episodeNumber}`,
        { primary, secondary, language }
      );

      // Track playback start (Phase 9)
      if (analyticsEnabled) {
        try {
          const { trackPlaybackStart } = require("./analytics-integration");
          trackPlaybackStart({
            animeId,
            animeTitle: animeTitle || `Anime ${animeId}`,
            episode: episodeNumber,
            method: primary,
            quality: "auto",
            sourceProvider: primary,
          });
        } catch (error) {
          console.error("Failed to track playback start:", error);
        }
      }

      fallbackStartTime = Date.now();

      // Try primary method first
      const primaryResult = await this.tryMethod(
        primary,
        { animeId, episodeNumber, language, animeTitle, malId },
        primary === "webtorrent" ? timeoutWebTorrent : timeoutHLS,
        abortController.signal as AbortSignal | undefined
      );

      if (primaryResult.success && primaryResult.source) {
        // Check if we should fallback due to low seed count
        if (primary === "webtorrent" && primaryResult.seeders !== undefined) {
          if (primaryResult.seeders < MIN_SEED_THRESHOLD) {
            const timeToFallback = Date.now() - fallbackStartTime;
            logger.warn(
              `[HybridStream] WebTorrent has low seed count (${primaryResult.seeders}), falling back to HLS`
            );
            onFallback?.("webtorrent", "hls", `Low seed count (${primaryResult.seeders} < ${MIN_SEED_THRESHOLD})`);

            // Track fallback event (Phase 9)
            if (analyticsEnabled) {
              try {
                const { trackFallback } = require("./analytics-integration");
                trackFallback({
                  animeId,
                  animeTitle: animeTitle || `Anime ${animeId}`,
                  episode: episodeNumber,
                  fromMethod: "webtorrent",
                  toMethod: "hls",
                  reason: `Low seed count (${primaryResult.seeders} < ${MIN_SEED_THRESHOLD})`,
                  timeToFallback,
                });
              } catch (error) {
                console.error("Failed to track fallback:", error);
              }
            }

            const fallbackResult = await this.tryMethod(
              "hls",
              { animeId, episodeNumber, language, animeTitle, malId },
              timeoutHLS,
              abortController.signal as AbortSignal | undefined
            );

            if (fallbackResult.success && fallbackResult.source) {
              return {
                source: fallbackResult.source,
                method: "hls",
                fallbackOccurred: true,
                fallbackReason: `WebTorrent had low seed count (${primaryResult.seeders})`,
              };
            }
          }
        }

        return {
          source: primaryResult.source,
          method: primary,
          fallbackOccurred: false,
        };
      }

      // Primary method failed, try secondary
      if (secondary) {
        const timeToFallback = Date.now() - fallbackStartTime;
        logger.warn(
          `[HybridStream] Primary method (${primary}) failed: ${primaryResult.error?.message}`,
          "Falling back to secondary method"
        );
        onFallback?.(
          primary,
          secondary,
          primaryResult.error?.message || "Primary method failed"
        );

        // Track fallback event (Phase 9)
        if (analyticsEnabled) {
          try {
            const { trackFallback } = require("./analytics-integration");
            trackFallback({
              animeId,
              animeTitle: animeTitle || `Anime ${animeId}`,
              episode: episodeNumber,
              fromMethod: primary,
              toMethod: secondary,
              reason: primaryResult.error?.message || "Primary method failed",
              timeToFallback,
            });
          } catch (error) {
            console.error("Failed to track fallback:", error);
          }
        }

        const secondaryResult = await this.tryMethod(
          secondary,
          { animeId, episodeNumber, language, animeTitle, malId },
          secondary === "webtorrent" ? timeoutWebTorrent : timeoutHLS,
          abortController.signal as AbortSignal | undefined
        );

        if (secondaryResult.success && secondaryResult.source) {
          return {
            source: secondaryResult.source,
            method: secondary,
            fallbackOccurred: true,
            fallbackReason: primaryResult.error?.message || "Primary method failed",
          };
        }
      }

      // Both methods failed
      return {
        source: null,
        method: primary,
        fallbackOccurred: false,
        error: new Error(
          `All streaming methods failed. Primary: ${primaryResult.error?.message}, ` +
          `Secondary: ${secondary ? "Failed" : "N/A"}`
        ),
      };
    } finally {
      // Clean up abort controller
      this.activeAttempts.delete(attemptKey);
    }
  }

  /**
   * Cancel an ongoing stream load attempt
   */
  cancelAttempt(attemptKey: string): void {
    const controller = this.activeAttempts.get(attemptKey);
    if (controller) {
      controller.abort();
      this.activeAttempts.delete(attemptKey);
      logger.info(`[HybridStream] Cancelled attempt: ${attemptKey}`);
    }
  }

  /**
   * Cancel all ongoing attempts
   */
  cancelAllAttempts(): void {
    for (const [key, controller] of this.activeAttempts.entries()) {
      controller.abort();
    }
    this.activeAttempts.clear();
    logger.info("[HybridStream] Cancelled all attempts");
  }

  // ===================================
  // Private Methods
  // ===================================

  /**
   * Determine method order based on user preference
   */
  private getMethodOrder(preferred: StreamingMethod): [StreamingMethod, StreamingMethod | null] {
    if (preferred === "hybrid") {
      // Hybrid mode: Try WebTorrent first (faster if available), fallback to HLS
      return ["webtorrent", "hls"];
    }
    if (preferred === "webtorrent") {
      return ["webtorrent", "hls"];
    }
    // preferred === "hls" or "direct"
    return ["hls", "webtorrent"];
  }

  /**
   * Try to load stream using a specific method
   */
  private async tryMethod(
    method: StreamingMethod,
    params: {
      animeId: number;
      episodeNumber: number;
      language: "sub" | "dub";
      animeTitle?: string;
      malId?: number | null;
    },
    timeout: number,
    abortSignal: AbortSignal | undefined
  ): Promise<{ success: boolean; source?: StreamSource; error?: Error; seeders?: number }> {
    const { animeId, episodeNumber, language, animeTitle, malId } = params;

    try {
      if (method === "hls") {
        return await this.tryHLS(animeId, episodeNumber, language, timeout, abortSignal, animeTitle, malId);
      } else if (method === "webtorrent") {
        return await this.tryWebTorrent(animeId, episodeNumber, language, timeout, abortSignal, animeTitle, malId);
      }
      return { success: false, error: new Error(`Unknown streaming method: ${method}`) };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[HybridStream] Method ${method} failed:`, err.message);
      return { success: false, error: err };
    }
  }

  /**
   * Try HLS (direct) streaming method
   */
  private async tryHLS(
    animeId: number,
    episodeNumber: number,
    language: "sub" | "dub",
    timeout: number,
    signal: AbortSignal | undefined,
    animeTitle?: string,
    malId?: number | null
  ): Promise<{ success: boolean; source?: StreamSource; error?: Error }> {
    const url = new URL(`/api/video-sources/${animeId}/${episodeNumber}`, window.location.origin);

    if (animeTitle) {
      url.searchParams.set("title", animeTitle);
    }
    if (malId) {
      url.searchParams.set("malId", malId.toString());
    }
    url.searchParams.set("language", language);

    logger.info(`[HybridStream] Trying HLS: ${url.toString()}`);

    try {
      const response = await this.fetchWithTimeout(url.toString(), timeout, signal);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Episode not found in HLS sources");
        }
        throw new Error(`HLS API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.sources || data.sources.length === 0) {
        throw new Error("No HLS sources available");
      }

      // Convert to StreamSource format
      const source: StreamSource = {
        type: "direct",
        url: data.sources[0].url,
        qualities: data.sources.map((s: any) => ({
          url: s.url,
          quality: s.quality,
          label: s.label || s.quality,
          size: s.size,
        })),
        referer: data.referer,
        provider: data.provider,
      };

      logger.info(`[HybridStream] HLS success, provider: ${data.provider}`);

      return { success: true, source };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === "AbortError") {
        throw err;
      }
      logger.warn(`[HybridStream] HLS failed: ${err.message}`);
      return { success: false, error: err };
    }
  }

  /**
   * Try WebTorrent streaming method
   */
  private async tryWebTorrent(
    animeId: number,
    episodeNumber: number,
    language: "sub" | "dub",
    timeout: number,
    signal: AbortSignal | undefined,
    animeTitle?: string,
    malId?: number | null
  ): Promise<{ success: boolean; source?: StreamSource; error?: Error; seeders?: number }> {
    const url = new URL(`/api/torrent-sources/${animeId}/${episodeNumber}`, window.location.origin);

    if (animeTitle) {
      url.searchParams.set("title", animeTitle);
    }
    if (malId) {
      url.searchParams.set("malId", malId.toString());
    }
    url.searchParams.set("language", language);

    logger.info(`[HybridStream] Trying WebTorrent: ${url.toString()}`);

    try {
      const response = await this.fetchWithTimeout(url.toString(), timeout, signal);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Episode not found in torrent sources");
        }
        throw new Error(`Torrent API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.sources || data.sources.length === 0) {
        throw new Error("No torrent sources available");
      }

      // Get the best torrent (highest seed count)
      const bestTorrent = data.sources.reduce((best: any, current: any) =>
        (current.seeders || 0) > (best.seeders || 0) ? current : best
      );

      if (!bestTorrent || bestTorrent.seeders === 0) {
        throw new Error("No torrents with active seeders found");
      }

      // Convert to StreamSource format
      const source: StreamSource = {
        type: "magnet",
        url: bestTorrent.magnet,
        provider: bestTorrent.provider,
        seeders: bestTorrent.seeders,
        qualities: data.sources.map((s: any) => ({
          url: s.magnet,
          quality: s.quality,
          label: `${s.quality} (${s.seeders} seeders)`,
        })),
      };

      logger.info(
        `[HybridStream] WebTorrent success, provider: ${bestTorrent.provider}, seeders: ${bestTorrent.seeders}`
      );

      return { success: true, source, seeders: bestTorrent.seeders };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === "AbortError") {
        throw err;
      }
      logger.warn(`[HybridStream] WebTorrent failed: ${err.message}`);
      return { success: false, error: err, seeders: 0 };
    }
  }

  /**
   * Fetch with timeout and abort signal support
   */
  private async fetchWithTimeout(
    url: string,
    timeout: number,
    signal: AbortSignal | undefined
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine abort signals
    if (signal) {
      signal.addEventListener("abort", () => {
        controller.abort();
        clearTimeout(timeoutId);
      });
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Get recommended streaming method based on network conditions
   */
  getRecommendedMethod(): StreamingMethod {
    if (typeof navigator === "undefined") return "hls";

    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } })
      .connection;

    // If data saver is on, use HLS (more predictable bandwidth)
    if (conn?.saveData) {
      return "hls";
    }

    // On slow connections, prefer HLS (faster initial load)
    if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") {
      return "hls";
    }

    // On 3g and above, try hybrid (WebTorrent first for speed)
    return "hybrid";
  }
}

// ===================================
// Logger (simple client-side logger)
// ===================================

const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`[HybridStreamManager] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[HybridStreamManager] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[HybridStreamManager] ${message}`, ...args);
  },
};

// ===================================
// Export singleton instance
// ===================================

export const hybridStreamManager = HybridStreamManagerImpl.getInstance();

// ===================================
// Export convenience functions
// ===================================

export async function loadStream(options: HybridStreamOptions): Promise<HybridStreamResult> {
  return hybridStreamManager.loadStream(options);
}

export function cancelStreamAttempt(attemptKey: string): void {
  hybridStreamManager.cancelAttempt(attemptKey);
}

export function cancelAllStreamAttempts(): void {
  hybridStreamManager.cancelAllAttempts();
}

export function getRecommendedStreamingMethod(): StreamingMethod {
  return hybridStreamManager.getRecommendedMethod();
}
