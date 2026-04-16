/**
 * P2PML Manager
 *
 * Phase 10: P2P Media Loader Integration
 * Enables P2P segment sharing for HLS streams, reducing CDN costs
 *
 * Features:
 * - Seamless integration with hls.js
 * - Automatic peer discovery via signaling server
 * - Bandwidth sharing reduces CDN costs
 * - Fallback to CDN if no peers available
 * - Works alongside WebTorrent
 */

import Hls from "hls.js";
import { createScopedLogger } from '@/lib/logger';
const logger = createScopedLogger('P2PMLManager');

// ===================================
// Types
// ===================================

/**
 * Minimal interface for the P2PML engine to replace `any` casts.
 * Covers the methods actually used by the manager.
 */
interface P2PMLEngine {
  on(event: string, handler: (...args: unknown[]) => void): void;
  attach(hlsInstance: Hls): void;
  getStats(): { downloadSpeed?: number; uploadSpeed?: number } | null;
  getPeers(): Array<{ id: string; downloadSpeed: number; uploadSpeed: number }> | null;
  destroy(): void;
}

interface P2PMLEngineConstructor {
  HlsJsP2PEngine?: new (engine: unknown) => P2PMLEngine;
  [key: string]: unknown;
}

interface P2PMLEngineCore {
  Engine?: new (config: Record<string, unknown>) => unknown;
  [key: string]: unknown;
}

export interface P2PMLConfig {
  enabled: boolean;
  segmentDuration?: number; // Default: auto-detected
  simultaneousDownloads?: number; // Default: 5
  bufferedSegmentsCount?: number; // Default: 20
  p2pDownloadPriority?: number; // Default: 1 (0-10)
  cdnDownloadPriority?: number; // Default: 0 (0-10)
  useP2POnly?: boolean; // Default: false
  trackerAnnounce?: string[]; // Custom tracker URLs
  webRTCConfig?: RTCConfiguration;
  onPeerConnect?: (peerId: string) => void;
  onPeerDisconnect?: (peerId: string) => void;
  onSegmentDownloaded?: (segment: { bytes: number; source: "p2p" | "cdn" }) => void;
  onSegmentError?: (segment: { url: string; error: Error }) => void;
}

export interface P2PMLStats {
  peersCount: number;
  p2pBytesDownloaded: number;
  p2pBytesUploaded: number;
  cdnBytesDownloaded: number;
  downloadSpeed: number; // bytes per second
  uploadSpeed: number; // bytes per second
  p2pDownloadRatio: number; // 0-1
}

export interface P2PMLManager {
  initialize(hlsInstance: Hls, config: P2PMLConfig): Promise<void>;
  destroy(): void;
  getStats(): P2PMLStats;
  isEnabled(): boolean;
  getPeersInfo(): Array<{ id: string; downloadSpeed: number; uploadSpeed: number }>;
}

// ===================================
// Constants
// ===================================

const DEFAULT_TRACKER_ANNOUNCE = [
  "wss://tracker.btorrent.xyz",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.fastcast.nz",
];

const DEFAULT_CONFIG: Partial<P2PMLConfig> = {
  enabled: true,
  simultaneousDownloads: 5,
  bufferedSegmentsCount: 20,
  p2pDownloadPriority: 1,
  cdnDownloadPriority: 0,
  useP2POnly: false,
  trackerAnnounce: DEFAULT_TRACKER_ANNOUNCE,
};

// ===================================
// P2PML Manager Implementation
// ===================================

class P2PMLManagerImpl implements P2PMLManager {
  private hls: Hls | null = null;
  private p2pml: P2PMLEngine | null = null;
  private config: P2PMLConfig = DEFAULT_CONFIG as P2PMLConfig;
  private initialized = false;
  private stats: P2PMLStats = {
    peersCount: 0,
    p2pBytesDownloaded: 0,
    p2pBytesUploaded: 0,
    cdnBytesDownloaded: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    p2pDownloadRatio: 0,
  };

  /**
   * Initialize P2PML with hls.js instance
   */
  async initialize(hlsInstance: Hls, config: P2PMLConfig): Promise<void> {
    if (this.initialized) {
      console.warn("[P2PMLManager] Already initialized");
      return;
    }

    // Check if running in browser
    if (typeof window === "undefined") {
      console.warn("[P2PMLManager] Not running in browser, skipping P2PML initialization");
      return;
    }

    // Check if P2PML is enabled
    if (!config.enabled) {
      console.info("[P2PMLManager] P2PML disabled by config");
      return;
    }

    try {
      // Dynamically import P2PML modules
      const p2pmlCore = await import("p2p-media-loader-core");
      const p2pmlHls = await import("p2p-media-loader-hlsjs");

      this.hls = hlsInstance;
      this.config = { ...DEFAULT_CONFIG, ...config };

      // Create P2PML engine
      const HlsJsP2PEngine = (p2pmlHls as unknown as P2PMLEngineConstructor).HlsJsP2PEngine!;
      const Engine = (p2pmlCore as unknown as P2PMLEngineCore).Engine!;
      const engine = new HlsJsP2PEngine(
        new Engine({
          segmentDuration: this.config.segmentDuration,
          simultaneousDownloads: this.config.simultaneousDownloads,
          bufferedSegmentsCount: this.config.bufferedSegmentsCount,
          p2pDownloadPriority: this.config.p2pDownloadPriority,
          cdnDownloadPriority: this.config.cdnDownloadPriority,
          useP2POnly: this.config.useP2POnly,
          trackerAnnounce: this.config.trackerAnnounce || DEFAULT_TRACKER_ANNOUNCE,
          webRTCConfig: this.config.webRTCConfig,
        })
      );

      // Attach to hls.js
      engine.attach(this.hls);

      this.p2pml = engine;
      this.initialized = true;

      // Set up event listeners
      this.setupEventListeners();

      console.info("[P2PMLManager] Initialized successfully");
    } catch (error) {
      console.error("[P2PMLManager] Initialization failed:", error);
      // Don't throw - allow fallback to regular HLS
      console.warn("[P2PMLManager] Falling back to regular HLS streaming");
    }
  }

