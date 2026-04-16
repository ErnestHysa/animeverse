/**
 * DASH Stream Manager
 *
 * Phase 10: DASH Streaming Support
 * Provides alternative to HLS with better adaptive bitrate
 *
 * Features:
 * - DASH manifest fetching and parsing
 * - Integration with existing video source system
 * - Fallback to HLS if DASH unavailable
 * - Quality selection and management
 */

import type { DASHQuality } from "@/components/player/dash-player";
import { createScopedLogger } from '@/lib/logger';
const logger = createScopedLogger('DASHStreamManager');

// ===================================
// Types
// ===================================

export interface DASHSource {
  type: "dash";
  manifestUrl: string;
  qualities?: DASHQuality[];
  provider: string;
  location?: string;
}

export interface DASHStreamOptions {
  animeId: number;
  episodeNumber: number;
  language: "sub" | "dub";
  animeTitle?: string;
  malId?: number | null;
  timeout?: number;
}

export interface DASHStreamResult {
  source: DASHSource | null;
  error?: Error;
}

// ===================================
// Constants
// ===================================

const DEFAULT_TIMEOUT = 15000; // 15 seconds

// ===================================
// DASH Stream Manager
// ===================================

class DASHStreamManagerImpl {
  private static instance: DASHStreamManagerImpl;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): DASHStreamManagerImpl {
    if (!DASHStreamManagerImpl.instance) {
      DASHStreamManagerImpl.instance = new DASHStreamManagerImpl();
    }
    return DASHStreamManagerImpl.instance;
  }

  /**
   * Load DASH stream for an episode
   */
  async loadDASHStream(options: DASHStreamOptions): Promise<DASHStreamResult> {
    const {
      animeId,
      episodeNumber,
      language,
      animeTitle,
      malId,
      timeout = DEFAULT_TIMEOUT,
    } = options;

    try {
      logger.info(`Loading DASH stream for anime ${animeId} episode ${episodeNumber}`);

      // Try to get DASH source from API
      const source = await this.fetchDASHSource(animeId, episodeNumber, language, animeTitle, malId, timeout);

      if (!source) {
        throw new Error("No DASH source available");
      }

      logger.info(`DASH stream loaded successfully: ${source.provider}`);

      return { source };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[DASHStreamManager] Failed to load DASH stream:`, err);
      return { source: null, error: err };
    }
  }

  /**
   * Fetch DASH source from API
   */
  private async fetchDASHSource(
    animeId: number,
    episodeNumber: number,
    language: "sub" | "dub",
    animeTitle: string | undefined,
    malId: number | null | undefined,
    timeout: number
  ): Promise<DASHSource | null> {
    const url = new URL(`/api/video-sources/${animeId}/${episodeNumber}`, window.location.origin);

    if (animeTitle) {
      url.searchParams.set("title", animeTitle);
    }
    if (malId) {
      url.searchParams.set("malId", malId.toString());
    }
    url.searchParams.set("language", language);
    url.searchParams.set("format", "dash"); // Request DASH format

    try {
      const response = await this.fetchWithTimeout(url.toString(), timeout);

      if (!response.ok) {
        if (response.status === 404) {
          logger.info(`Episode not found`);
          return null;
        }
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if DASH source is available
      if (!data.dashSources || data.dashSources.length === 0) {
        logger.info(`No DASH sources available`);
        return null;
      }

      // Get the best DASH source
      const bestSource = data.dashSources[0];

      return {
        type: "dash",
        manifestUrl: bestSource.manifestUrl,
        qualities: bestSource.qualities,
        provider: bestSource.provider || "unknown",
        location: bestSource.location,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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
   * Check if DASH is supported in the current browser
   */
  isDASHSupported(): boolean {
    if (typeof window === "undefined") return false;

    // Check if Media Source Extensions are available
    if (!window.MediaSource || !window.MediaSource.isTypeSupported) {
      return false;
    }

    // Check if MP4 is supported
    const video = document.createElement("video");
    if (video.canPlayType("application/dash+xml") !== "") {
      return true;
    }

    // Check if MSE with MP4 is supported
    if (window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
      return true;
    }

    return false;
  }

  /**
   * Convert HLS source to DASH (if needed)
   * This is a placeholder for future implementation
   */
  async convertHLSToDASH(hlsUrl: string): Promise<string | null> {
    // This would require server-side conversion
    // For now, return null to indicate conversion is not available
    console.warn("[DASHStreamManager] HLS to DASH conversion not implemented");
    return null;
  }
}

// ===================================
// Export singleton instance
// ===================================

export const dashStreamManager = DASHStreamManagerImpl.getInstance();

// ===================================
// Export convenience functions
// ===================================

export async function loadDASHStream(options: DASHStreamOptions): Promise<DASHStreamResult> {
  return dashStreamManager.loadDASHStream(options);
}

export function isDASHSupported(): boolean {
  return dashStreamManager.isDASHSupported();
}

export async function convertHLSToDASH(hlsUrl: string): Promise<string | null> {
  return dashStreamManager.convertHLSToDASH(hlsUrl);
}
