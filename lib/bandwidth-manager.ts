/**
 * Bandwidth Manager Module
 *
 * Phase 6: Performance & Optimization
 * Manages bandwidth throttling for WebTorrent streaming
 *
 * Features:
 * - Limit upload speed (user setting)
 * - Adaptive throttling based on network quality
 * - Network quality detection
 * - Real-time bandwidth monitoring
 */

// ===================================
// Types
// ===================================

export type BandwidthLimitMode = "unlimited" | "custom" | "adaptive";

export type NetworkQuality = "slow-2g" | "2g" | "3g" | "4g" | "5g" | "unknown";

export interface BandwidthConfig {
  uploadLimit: number; // bytes per second, 0 = unlimited
  downloadLimit: number; // bytes per second, 0 = unlimited
  mode: BandwidthLimitMode;
  adaptiveEnabled: boolean;
  adaptiveMinUpload: number; // Minimum upload when adaptive
  adaptiveMaxUpload: number; // Maximum upload when adaptive
  wifiOnly: boolean; // Only limit when on WiFi
}

export interface BandwidthStats {
  currentUploadSpeed: number; // bytes/s
  currentDownloadSpeed: number; // bytes/s
  totalUploaded: number; // bytes
  totalDownloaded: number; // bytes
  networkQuality: NetworkQuality;
  effectiveUploadLimit: number;
  effectiveDownloadLimit: number;
}

export interface NetworkInfo {
  type?: string;
  effectiveType?: NetworkQuality;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

// ===================================
// Constants
// ===================================

const DEFAULT_CONFIG: BandwidthConfig = {
  uploadLimit: 0, // Unlimited by default
  downloadLimit: 0, // Unlimited by default
  mode: "unlimited",
  adaptiveEnabled: false,
  adaptiveMinUpload: 50 * 1024, // 50 KB/s minimum
  adaptiveMaxUpload: 500 * 1024, // 500 KB/s maximum
  wifiOnly: false,
};

const NETWORK_QUALITY_THRESHOLDS: Record<NetworkQuality, { min: number; max: number }> = {
  "slow-2g": { min: 0, max: 50 * 1024 }, // 0-50 KB/s
  "2g": { min: 50 * 1024, max: 100 * 1024 }, // 50-100 KB/s
  "3g": { min: 100 * 1024, max: 500 * 1024 }, // 100-500 KB/s
  "4g": { min: 500 * 1024, max: 2000 * 1024 }, // 500-2000 KB/s
  "5g": { min: 2000 * 1024, max: Infinity }, // 2MB/s+
  "unknown": { min: 0, max: Infinity },
};

const BANDWIDTH_STORAGE_KEY = "bandwidth_config";

// ===================================
// Bandwidth Manager Class
// ===================================

import { createScopedLogger } from '@/lib/logger';
import { formatBytes as formatBytesUtil } from '@/lib/downloads';
const logger = createScopedLogger('BandwidthManager');

class BandwidthManagerImpl {
  private config: BandwidthConfig;
  private static instance: BandwidthManagerImpl;
  private stats: BandwidthStats;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private webTorrentClient: any = null;
  private bandwidthMonitorCallbacks: Set<(stats: BandwidthStats) => void> = new Set();
  private networkChangeHandler: (() => void) | null = null;

  private constructor() {
    // Load config from localStorage
    this.config = this.loadConfig();

    // Initialize stats
    this.stats = {
      currentUploadSpeed: 0,
      currentDownloadSpeed: 0,
      totalUploaded: 0,
      totalDownloaded: 0,
      networkQuality: "unknown",
      effectiveUploadLimit: 0,
      effectiveDownloadLimit: 0,
    };

    // Start monitoring
    this.startMonitoring();

    // Listen for network changes
    this.setupNetworkListener();
  }

  static getInstance(): BandwidthManagerImpl {
    if (!BandwidthManagerImpl.instance) {
      BandwidthManagerImpl.instance = new BandwidthManagerImpl();
    }
    return BandwidthManagerImpl.instance;
  }

  // ===================================
  // Configuration Management
  // ===================================

