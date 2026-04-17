/**
 * Torrent Preloader Module
 *
 * Phase 6: Performance & Optimization
 * Handles background preloading of next episodes for instant playback
 *
 * Features:
 * - Start downloading next episode in background
 * - Cache first 100MB of next episode
 * - Smart preloading based on user behavior
 * - Automatic cleanup of unused preload data
 */

// ===================================
// Types
// ===================================

export interface PreloadTask {
  animeId: number;
  episodeNumber: number;
  magnet: string;
  infoHash: string;
  progress: number; // 0-1
  downloadedBytes: number;
  targetBytes: number; // Default: 100MB
  status: "pending" | "downloading" | "completed" | "error" | "cancelled";
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface PreloadConfig {
  enabled: boolean;
  preloadThreshold: number; // seconds remaining in current episode to trigger preload
  targetBytes: number; // bytes to preload (default: 100MB)
  maxConcurrentPreloads: number;
  cleanupAfter: number; // milliseconds to keep completed preloads
  wifiOnly: boolean; // only preload when on WiFi
}

export interface PreloadProgress {
  taskId: string;
  progress: number; // 0-1
  downloadedBytes: number;
  targetBytes: number;
  downloadSpeed: number; // bytes/s
  eta: number; // seconds
}

// ===================================
// Constants
// ===================================

const DEFAULT_PRELOAD_THRESHOLD = 120; // 2 minutes remaining
const DEFAULT_TARGET_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_CONCURRENT_PRELOADS = 2;
const CLEANUP_AFTER = 30 * 60 * 1000; // 30 minutes
const PRELOAD_STORAGE_KEY = "torrent_preloads";

// ===================================
// Torrent Preloader Class
// ===================================

class TorrentPreloaderImpl {
  private tasks: Map<string, PreloadTask> = new Map();
  private webTorrentClient: any = null;
  private activeTorrents: Map<string, any> = new Map();
  private config: PreloadConfig;
  private static instance: TorrentPreloaderImpl;
  private progressCallbacks: Map<string, (progress: PreloadProgress) => void> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      preloadThreshold: config.preloadThreshold ?? DEFAULT_PRELOAD_THRESHOLD,
      targetBytes: config.targetBytes ?? DEFAULT_TARGET_BYTES,
      maxConcurrentPreloads: config.maxConcurrentPreloads ?? MAX_CONCURRENT_PRELOADS,
      cleanupAfter: config.cleanupAfter ?? CLEANUP_AFTER,
      wifiOnly: config.wifiOnly ?? true,
    };

    // Load saved config from localStorage
    this.loadConfig();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  static getInstance(config?: Partial<PreloadConfig>): TorrentPreloaderImpl {
    if (!TorrentPreloaderImpl.instance) {
      TorrentPreloaderImpl.instance = new TorrentPreloaderImpl(config);
    }
    return TorrentPreloaderImpl.instance;
  }

  // ===================================
  // Configuration
  // ===================================

  /**
   * Update preloader configuration
   */
  updateConfig(config: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): PreloadConfig {
    return { ...this.config };
  }

