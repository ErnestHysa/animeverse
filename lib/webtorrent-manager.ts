/**
 * WebTorrent Manager Module
 * Manages WebTorrent client sessions for P2P streaming
 *
 * Phase 1: Infrastructure setup
 * Phase 3: Full player integration
 */

// ===================================
// Types
// ===================================

export interface WebTorrentSession {
  id: string;
  infoHash: string;
  magnet: string;
  isActive: boolean;
  progress: number; // 0-1
  downloadSpeed: number; // bytes/s
  uploadSpeed: number; // bytes/s
  numPeers: number;
  timeRemaining: number; // seconds
  createdAt: number;
}

export interface TorrentFileInfo {
  name: string;
  length: number;
  offset: number;
}

export interface TorrentMetadata {
  infoHash: string;
  name: string;
  files: TorrentFileInfo[];
  length: number;
  pieceLength: number;
  lastPieceLength: number;
  pieces: Buffer;
  created: number;
}

// ===================================
// Phase 1: Mock WebTorrent Manager
// ===================================

/**
 * WebTorrent Manager Class
 *
 * Phase 1: Infrastructure and type definitions
 * Phase 3: Full WebTorrent integration
 *
 * Note: WebTorrent runs in the browser. This server-side module
 * handles metadata and provides helper functions.
 */
class WebTorrentManagerImpl {
  private sessions: Map<string, WebTorrentSession> = new Map();
  private static instance: WebTorrentManagerImpl;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): WebTorrentManagerImpl {
    if (!WebTorrentManagerImpl.instance) {
      WebTorrentManagerImpl.instance = new WebTorrentManagerImpl();
    }
    return WebTorrentManagerImpl.instance;
  }

  // ===================================
  // Session Management
  // ===================================

  /**
   * Create a new WebTorrent session
   * Phase 1: Returns mock session
   * Phase 3: Creates real WebTorrent client
   */
  createSession(magnet: string, infoHash: string): WebTorrentSession {
    const sessionId = `${infoHash}-${Date.now()}`;

    const session: WebTorrentSession = {
      id: sessionId,
      infoHash,
      magnet,
      isActive: true,
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      timeRemaining: 0,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): WebTorrentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session by infoHash
   */
  getSessionByInfoHash(infoHash: string): WebTorrentSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.infoHash === infoHash && session.isActive) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Update session progress
   * Phase 1: Mock implementation
   * Phase 3: Real WebTorrent progress updates
   */
  updateSessionProgress(
    sessionId: string,
    progress: Partial<WebTorrentSession>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, progress);
    }
  }

  /**
   * Destroy a session
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Destroy all sessions
   */
  destroyAllSessions(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      session.isActive = false;
    }
    this.sessions.clear();
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WebTorrentSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.isActive);
  }

  // ===================================
  // Utilities
  // ===================================

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Format seconds to human readable
   */
  formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds === 0) return "Unknown";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
  }

  /**
   * Calculate ETA based on download speed
   */
  calculateETA(
    downloaded: number,
    total: number,
    downloadSpeed: number
  ): number {
    if (downloadSpeed === 0 || total === 0) return 0;

    const remaining = total - downloaded;
    return remaining / downloadSpeed;
  }

  // ===================================
  // TODO: Phase 3 - WebTorrent Integration
  // ===================================

  /**
   * Initialize WebTorrent client
   * Phase 3: Browser-side implementation
   */
  async initializeClient(): Promise<void> {
    // Phase 3: Initialize real WebTorrent client
    console.log("[Phase 3] Would initialize WebTorrent client");
  }

  /**
   * Load torrent from magnet
   * Phase 3: Browser-side implementation
   */
  async loadTorrent(
    magnet: string,
    videoElement: HTMLVideoElement
  ): Promise<void> {
    // Phase 3: Load real torrent via WebTorrent
    console.log("[Phase 3] Would load torrent:", magnet.substring(0, 50));
  }

  /**
   * Get torrent metadata
   * Phase 3: Browser-side implementation
   */
  async getTorrentMetadata(infoHash: string): Promise<TorrentMetadata | null> {
    // Phase 3: Get real torrent metadata
    console.log("[Phase 3] Would get torrent metadata for:", infoHash);
    return null;
  }

  /**
   * Select file from torrent
   * Phase 3: Browser-side implementation
   */
  async selectFile(
    infoHash: string,
    fileIndex: number
  ): Promise<void> {
    // Phase 3: Select real file from torrent
    console.log("[Phase 3] Would select file", fileIndex, "from", infoHash);
  }

  // ===================================
  // Tracker Configuration
  // ===================================

  /**
   * Default WebTorrent trackers
   */
  getDefaultTrackers(): string[] {
    return [
      "wss://tracker.webtorrent.dev",
      "wss://tracker.btorrent.xyz",
      "wss://tracker.openwebtorrent.com",
      "wss://tracker.fastcast.nz",
      "wss://tracker.files.fm:443/announce",
    ];
  }

  /**
   * Build magnet link with custom trackers
   */
  buildMagnetLink(
    infoHash: string,
    title?: string,
    trackers?: string[]
  ): string {
    const xt = `xt=urn:btih:${infoHash}`;
    const dn = title ? `dn=${encodeURIComponent(title)}` : "";
    const tr = (trackers || this.getDefaultTrackers())
      .map((t) => `tr=${encodeURIComponent(t)}`)
      .join("&");

    const parts = [xt, dn, tr].filter(Boolean);
    return `magnet:?${parts.join("&")}`;
  }

  // ===================================
  // Quality Selection
  // ===================================

  /**
   * Select best quality based on seed count
   * Phase 3: Real implementation
   */
  selectBestQuality(magnets: import("./torrent-finder").MagnetLink[]): import("./torrent-finder").MagnetLink | null {
    if (magnets.length === 0) return null;

    // Prefer higher seed count, then higher quality
    const qualityPriority: Record<string, number> = {
      "1080p": 4,
      "720p": 3,
      "480p": 2,
      "360p": 1,
      "unknown": 0,
    };

    return magnets.reduce((best, current) => {
      const bestScore = best.seeders * 10 + qualityPriority[best.quality] * 5;
      const currentScore = current.seeders * 10 + qualityPriority[current.quality] * 5;

      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Filter magnets by quality preference
   */
  filterByQuality(
    magnets: import("./torrent-finder").MagnetLink[],
    preferredQuality: string
  ): import("./torrent-finder").MagnetLink[] {
    // First try exact match
    const exactMatch = magnets.filter((m) => m.quality === preferredQuality);
    if (exactMatch.length > 0) {
      return exactMatch;
    }

    // Fallback to any quality with seeders
    return magnets.filter((m) => m.seeders > 0);
  }
}

// ===================================
// Export singleton instance
// ===================================

export const webTorrentManager = WebTorrentManagerImpl.getInstance();

// ===================================
// Export convenience functions
// ===================================

export function createSession(magnet: string, infoHash: string): WebTorrentSession {
  return webTorrentManager.createSession(magnet, infoHash);
}

export function getSession(sessionId: string): WebTorrentSession | undefined {
  return webTorrentManager.getSession(sessionId);
}

export function destroySession(sessionId: string): void {
  return webTorrentManager.destroySession(sessionId);
}

export function formatBytes(bytes: number): string {
  return webTorrentManager.formatBytes(bytes);
}

export function formatTime(seconds: number): string {
  return webTorrentManager.formatTime(seconds);
}

export function selectBestQuality(magnets: import("./torrent-finder").MagnetLink[]): import("./torrent-finder").MagnetLink | null {
  return webTorrentManager.selectBestQuality(magnets);
}
