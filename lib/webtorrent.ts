/**
 * Playback compatibility helper.
 * The production app now ships direct streaming only, but this module keeps the
 * player API stable for existing imports.
 */

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

class PlaybackManager {
  private videoElement: HTMLVideoElement | null = null;

  async init(): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("Playback helpers can only be used in the browser");
    }
  }

  async loadTorrent(
    source: VideoSource,
    videoElement: HTMLVideoElement,
    events?: Partial<PlayerEvents>
  ): Promise<void> {
    this.videoElement = videoElement;

    if (source.type !== "direct" && source.type !== "file") {
      const error = new Error("P2P playback is no longer supported in production.");
      events?.onError?.(error);
      throw error;
    }

    this.loadDirectVideo(source.url, videoElement, events);
  }

  loadDirectVideo(
    url: string,
    videoElement: HTMLVideoElement,
    events?: Partial<PlayerEvents>
  ): void {
    this.videoElement = videoElement;
    videoElement.src = url;

    videoElement.addEventListener(
      "loadeddata",
      () => {
        events?.onReady?.();
      },
      { once: true }
    );

    videoElement.addEventListener(
      "error",
      () => {
        events?.onError?.(new Error("Failed to load video"));
      },
      { once: true }
    );
  }

  getState(): PlayerState {
    const video = this.videoElement;

    return {
      isPlaying: video ? !video.paused : false,
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      volume: video?.volume || 1,
      bufferProgress:
        video && video.buffered.length > 0 && video.duration > 0
          ? (video.buffered.end(0) / video.duration) * 100
          : 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      peers: 0,
      progress: 0,
    };
  }

  async play(): Promise<void> {
    if (!this.videoElement) {
      throw new Error("No video element loaded");
    }

    await this.videoElement.play();
  }

  pause(): void {
    this.videoElement?.pause();
  }

  seek(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  getDownloadProgress(): number {
    return 0;
  }

  getDownloadSpeed(): number {
    return 0;
  }

  getPeers(): number {
    return 0;
  }

  destroy(): void {
    this.videoElement = null;
  }

  static isSupported(): boolean {
    return typeof window !== "undefined";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

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

export function parseMagnetLink(magnetLink: string): string | null {
  const match = magnetLink.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
  return match ? match[1] : null;
}

export const webTorrentManager = new PlaybackManager();