  /**
   * Load config from localStorage
   */
  private loadConfig(): void {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem("torrent_preloader_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch (error) {
      console.warn("[TorrentPreloader] Failed to load config:", error);
    }
  }

  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem("torrent_preloader_config", JSON.stringify(this.config));
    } catch (error) {
      console.warn("[TorrentPreloader] Failed to save config:", error);
    }
  }

  // ===================================
  // WebTorrent Client Management
  // ===================================

  /**
   * Initialize WebTorrent client for preloading
   * Note: This runs in the browser, requires WebTorrent library
   */
  async initializeClient(): Promise<void> {
    if (this.webTorrentClient) {
      return;
    }

    try {
      // Dynamic import of WebTorrent (browser-side)
      const WebTorrent = (await import("webtorrent")).default;
      this.webTorrentClient = new WebTorrent({
        dht: true,
        tracker: true,
        webSeeds: true,
      });

      console.log("[TorrentPreloader] WebTorrent client initialized");
    } catch (error) {
      console.error("[TorrentPreloader] Failed to initialize WebTorrent:", error);
      throw new Error("WebTorrent library not available. Please ensure webtorrent is installed.");
    }
  }

  /**
   * Destroy WebTorrent client
   */
  destroyClient(): void {
    if (this.webTorrentClient) {
      this.webTorrentClient.destroy();
      this.webTorrentClient = null;
      this.activeTorrents.clear();
      console.log("[TorrentPreloader] WebTorrent client destroyed");
    }
  }

  // ===================================
  // Preload Task Management
  // ===================================

  /**
   * Check if preloading should be enabled based on network conditions
   */
  private shouldPreload(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Check WiFi-only setting
    if (this.config.wifiOnly && typeof navigator !== "undefined") {
      const conn = (navigator as Navigator & {
        connection?: { type?: string; saveData?: boolean };
      }).connection;

      if (conn?.saveData) {
        return false;
      }

      // Check if on WiFi (when available)
      if (conn?.type && conn.type !== "wifi" && conn.type !== "unknown") {
        // Not on WiFi, skip preload
        return false;
      }
    }

    return true;
  }

  /**
   * Start preloading the next episode
   */
  async preloadNextEpisode(
    animeId: number,
    episodeNumber: number,
    magnet: string,
    infoHash: string,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<string> {
    // Check if preloading is enabled
    if (!this.shouldPreload()) {
      console.log("[TorrentPreloader] Preloading disabled or not on WiFi");
      return "";
    }

    // Check if already preloading
    const existingTask = this.findTask(animeId, episodeNumber);
    if (existingTask) {
      console.log("[TorrentPreloader] Already preloading episode", episodeNumber);
      return existingTask;
    }

    // Check concurrent limit
    const activeCount = Array.from(this.tasks.values()).filter(
      (t) => t.status === "downloading"
    ).length;
    if (activeCount >= this.config.maxConcurrentPreloads) {
      console.log("[TorrentPreloader] Max concurrent preloads reached");
      return "";
    }

    // Initialize WebTorrent client if needed
    if (!this.webTorrentClient) {
      await this.initializeClient();
    }

    // Create task
    const taskId = `preload-${animeId}-${episodeNumber}-${Date.now()}`;
    const task: PreloadTask = {
      animeId,
      episodeNumber,
      magnet,
      infoHash,
      progress: 0,
      downloadedBytes: 0,
      targetBytes: this.config.targetBytes,
      status: "pending",
      startedAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    if (onProgress) {
      this.progressCallbacks.set(taskId, onProgress);
    }

    // Start downloading
    this.startDownload(taskId, task);

    console.log("[TorrentPreloader] Started preloading episode", episodeNumber);
    return taskId;
  }

  /**
   * Start the actual download for a task
   */
  private startDownload(taskId: string, task: PreloadTask): void {
    if (!this.webTorrentClient) {
      this.markTaskError(taskId, "WebTorrent client not initialized");
      return;
    }

    try {
      task.status = "downloading";

      // Add torrent to WebTorrent
      const torrent = this.webTorrentClient.add(task.magnet, {
        path: undefined, // Don't specify path, use default
      });

      this.activeTorrents.set(taskId, torrent);

      // Monitor download progress
      const progressInterval = setInterval(() => {
        if (task.status === "cancelled" || task.status === "error") {
          clearInterval(progressInterval);
          clearTimeout(maxDuration);
          return;
        }

        const downloaded = torrent.downloaded;
        const downloadSpeed = torrent.downloadSpeed;
        const progress = task.targetBytes > 0 ? downloaded / task.targetBytes : 0;

        task.progress = Math.min(progress, 1);
        task.downloadedBytes = downloaded;

        // Notify progress callback
        const callback = this.progressCallbacks.get(taskId);
        if (callback) {
          const eta = downloadSpeed > 0
            ? (task.targetBytes - downloaded) / downloadSpeed
            : 0;

          try {
            callback({
              taskId,
              progress: task.progress,
              downloadedBytes: task.downloadedBytes,
              targetBytes: task.targetBytes,
              downloadSpeed,
              eta,
            });
          } catch (callbackError) {
            console.error("[TorrentPreloader] Progress callback error:", callbackError);
          }
        }

        // Check if target bytes reached
        if (downloaded >= task.targetBytes || torrent.progress === 1) {
          clearInterval(progressInterval);
          clearTimeout(maxDuration);
          this.markTaskCompleted(taskId);
        }
      }, 1000);

      // Max duration timeout to prevent interval leak (M3)
      const maxDuration = setTimeout(() => {
        clearInterval(progressInterval);
        this.markTaskError(taskId, "Preload timed out after 10 minutes");
      }, 600000); // 10 minutes

      // Handle torrent errors
      torrent.on("error", (err: Error) => {
        clearInterval(progressInterval);
        clearTimeout(maxDuration);
        this.markTaskError(taskId, err.message);
      });

      // Handle torrent done
      torrent.on("done", () => {
        clearInterval(progressInterval);
        clearTimeout(maxDuration);
      });

      // Handle torrent ready (metadata received)
      torrent.on("metadata", () => {
        console.log("[TorrentPreloader] Metadata received for", task.infoHash);
      });

    } catch (error) {
      this.markTaskError(taskId, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Mark a task as completed
   */
  private markTaskCompleted(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "completed";
      task.progress = 1;
      task.completedAt = Date.now();
      console.log("[TorrentPreloader] Preload completed for episode", task.episodeNumber);

      // Notify final progress
      const callback = this.progressCallbacks.get(taskId);
      if (callback) {
        callback({
          taskId,
          progress: 1,
          downloadedBytes: task.downloadedBytes,
          targetBytes: task.targetBytes,
          downloadSpeed: 0,
          eta: 0,
        });
      }
    }
  }

  /**
   * Mark a task as errored
   */
  private markTaskError(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "error";
      task.error = error;
      console.error("[TorrentPreloader] Preload failed:", error);

      // Clean up torrent
      const torrent = this.activeTorrents.get(taskId);
      if (torrent) {
        torrent.destroy();
        this.activeTorrents.delete(taskId);
      }
    }
  }

  /**
   * Cancel a preload task
   */
  cancelPreload(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "cancelled";

      // Destroy the torrent
      const torrent = this.activeTorrents.get(taskId);
      if (torrent) {
        torrent.destroy();
        this.activeTorrents.delete(taskId);
      }

      this.progressCallbacks.delete(taskId);
      console.log("[TorrentPreloader] Cancelled preload", taskId);
    }
  }

  /**
   * Cancel all preloads for an anime
   */
  cancelAnimePreloads(animeId: number): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.animeId === animeId) {
        this.cancelPreload(taskId);
      }
    }
  }

  /**
   * Get a preloaded torrent for instant playback
   */
  getPreloadedTorrent(animeId: number, episodeNumber: number): any | null {
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        task.animeId === animeId &&
        task.episodeNumber === episodeNumber &&
        task.status === "completed"
      ) {
        const torrent = this.activeTorrents.get(taskId);
        if (torrent) {
          console.log("[TorrentPreloader] Using preloaded torrent for episode", episodeNumber);
          return torrent;
        }
      }
    }
    return null;
  }

  /**
   * Find task by anime and episode
   */
  private findTask(animeId: number, episodeNumber: number): string | null {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.animeId === animeId && task.episodeNumber === episodeNumber) {
        return taskId;
      }
    }
    return null;
  }

  /**
   * Get all active preload tasks
   */
  getActiveTasks(): PreloadTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "pending" || t.status === "downloading"
    );
  }

  /**
   * Get all completed preload tasks
   */
  getCompletedTasks(): PreloadTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === "completed");
  }

  // ===================================
  // Cleanup
  // ===================================

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run every minute

    console.log("[TorrentPreloader] Cleanup interval started");
  }

  /**
   * Cleanup old completed tasks
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        task.status === "completed" ||
        task.status === "error" ||
        task.status === "cancelled"
      ) {
        const completedAt = task.completedAt ?? task.startedAt;
        if (now - completedAt > this.config.cleanupAfter) {
          toDelete.push(taskId);
        }
      }
    }

    for (const taskId of toDelete) {
      // Destroy torrent if still active
      const torrent = this.activeTorrents.get(taskId);
      if (torrent) {
        torrent.destroy();
        this.activeTorrents.delete(taskId);
      }

      this.tasks.delete(taskId);
      this.progressCallbacks.delete(taskId);
    }

    if (toDelete.length > 0) {
      console.log("[TorrentPreloader] Cleaned up", toDelete.length, "old tasks");
    }
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destroy all tasks and cleanup
   */
  destroy(): void {
    this.stopCleanupInterval();

    // Cancel all tasks
    for (const taskId of this.tasks.keys()) {
      this.cancelPreload(taskId);
    }

    // Destroy WebTorrent client
    this.destroyClient();

    // Clear all data
    this.tasks.clear();
    this.activeTorrents.clear();
    this.progressCallbacks.clear();

    console.log("[TorrentPreloader] Preloader destroyed");
  }

  // ===================================
  // Utility Methods
  // ===================================

  /**
   * Check if an episode is preloaded
   */
  isPreloaded(animeId: number, episodeNumber: number): boolean {
    for (const task of this.tasks.values()) {
      if (
        task.animeId === animeId &&
        task.episodeNumber === episodeNumber &&
        task.status === "completed"
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get preload status for an episode
   */
  getPreloadStatus(animeId: number, episodeNumber: number): PreloadTask | null {
    for (const task of this.tasks.values()) {
      if (task.animeId === animeId && task.episodeNumber === episodeNumber) {
        return { ...task };
      }
    }
    return null;
  }

  /**
   * Calculate estimated preload time
   */
  estimatePreloadTime(bytes: number, speed: number): number {
    if (speed <= 0) return 0;
    return bytes / speed;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes < 0) bytes = 0;
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Get preloader statistics
   */
  getStats(): {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    errorTasks: number;
    totalBytes: number;
  } {
    const tasks = Array.from(this.tasks.values());

    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter((t) => t.status === "downloading").length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      errorTasks: tasks.filter((t) => t.status === "error").length,
      totalBytes: tasks.reduce((sum, t) => sum + t.downloadedBytes, 0),
    };
  }
}

// ===================================
// Export singleton instance
// ===================================

let torrentPreloader: TorrentPreloaderImpl;

if (typeof window !== 'undefined') {
  torrentPreloader = TorrentPreloaderImpl.getInstance();
}

function getTorrentPreloader(): TorrentPreloaderImpl {
  if (!torrentPreloader) {
    torrentPreloader = TorrentPreloaderImpl.getInstance();
  }
  return torrentPreloader;
}

// HMR dispose handler (M5)
if (typeof module !== 'undefined' && (module as any).hot) {
  (module as any).hot.dispose(() => {
    if (torrentPreloader) {
      torrentPreloader.destroy();
    }
  });
}

// ===================================
// Export convenience functions
// ===================================

export async function preloadNextEpisode(
  animeId: number,
  episodeNumber: number,
  magnet: string,
  infoHash: string,
  onProgress?: (progress: PreloadProgress) => void
): Promise<string> {
  return getTorrentPreloader().preloadNextEpisode(animeId, episodeNumber, magnet, infoHash, onProgress);
}

export function cancelPreload(taskId: string): void {
  getTorrentPreloader().cancelPreload(taskId);
}

export function getPreloadedTorrent(animeId: number, episodeNumber: number): any | null {
  return getTorrentPreloader().getPreloadedTorrent(animeId, episodeNumber);
}

export function isPreloaded(animeId: number, episodeNumber: number): boolean {
  return getTorrentPreloader().isPreloaded(animeId, episodeNumber);
}

export function getPreloaderConfig(): PreloadConfig {
  return getTorrentPreloader().getConfig();
}

export function updatePreloaderConfig(config: Partial<PreloadConfig>): void {
  getTorrentPreloader().updateConfig(config);
}