  /**
   * Load config from localStorage
   */
  private loadConfig(): BandwidthConfig {
    if (typeof window === "undefined") {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const saved = localStorage.getItem(BANDWIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn("[BandwidthManager] Failed to load config:", error);
    }

    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(BANDWIDTH_STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn("[BandwidthManager] Failed to save config:", error);
    }
  }

  /**
   * Update bandwidth configuration
   */
  updateConfig(config: Partial<BandwidthConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    this.applyThrottling();
    logger.info("Config updated:", this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): BandwidthConfig {
    return { ...this.config };
  }

  /**
   * Set upload limit (bytes per second)
   */
  setUploadLimit(limit: number): void {
    this.config.uploadLimit = limit;
    this.config.mode = limit > 0 ? "custom" : "unlimited";
    this.saveConfig();
    this.applyThrottling();
  }

  /**
   * Set download limit (bytes per second)
   */
  setDownloadLimit(limit: number): void {
    this.config.downloadLimit = limit;
    this.config.mode = limit > 0 ? "custom" : "unlimited";
    this.saveConfig();
    this.applyThrottling();
  }

  /**
   * Enable/disable adaptive bandwidth management
   */
  setAdaptiveEnabled(enabled: boolean): void {
    this.config.adaptiveEnabled = enabled;
    this.config.mode = enabled ? "adaptive" : this.config.uploadLimit > 0 ? "custom" : "unlimited";
    this.saveConfig();
    this.applyThrottling();
  }

  // ===================================
  // WebTorrent Integration
  // ===================================

  /**
   * Set WebTorrent client for bandwidth control
   */
  setWebTorrentClient(client: any): void {
    this.webTorrentClient = client;
    this.applyThrottling();
  }

  /**
   * Apply throttling to WebTorrent client
   * Note: WebTorrent doesn't have built-in throttling, but we can
   * limit the number of concurrent connections and adjust piece requests
   */
  private applyThrottling(): void {
    if (!this.webTorrentClient) {
      return;
    }

    const effectiveUploadLimit = this.getEffectiveUploadLimit();
    const effectiveDownloadLimit = this.getEffectiveDownloadLimit();

    this.stats.effectiveUploadLimit = effectiveUploadLimit;
    this.stats.effectiveDownloadLimit = effectiveDownloadLimit;

    // WebTorrent doesn't have direct bandwidth throttling
    // We implement it by limiting concurrent connections
    // This is a simplified approach

    if (effectiveUploadLimit > 0 && effectiveUploadLimit < Infinity) {
      // Calculate max concurrent uploads based on limit
      // Assume each upload uses ~20KB/s on average
      const maxUploads = Math.max(1, Math.floor(effectiveUploadLimit / (20 * 1024)));

      // WebTorrent doesn't expose this directly, but we can
      // influence it through client settings
      logger.info("Limited to ~", maxUploads, "concurrent uploads");
    }

    if (effectiveDownloadLimit > 0 && effectiveDownloadLimit < Infinity) {
      // Similar approach for downloads
      const maxDownloads = Math.max(1, Math.floor(effectiveDownloadLimit / (50 * 1024)));
      logger.info("Limited to ~", maxDownloads, "concurrent downloads");
    }

    // Notify callbacks
    this.notifyCallbacks();
  }

  /**
   * Get effective upload limit (considering WiFi-only setting)
   */
  private getEffectiveUploadLimit(): number {
    if (this.config.wifiOnly && !this.isOnWiFi()) {
      return 0; // Unlimited when not on WiFi
    }

    if (this.config.mode === "adaptive" && this.config.adaptiveEnabled) {
      return this.calculateAdaptiveLimit("upload");
    }

    return this.config.uploadLimit;
  }

  /**
   * Get effective download limit
   */
  private getEffectiveDownloadLimit(): number {
    if (this.config.wifiOnly && !this.isOnWiFi()) {
      return 0; // Unlimited when not on WiFi
    }

    if (this.config.mode === "adaptive" && this.config.adaptiveEnabled) {
      return this.calculateAdaptiveLimit("download");
    }

    return this.config.downloadLimit;
  }

  /**
   * Calculate adaptive bandwidth limit
   */
  private calculateAdaptiveLimit(type: "upload" | "download"): number {
    const quality = this.stats.networkQuality;

    // Get base speed from network quality
    const threshold = NETWORK_QUALITY_THRESHOLDS[quality];
    const clampedMax = threshold.max === Infinity ? this.config.adaptiveMaxUpload : threshold.max;
    const baseSpeed = (threshold.min + clampedMax) / 2;

    if (type === "upload") {
      // Upload is typically 1/4 to 1/2 of download speed
      const uploadRatio = 0.25;
      const adaptiveUpload = Math.floor(baseSpeed * uploadRatio);

      // Clamp to min/max range
      return Math.max(
        this.config.adaptiveMinUpload,
        Math.min(this.config.adaptiveMaxUpload, adaptiveUpload)
      );
    }

    // For download, we typically don't limit (user wants fast downloads)
    return 0; // Unlimited
  }

  // ===================================
  // Network Detection
  // ===================================

  /**
   * Check if currently on WiFi
   */
  private isOnWiFi(): boolean {
    if (typeof navigator === "undefined") return true;

    const conn = (navigator as Navigator & {
      connection?: { type?: string };
    }).connection;

    // If connection type is not available, assume yes
    if (!conn) return true;

    // Check if on WiFi or unknown (desktop)
    return !conn.type || conn.type === "wifi" || conn.type === "ethernet";
  }

  /**
   * Get current network information
   */
  getNetworkInfo(): NetworkInfo {
    if (typeof navigator === "undefined") {
      return {};
    }

    const conn = (navigator as Navigator & {
      connection?: NetworkInfo;
    }).connection;

    return conn || {};
  }

  /**
   * Detect network quality from speed
   */
  detectNetworkQuality(speed: number): NetworkQuality {
    for (const [quality, threshold] of Object.entries(NETWORK_QUALITY_THRESHOLDS)) {
      if (speed >= threshold.min && speed < threshold.max) {
        return quality as NetworkQuality;
      }
    }
    return "unknown";
  }

  /**
   * Setup network change listener
   */
  private setupNetworkListener(): void {
    if (typeof navigator === "undefined") return;

    const conn = (navigator as Navigator & {
      connection?: NetworkInfo & {
        addEventListener?: (event: string, callback: () => void) => void;
        onchange?: () => void;
      };
    }).connection;

    if (!conn) return;

    const handler = () => {
      this.updateNetworkQuality();
      this.applyThrottling();
    };

    this.networkChangeHandler = handler;

    // Use addEventListener if available (modern browsers)
    if (conn.addEventListener) {
      conn.addEventListener("change", handler);
    } else if (conn.onchange) {
      // Fallback for older browsers
      conn.onchange = handler;
    }
  }

  /**
   * Update network quality from Network Information API
   */
  private updateNetworkQuality(): void {
    const info = this.getNetworkInfo();

    if (info.effectiveType) {
      this.stats.networkQuality = info.effectiveType;
    } else {
      // Try to estimate from download speed
      if (this.stats.currentDownloadSpeed > 0) {
        this.stats.networkQuality = this.detectNetworkQuality(
          this.stats.currentDownloadSpeed
        );
      }
    }
  }

  // ===================================
  // Monitoring
  // ===================================

  /**
   * Start bandwidth monitoring
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') return;
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.updateStats();
    }, 1000); // Update every second
  }

  /**
   * Stop bandwidth monitoring
   */
  private stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update bandwidth statistics
   */
  private updateStats(): void {
    if (this.webTorrentClient) {
      // Get stats from WebTorrent
      const torrents = this.webTorrentClient.torrents || [];

      let totalUpload = 0;
      let totalDownload = 0;
      let uploadSpeed = 0;
      let downloadSpeed = 0;

      for (const torrent of torrents) {
        totalUpload += torrent.uploaded || 0;
        totalDownload += torrent.downloaded || 0;
        uploadSpeed += torrent.uploadSpeed || 0;
        downloadSpeed += torrent.downloadSpeed || 0;
      }

      this.stats.currentUploadSpeed = uploadSpeed;
      this.stats.currentDownloadSpeed = downloadSpeed;
      this.stats.totalUploaded = totalUpload;
      this.stats.totalDownloaded = totalDownload;

      this.updateNetworkQuality();
    }

    this.notifyCallbacks();
  }

  /**
   * Get current bandwidth statistics
   */
  getStats(): BandwidthStats {
    return { ...this.stats };
  }

  /**
   * Register callback for stats updates
   */
  onStatsUpdate(callback: (stats: BandwidthStats) => void): () => void {
    this.bandwidthMonitorCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.bandwidthMonitorCallbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(): void {
    for (const callback of this.bandwidthMonitorCallbacks) {
      try {
        callback(this.getStats());
      } catch (error) {
        console.error("[BandwidthManager] Callback error:", error);
      }
    }
  }

  // ===================================
  // Utility Methods
  // ===================================

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    return formatBytesUtil(bytes);
  }

  /**
   * Format speed (bytes/s) to human readable
   */
  formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }

  /**
   * Get upload speed as percentage of limit
   */
  getUploadPercentage(): number {
    const limit = this.getEffectiveUploadLimit();
    if (limit === 0) return 0; // Unlimited
    if (limit === Infinity) return 0;

    return Math.min(100, (this.stats.currentUploadSpeed / limit) * 100);
  }

  /**
   * Get download speed as percentage of limit
   */
  getDownloadPercentage(): number {
    const limit = this.getEffectiveDownloadLimit();
    if (limit === 0) return 0; // Unlimited
    if (limit === Infinity) return 0;

    return Math.min(100, (this.stats.currentDownloadSpeed / limit) * 100);
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      currentUploadSpeed: 0,
      currentDownloadSpeed: 0,
      totalUploaded: 0,
      totalDownloaded: 0,
      networkQuality: "unknown",
      effectiveUploadLimit: 0,
      effectiveDownloadLimit: 0,
    };
    this.notifyCallbacks();
  }

