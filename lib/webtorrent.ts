/**
 * WebTorrent Player Manager
 * Handles P2P streaming with WebTorrent
 * Client-side only to avoid SSR issues
 */

import { WEBTORRENT_CONFIG } from "./constants";
import type WebTorrent from "webtorrent";

type WebTorrentInstance = WebTorrent.Instance;
type WebTorrentTorrent = WebTorrent.Torrent;
type WebTorrentFile = WebTorrent.TorrentFile;
type WebRtcWindow = Window &
  typeof globalThis & {
    RTCPeerConnection?: typeof RTCPeerConnection;
  };

// ===================================
// Types
// ===================================

export interface VideoSource {
  type: "magnet" | "torrent" | "direct" | "file";
  url: string;
  quality?: string;
  infoHash?: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  bufferProgress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  progress: number;
}

export interface PlayerEvents {
  onReady: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (time: number) => void;
  onProgress: (progress: number) => void;
  onError: (error: Error) => void;
  onEnd: () => void;
}

// ===================================
// WebTorrent Manager Class
// ===================================

class WebTorrentManager {
  private client: WebTorrentInstance | null = null;
  private currentTorrent: WebTorrentTorrent | null = null;
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Initialize WebTorrent client
   */
  async init(): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("WebTorrent can only be used in the browser");
    }

    if (this.client) {
      return;
    }

    // Dynamically import WebTorrent to avoid SSR issues
    const WebTorrentModule = await import("webtorrent");
    const WebTorrent = WebTorrentModule.default || WebTorrentModule;

    this.client = new WebTorrent({
      tracker: {
        rtcConfig: WEBTORRENT_CONFIG.rtcConfig,
      },
    });

    // Clean up on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.destroy());
    }
  }

  /**
   * Load a torrent source
   */
  async loadTorrent(
    source: VideoSource,
    videoElement: HTMLVideoElement,
    events?: Partial<PlayerEvents>
  ): Promise<void> {
    if (!this.client) {
      await this.init();
    }

    this.videoElement = videoElement;

    // Clean up existing torrent
    if (this.currentTorrent) {
      this.currentTorrent.destroy();
    }

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("WebTorrent client not initialized"));
        return;
      }

      const torrentId = source.type === "magnet" ? source.url : source.url;

      this.client!.add(
        torrentId,
        {
          announce: [...WEBTORRENT_CONFIG.announce],
        },
        (torrent: WebTorrentTorrent) => {
          this.currentTorrent = torrent;

          // Find the largest video file
          const file = torrent.files.find((f: WebTorrentFile) => {
            const ext = f.name.endsWith(".mp4") ||
                        f.name.endsWith(".mkv") ||
                        f.name.endsWith(".webm");
            return ext && f.length > 10 * 1024 * 1024; // At least 10MB
          }) || torrent.files[0];

          if (!file) {
            reject(new Error("No video file found in torrent"));
            return;
          }

          // Stream to video element
          file.renderTo(videoElement, (err?: Error) => {
            if (err) {
              events?.onError?.(err);
              reject(err);
              return;
            }

            events?.onReady?.();
            resolve();
          });

          // Handle torrent events
          torrent.on("error", (err: Error | string) => {
            const error = typeof err === "string" ? new Error(err) : err;
            events?.onError?.(error);
            reject(error);
          });

          torrent.on("done", () => {
            // Torrent download complete - callback will be triggered via events
          });
        }
      );

      this.client.on("error", (err: Error | string) => {
        const error = typeof err === "string" ? new Error(err) : err;
        events?.onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * Load a direct video URL (fallback)
   */
  loadDirectVideo(
    url: string,
    videoElement: HTMLVideoElement,
    events?: Partial<PlayerEvents>
  ): void {
    this.videoElement = videoElement;

    // Clean up existing torrent
    if (this.currentTorrent) {
      this.currentTorrent.destroy();
      this.currentTorrent = null;
    }

    videoElement.src = url;

    videoElement.addEventListener("loadeddata", () => {
      events?.onReady?.();
    }, { once: true });

    videoElement.addEventListener("error", () => {
      events?.onError?.(new Error("Failed to load video"));
    }, { once: true });
  }

  /**
   * Get current player state
   */
  getState(): PlayerState {
    const video = this.videoElement;
    const torrent = this.currentTorrent;

    return {
      isPlaying: video ? !video.paused : false,
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      volume: video?.volume || 1,
      bufferProgress: video ? (video.buffered.length > 0
        ? (video.buffered.end(0) / video.duration) * 100
        : 0) : 0,
      downloadSpeed: torrent?.downloadSpeed || 0,
      uploadSpeed: torrent?.uploadSpeed || 0,
      peers: torrent?.numPeers || 0,
      progress: torrent?.progress || 0,
    };
  }

  /**
   * Play video
   */
  async play(): Promise<void> {
    if (!this.videoElement) {
      throw new Error("No video element loaded");
    }

    await this.videoElement.play();
  }

  /**
   * Pause video
   */
  pause(): void {
    this.videoElement?.pause();
  }

  /**
   * Seek to time
   */
  seek(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get download progress percentage
   */
  getDownloadProgress(): number {
    return this.currentTorrent?.progress || 0;
  }

  /**
   * Get download speed in bytes per second
   */
  getDownloadSpeed(): number {
    return this.currentTorrent?.downloadSpeed || 0;
  }

  /**
   * Get number of connected peers
   */
  getPeers(): number {
    return this.currentTorrent?.numPeers || 0;
  }

  /**
   * Destroy the client and clean up
   */
  destroy(): void {
    if (this.currentTorrent) {
      this.currentTorrent.destroy();
      this.currentTorrent = null;
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    this.videoElement = null;
  }

  /**
   * Check if WebTorrent is supported
   */
  static isSupported(): boolean {
    return typeof window !== "undefined" &&
           typeof (window as WebRtcWindow).RTCPeerConnection !== "undefined";
  }
}

// ===================================
// Helper Functions
// ===================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format seconds to time string (HH:MM:SS)
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parse magnet link to extract info hash
 */
export function parseMagnetLink(magnetLink: string): string | null {
  const match = magnetLink.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
  return match ? match[1] : null;
}

// ===================================
// Singleton Instance
// ===================================

export const webTorrentManager = new WebTorrentManager();
