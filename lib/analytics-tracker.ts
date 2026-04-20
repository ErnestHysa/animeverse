/**
 * Analytics Tracker
 * Client-side analytics tracking for streaming events
 *
 * Phase 9: Monitoring & Analytics
 */

import type {
  AnalyticsEvent,
  PlaybackStartEvent,
  PlaybackEndEvent,
  FallbackEvent,
  BufferingEvent,
  TorrentStatsEvent,
  QualityChangeEvent,
  PlaybackErrorEvent,
  StreamingMethod,
} from "@/types/analytics";

const MAX_QUEUE_SIZE = 200;

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

class AnalyticsTracker {
  private sessionId: string;
  private eventQueue: AnalyticsEvent[] = [];
  private batchThreshold = 10; // Send events in batches of 10
  private flushInterval = 30000; // Flush every 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private enabled = true; // Fix H1: enabled flag for opt-out support
  private consecutiveFailures = 0;

  constructor() {
    this.sessionId = generateId();
    this.startFlushTimer();
  }

  /**
   * Fix H1: Enable or disable analytics tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.eventQueue = [];
    }
  }

  private generateSessionId(): string {
    return generateId();
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Schedule next flush with exponential backoff after failures
   */
  private scheduleNextFlush(): void {
    if (this.consecutiveFailures <= 0) return;
    const delay = Math.min(30000, 1000 * 2 ** this.consecutiveFailures);
    setTimeout(() => this.flush(), delay);
  }

  /**
   * Track playback start
   */
  trackPlaybackStart(params: {
    animeId: number;
    animeTitle: string;
    episode: number;
    method: StreamingMethod;
    quality: string;
    sourceProvider: string;
  }): void {
    const event: PlaybackStartEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "playback_start",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      method: params.method,
      quality: params.quality,
      sourceProvider: params.sourceProvider,
      userAgent: this.getUserAgent(),
      connectionType: this.getConnectionType(),
    };