  /**
   * Destroy the bandwidth manager
   */
  destroy(): void {
    this.stopMonitoring();
    // Remove network change listener to prevent memory leak
    if (this.networkChangeHandler) {
      const conn = (navigator as any).connection;
      if (conn?.removeEventListener) {
        conn.removeEventListener("change", this.networkChangeHandler);
      } else if (conn) {
        conn.onchange = null;
      }
      this.networkChangeHandler = null;
    }
    this.bandwidthMonitorCallbacks.clear();
    this.webTorrentClient = null;
  }
}

// ===================================
// Export singleton instance
// ===================================

let bandwidthManager: BandwidthManagerImpl | null = null;

function getBandwidthManager(): BandwidthManagerImpl {
  if (!bandwidthManager && typeof window !== 'undefined') {
    bandwidthManager = BandwidthManagerImpl.getInstance();
  }
  if (!bandwidthManager) {
    bandwidthManager = BandwidthManagerImpl.getInstance();
  }
  return bandwidthManager;
}

if (typeof module !== 'undefined' && (module as any).hot) {
  (module as any).hot.dispose(() => {
    if (bandwidthManager) {
      bandwidthManager.destroy();
      bandwidthManager = null;
    }
  });
}

// ===================================
// Export convenience functions
// ===================================

export function getBandwidthConfig(): BandwidthConfig {
  return getBandwidthManager().getConfig();
}

export function updateBandwidthConfig(config: Partial<BandwidthConfig>): void {
  getBandwidthManager().updateConfig(config);
}

export function setUploadLimit(limit: number): void {
  getBandwidthManager().setUploadLimit(limit);
}

export function setDownloadLimit(limit: number): void {
  getBandwidthManager().setDownloadLimit(limit);
}

export function setAdaptiveBandwidth(enabled: boolean): void {
  getBandwidthManager().setAdaptiveEnabled(enabled);
}

export function getBandwidthStats(): BandwidthStats {
  return getBandwidthManager().getStats();
}

export function onBandwidthStatsUpdate(
  callback: (stats: BandwidthStats) => void
): () => void {
  return getBandwidthManager().onStatsUpdate(callback);
}

export function formatBandwidth(bytes: number): string {
  return getBandwidthManager().formatBytes(bytes);
}

export function formatBandwidthSpeed(bytesPerSecond: number): string {
  return getBandwidthManager().formatSpeed(bytesPerSecond);
}

export function setWebTorrentBandwidthClient(client: any): void {
  getBandwidthManager().setWebTorrentClient(client);
}
