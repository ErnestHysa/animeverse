/**
 * Analytics Types
 * Types for streaming analytics and monitoring
 *
 * Phase 9: Monitoring & Analytics
 */

export type StreamingMethod = "hls" | "webtorrent" | "hybrid";

const VALID_METHODS = ["hls", "webtorrent", "hybrid"] as const;

/**
 * Normalize a streaming method value from the store (which may use "direct")
 * to the canonical analytics/internal value ("hls").
 */
export function normalizeStreamingMethod(method: string): StreamingMethod {
  if (method === "direct") return "hls";
  if (VALID_METHODS.includes(method as typeof VALID_METHODS[number])) return method as StreamingMethod;
  return "hls"; // safe fallback
}

export interface StreamingEvent {
  id: string;
  timestamp: number;
  animeId: number;
  animeTitle: string;
  episode: number;
  userId?: string; // Optional user tracking
  sessionId: string;
}

export interface PlaybackStartEvent extends StreamingEvent {
  eventType: "playback_start";
  method: StreamingMethod;
  quality: string;
  sourceProvider: string;
  userAgent: string;
  connectionType: "wifi" | "cellular" | "unknown";
}

export interface PlaybackEndEvent extends StreamingEvent {
  eventType: "playback_end";
  method: StreamingMethod;
  duration: number; // seconds watched
  completionRate: number; // 0-1
  reasons: string[];
}

export interface FallbackEvent extends StreamingEvent {
  eventType: "fallback";
  fromMethod: StreamingMethod;
  toMethod: StreamingMethod;
  reason: string;
  timeToFallback: number; // milliseconds
}

export interface BufferingEvent extends StreamingEvent {
  eventType: "buffering";
  method: StreamingMethod;
  bufferDuration: number; // milliseconds
  currentTime: number; // video timestamp
}

export interface TorrentStatsEvent extends StreamingEvent {
  eventType: "torrent_stats";
  seeders: number;
  leechers: number;
  downloadSpeed: number; // bytes per second
  uploadSpeed: number; // bytes per second
  progress: number; // 0-1
  infoHash: string;
}

export interface QualityChangeEvent extends StreamingEvent {
  eventType: "quality_change";
  method: StreamingMethod;
  fromQuality: string;
  toQuality: string;
  reason: string;
}

export interface PlaybackErrorEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  eventType: "playback_error";
  animeId: number;
  episode: number;
  error: string;
  source: string;
}

export type AnalyticsEvent =
  | PlaybackStartEvent
  | PlaybackEndEvent
  | FallbackEvent
  | BufferingEvent
  | TorrentStatsEvent
  | QualityChangeEvent
  | PlaybackErrorEvent;

export interface AnalyticsSummary {
  totalStreams: number;
  methodDistribution: Record<StreamingMethod, number>;
  averageWatchTime: number;
  totalBandwidthSaved: number; // bytes
  fallbackRate: number; // 0-1
  deadTorrentRate: number; // 0-1
  averageSeederCount: number;
  averageBufferTime: number; // milliseconds
  topAnime: Array<{ animeId: number; animeTitle: string; streams: number }>;
}

export interface SeedServerStatus {
  online: boolean;
  activeTorrents: number;
  totalPeers: number;
  uploadSpeed: number; // bytes per second
  uptime: number; // seconds
  lastHeartbeat: number;
  version: string;
}

export interface Alert {
  id: string;
  type: "high_fallback_rate" | "seed_server_down" | "dead_torrent" | "low_seed_count";
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface BandwidthSavings {
  period: "hour" | "day" | "week" | "month";
  totalBytes: number;
  p2pBytes: number;
  cdnBytes: number;
  savingsPercent: number;
  costSavings: number; // USD (estimated)
  streamCount: number;
}

export interface TorrentHealth {
  infoHash: string;
  animeId: number;
  animeTitle: string;
  episode: number;
  seeders: number;
  leechers: number;
  lastChecked: number;
  status: "healthy" | "struggling" | "dead";
  trend: "improving" | "stable" | "declining";
}