    this.queueEvent(event);
  }

  /**
   * Track playback end
   */
  trackPlaybackEnd(params: {
    animeId: number;
    animeTitle: string;
    episode: number;
    method: StreamingMethod;
    duration: number;
    completionRate: number;
    reasons: string[];
  }): void {
    const event: PlaybackEndEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "playback_end",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      method: params.method,
      duration: params.duration,
      completionRate: params.completionRate,
      reasons: params.reasons,
    };

    this.queueEvent(event);
    this.flush(); // Flush immediately on playback end
  }

  /**
   * Track playback error
   */
  trackPlaybackError(params: {
    animeId: number;
    animeTitle?: string;
    episode: number;
    error: string;
    source?: string;
  }): void {
    const event: PlaybackErrorEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "playback_error",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      error: params.error,
      source: params.source || "unknown",
    };
    this.queueEvent(event);
    this.flush();
  }

  /**
   * Track fallback event
   */
  trackFallback(params: {
    animeId: number;
    animeTitle: string;
    episode: number;
    fromMethod: StreamingMethod;
    toMethod: StreamingMethod;
    reason: string;
    timeToFallback: number;
  }): void {
    const event: FallbackEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "fallback",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      fromMethod: params.fromMethod,
      toMethod: params.toMethod,
      reason: params.reason,
      timeToFallback: params.timeToFallback,
    };

    this.queueEvent(event);
    this.flush(); // Flush immediately for fallback events
  }

  /**
   * Track buffering event
   */
  trackBuffering(params: {
    animeId: number;
    animeTitle: string;
    episode: number;
    method: StreamingMethod;
    bufferDuration: number;
    currentTime: number;
  }): void {
    const event: BufferingEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "buffering",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      method: params.method,
      bufferDuration: params.bufferDuration,
      currentTime: params.currentTime,
    };

    this.queueEvent(event);
  }

  /**
   * Track torrent statistics
   */
  trackTorrentStats(params: {
    animeId: number;
    animeTitle: string;
    episode: number;
    seeders: number;
    leechers: number;
    downloadSpeed: number;
    uploadSpeed: number;
    progress: number;
    infoHash: string;
    p2pBytes?: number;
    cdnBytes?: number;
  }): void {
    const event: TorrentStatsEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "torrent_stats",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      seeders: params.seeders,
      leechers: params.leechers,
      downloadSpeed: params.downloadSpeed,
      uploadSpeed: params.uploadSpeed,
      progress: params.progress,
      infoHash: params.infoHash,
      p2pBytes: params.p2pBytes,
      cdnBytes: params.cdnBytes,
    };

    this.queueEvent(event);
  }

  /**
   * Track quality change
   */
  trackQualityChange(params: {
    animeId: number;
    animeTitle: string;
    episode: number;
    method: StreamingMethod;
    fromQuality: string;
    toQuality: string;
    reason: string;
  }): void {
    const event: QualityChangeEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: "quality_change",
      animeId: params.animeId,
      animeTitle: params.animeTitle,
      episode: params.episode,
      method: params.method,
      fromQuality: params.fromQuality,
      toQuality: params.toQuality,
      reason: params.reason,
    };

    this.queueEvent(event);
  }

  /**
   * Queue event for batch sending
   */
  private queueEvent(event: AnalyticsEvent): void {
    // Fix H1: Respect enabled flag
    if (!this.enabled) return;

    this.eventQueue.push(event);

    // Cap queue size to prevent unbounded memory growth (Fix H4)
    if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
      const dropped = this.eventQueue.length - Math.floor(MAX_QUEUE_SIZE / 2);
      console.warn(`[AnalyticsTracker] Queue overflow: dropping ${dropped} oldest events`);
      this.eventQueue = this.eventQueue.slice(-Math.floor(MAX_QUEUE_SIZE / 2));
    }

    if (this.eventQueue.length >= this.batchThreshold) {
      this.flush();
    }
  }

  /**
   * Flush queued events to server
   */
  private async flush(): Promise<void> {
    // Fix H1: Respect enabled flag
    if (!this.enabled || this.eventQueue.length === 0) {
      return;
    }

    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({ events: eventsToSend }),
      });

      if (!response.ok) {
        // If failed, add events back to queue
        this.eventQueue.unshift(...eventsToSend);
        // Cap queue size on flush failure (Fix H4)
        if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
          this.eventQueue = this.eventQueue.slice(-Math.floor(MAX_QUEUE_SIZE / 2));
        }
        this.consecutiveFailures++;
        this.scheduleNextFlush();
      } else {
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      console.error("Failed to send analytics events:", error);
      // Add events back to queue on error
      this.eventQueue.unshift(...eventsToSend);
      // Cap queue size on flush failure (Fix H4)
      if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
        this.eventQueue = this.eventQueue.slice(-Math.floor(MAX_QUEUE_SIZE / 2));
      }
      this.consecutiveFailures++;
      this.scheduleNextFlush();
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return generateId();
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    if (typeof window !== "undefined") {
      return window.navigator.userAgent;
    }
    return "unknown";
  }

  /**
   * Get connection type (simplified)
   */
  private getConnectionType(): "wifi" | "cellular" | "unknown" {
    if (typeof window !== "undefined" && "connection" in window.navigator) {
      const conn = (window.navigator as any).connection;
      if (conn) {
        return conn.type === "cellular" ? "cellular" : "wifi";
      }
    }
    return "unknown";
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Use sendBeacon for reliable final delivery on page unload
    if (this.eventQueue.length > 0 && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const payload = JSON.stringify({
        events: this.eventQueue,
      });
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/events", blob)) {
        this.eventQueue = [];
      }
    } else {
      // Fallback: fire-and-forget flush
      this.flush().catch(() => {});
    }
  }
}

// Singleton instance
let trackerInstance: AnalyticsTracker | null = null;

export function getAnalyticsTracker(): AnalyticsTracker {
  if (!trackerInstance) {
    trackerInstance = new AnalyticsTracker();
  }
  return trackerInstance;
}

export function destroyAnalyticsTracker(): void {
  if (trackerInstance) {
    trackerInstance.destroy();
    trackerInstance = null;
  }
}

/**
 * Fix H1: Enable or disable analytics tracking globally
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  getAnalyticsTracker().setEnabled(enabled);
}
