/**
 * Analytics Integration
 * Integration layer for adding analytics tracking to existing components
 *
 * Phase 9: Monitoring & Analytics
 */

import { getAnalyticsTracker } from "./analytics-tracker";
import type { StreamingMethod } from "./hybrid-stream-manager";

// Track playback start
export function trackPlaybackStart(params: {
  animeId: number;
  animeTitle: string;
  episode: number;
  method: StreamingMethod;
  quality: string;
  sourceProvider: string;
}): void {
  try {
    const tracker = getAnalyticsTracker();
    tracker.trackPlaybackStart({
      animeId: params.animeId,
      animeTitle: params.animeTitle || `Anime ${params.animeId}`,
      episode: params.episode,
      method: params.method,
      quality: params.quality,
      sourceProvider: params.sourceProvider,
    });
  } catch (error) {
    console.error("Failed to track playback start:", error);
  }
}

// Track playback end
export function trackPlaybackEnd(params: {
  animeId: number;
  animeTitle: string;
  episode: number;
  method: StreamingMethod;
  duration: number;
  completionRate: number;
}): void {
  try {
    const tracker = getAnalyticsTracker();
    tracker.trackPlaybackEnd({
      animeId: params.animeId,
      animeTitle: params.animeTitle || `Anime ${params.animeId}`,
      episode: params.episode,
      method: params.method,
      duration: params.duration,
      completionRate: params.completionRate,
      reasons: [],
    });
  } catch (error) {
    console.error("Failed to track playback end:", error);
  }
}

// Track fallback event
export function trackFallback(params: {
  animeId: number;
  animeTitle: string;
  episode: number;
  fromMethod: StreamingMethod;
  toMethod: StreamingMethod;
  reason: string;
  timeToFallback: number;
}): void {
  try {
    const tracker = getAnalyticsTracker();
    tracker.trackFallback({
      animeId: params.animeId,
      animeTitle: params.animeTitle || `Anime ${params.animeId}`,
      episode: params.episode,
      fromMethod: params.fromMethod,
      toMethod: params.toMethod,
      reason: params.reason,
      timeToFallback: params.timeToFallback,
    });
  } catch (error) {
    console.error("Failed to track fallback:", error);
  }
}

// Track buffering event
export function trackBuffering(params: {
  animeId: number;
  animeTitle: string;
  episode: number;
  method: StreamingMethod;
  bufferDuration: number;
  currentTime: number;
}): void {
  try {
    const tracker = getAnalyticsTracker();
    tracker.trackBuffering({
      animeId: params.animeId,
      animeTitle: params.animeTitle || `Anime ${params.animeId}`,
      episode: params.episode,
      method: params.method,
      bufferDuration: params.bufferDuration,
      currentTime: params.currentTime,
    });
  } catch (error) {
    console.error("Failed to track buffering:", error);
  }
}

// Track torrent stats
export function trackTorrentStats(params: {
  animeId: number;
  animeTitle: string;
  episode: number;
  seeders: number;
  leechers: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  infoHash: string;
}): void {
  try {
    const tracker = getAnalyticsTracker();
    tracker.trackTorrentStats({
      animeId: params.animeId,
      animeTitle: params.animeTitle || `Anime ${params.animeId}`,
      episode: params.episode,
      seeders: params.seeders,
      leechers: params.leechers,
      downloadSpeed: params.downloadSpeed,
      uploadSpeed: params.uploadSpeed,
      progress: params.progress,
      infoHash: params.infoHash,
    });
  } catch (error) {
    console.error("Failed to track torrent stats:", error);
  }
}

// Track quality change
export function trackQualityChange(params: {
  animeId: number;
  animeTitle: string;
  episode: number;
  method: StreamingMethod;
  fromQuality: string;
  toQuality: string;
  reason: string;
}): void {
  try {
    const tracker = getAnalyticsTracker();
    tracker.trackQualityChange({
      animeId: params.animeId,
      animeTitle: params.animeTitle || `Anime ${params.animeId}`,
      episode: params.episode,
      method: params.method,
      fromQuality: params.fromQuality,
      toQuality: params.toQuality,
      reason: params.reason,
    });
  } catch (error) {
    console.error("Failed to track quality change:", error);
  }
}