  /**
   * Set up P2PML event listeners
   */
  private setupEventListeners(): void {
    if (!this.p2pml) return;

    // Peer connect event
    this.p2pml.on("on-peer-connect", (peerId: unknown) => {
      logger.info(`Peer connected: ${peerId}`);
      this.stats.peersCount++;
      this.config.onPeerConnect?.(String(peerId));
    });

    // Peer disconnect event
    this.p2pml.on("on-peer-disconnect", (peerId: unknown) => {
      logger.info(`Peer disconnected: ${peerId}`);
      this.stats.peersCount = Math.max(0, this.stats.peersCount - 1);
      this.config.onPeerDisconnect?.(String(peerId));
    });

    // Segment downloaded event
    this.p2pml.on("on-segment-download", (segment: any) => {
      const source = segment.downloadSource === "p2p" ? "p2p" : "cdn";
      const bytes = segment.bytesDownloaded || 0;

      if (source === "p2p") {
        this.stats.p2pBytesDownloaded += bytes;
      } else {
        this.stats.cdnBytesDownloaded += bytes;
      }

      this.updateStats();

      this.config.onSegmentDownloaded?.({ bytes, source });
    });

    // Segment uploaded event
    this.p2pml.on("on-segment-upload", (segment: any) => {
      const bytes = segment.bytesUploaded || 0;
      this.stats.p2pBytesUploaded += bytes;
      this.updateStats();
    });

    // Segment error event
    this.p2pml.on("on-segment-error", (segment: any) => {
      console.error("[P2PMLManager] Segment error:", segment);
      this.config.onSegmentError?.({
        url: segment.url,
        error: new Error(segment.error || "Unknown error"),
      });
    });
  }

  /**
   * Update P2PML statistics
   */
  private updateStats(): void {
    if (!this.p2pml) return;

    const totalBytes = this.stats.p2pBytesDownloaded + this.stats.cdnBytesDownloaded;
    this.stats.p2pDownloadRatio = totalBytes > 0 ? this.stats.p2pBytesDownloaded / totalBytes : 0;

    // Get speed from P2PML engine
    try {
      const engineStats = this.p2pml.getStats();
      if (engineStats) {
        this.stats.downloadSpeed = engineStats.downloadSpeed || 0;
        this.stats.uploadSpeed = engineStats.uploadSpeed || 0;
      }
    } catch (error) {
      // Stats retrieval may fail if engine is in an invalid state
      console.warn('[P2PMLManager] Stats retrieval error:', error);
    }
  }

  /**
   * Get current P2PML statistics
   */
  getStats(): P2PMLStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Check if P2PML is enabled
   */
  isEnabled(): boolean {
    return this.initialized && this.config.enabled;
  }

  /**
   * Get information about connected peers
   */
  getPeersInfo(): Array<{ id: string; downloadSpeed: number; uploadSpeed: number }> {
    if (!this.p2pml) return [];

    try {
      return this.p2pml.getPeers() || [];
    } catch (error) {
      console.error("[P2PMLManager] Failed to get peers info:", error);
      return [];
    }
  }

  /**
   * Destroy P2PML instance
   */
  destroy(): void {
    if (this.p2pml) {
      try {
        this.p2pml.destroy();
      } catch (error) {
        console.error("[P2PMLManager] Error during destroy:", error);
      }
      this.p2pml = null;
    }

    this.hls = null;
    this.initialized = false;
    this.stats = {
      peersCount: 0,
      p2pBytesDownloaded: 0,
      p2pBytesUploaded: 0,
      cdnBytesDownloaded: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      p2pDownloadRatio: 0,
    };

    console.info("[P2PMLManager] Destroyed");
  }
}

// ===================================
// Export singleton instance
// ===================================

export const p2pmlManager = new P2PMLManagerImpl();

// ===================================
// Export convenience functions
// ===================================

export async function initializeP2PML(hlsInstance: Hls, config: P2PMLConfig): Promise<void> {
  return p2pmlManager.initialize(hlsInstance, config);
}

export function destroyP2PML(): void {
  p2pmlManager.destroy();
}

export function getP2PMLStats(): P2PMLStats {
  return p2pmlManager.getStats();
}

export function isP2PMLEnabled(): boolean {
  return p2pmlManager.isEnabled();
}

export function getP2PMLPeersInfo(): Array<{ id: string; downloadSpeed: number; uploadSpeed: number }> {
  return p2pmlManager.getPeersInfo();
}
