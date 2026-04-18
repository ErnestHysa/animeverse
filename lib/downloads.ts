/**
 * Download Manager
 * Handles offline video downloads using IndexedDB and Cache API
 * Supports both direct video downloads and HLS (m3u8) streams
 */

export interface DownloadItem {
  id: string;
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  size: number;
  downloadedAt: number;
  lastWatchedAt?: number;
  watchProgress?: number;
  status: "downloading" | "completed" | "error" | "paused";
  progress: number;
}

const DB_NAME = "animeverse_downloads";
const DB_VERSION = 1;
const STORE_NAME = "downloads";
const CACHE_NAME = "animeverse-videos";

// Time after which a "downloading" download is considered stale (5 minutes)
const STALE_DOWNLOAD_THRESHOLD = 5 * 60 * 1000;

class DownloadManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private activeBlobUrls = new Map<string, string>(); // cacheKey -> blobUrl

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };
      request.onsuccess = async () => {
        this.db = request.result;
        // Clean up stale downloads after opening
        await this.cleanupStaleDownloads();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("animeId", "animeId", { unique: false });
          store.createIndex("downloadedAt", "downloadedAt", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Clean up stale downloads that are stuck in "downloading" state
   */
  async cleanupStaleDownloads(): Promise<void> {
    if (!this.db) return;

    try {
      const downloads = await this.getAllDownloads();
      const now = Date.now();
      const staleIds: string[] = [];

      for (const download of downloads) {
        // Remove downloads that are "downloading" but haven't been updated recently
        if (download.status === "downloading") {
          const timeSinceUpdate = now - download.downloadedAt;
          if (timeSinceUpdate > STALE_DOWNLOAD_THRESHOLD) {
            staleIds.push(download.id);
          }
        }
        // Also remove failed downloads
        if (download.status === "error") {
          staleIds.push(download.id);
        }
      }

      // Delete stale entries
      for (const id of staleIds) {
        await this.deleteDownload(id);
      }
    } catch (error) {
      // Silently handle cleanup errors
    }
  }

  async getAllDownloads(): Promise<DownloadItem[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDownload(id: string): Promise<DownloadItem | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addDownload(download: Omit<DownloadItem, "progress" | "status">): Promise<void> {
    if (!this.db) await this.init();

    const item: DownloadItem = {
      ...download,
      progress: 0,
      status: "downloading",
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        const target = event.target as IDBRequest;
        // If key already exists, that's okay - we'll update it instead
        if (target.error && target.error.name === 'ConstraintError') {
          resolve();
        } else {
          reject(target.error);
        }
      };
    });
  }

  async updateDownload(id: string, updates: Partial<DownloadItem>): Promise<void> {
    if (!this.db) await this.init();
    const existing = await this.getDownload(id);
    if (!existing) throw new Error("Download not found");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ ...existing, ...updates });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDownload(id: string): Promise<void> {
    if (!this.db) await this.init();

    const download = await this.getDownload(id);
    if (download) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(download.videoUrl);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllDownloads(): Promise<void> {
    if (!this.db) await this.init();

    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    await Promise.all(keys.map(key => cache.delete(key)));

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize(): Promise<number> {
    const downloads = await this.getAllDownloads();
    return downloads.reduce((total, item) => total + item.size, 0);
  }

  async downloadVideo(
    animeId: number,
    animeTitle: string,
    episodeNumber: number,
    videoUrl: string,
    thumbnailUrl?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const id = `${animeId}-${episodeNumber}`;

    // Check if already completed
    const existing = await this.getDownload(id);
    if (existing?.status === "completed") {
      return id;
    }

    // If there's a stale or failed download, remove it first
    if (existing && (existing.status === "downloading" || existing.status === "error")) {
      await this.deleteDownload(id);
    }

    // Add new download entry
    await this.addDownload({
      id,
      animeId,
      animeTitle,
      episodeNumber,
      videoUrl,
      thumbnailUrl,
      size: 0,
      downloadedAt: Date.now(),
    });

    try {
      const cache = await caches.open(CACHE_NAME);
      let blob: Blob;
      let contentType = "video/mp4";

      // Check if this is an HLS stream
      if (videoUrl.includes('.m3u8')) {
        // Download HLS through proxy
        blob = await this.downloadHLSVideo(videoUrl, onProgress);
        contentType = "video/mp2t"; // MPEG-TS
      } else {
        // Direct video download with progress tracking
        blob = await this.downloadDirectVideo(videoUrl, onProgress);
        contentType = "video/mp4";
      }

      // Cache the blob
      const newResponse = new Response(blob, {
        headers: { "Content-Type": contentType },
      });

      await cache.put(videoUrl, newResponse);

      // Mark as completed
      await this.updateDownload(id, {
        status: "completed",
        progress: 100,
        size: blob.size,
      });

      return id;
    } catch (error) {
      // Mark as failed
      await this.updateDownload(id, {
        status: "error",
        progress: 0,
      }).catch(() => {
        // If update fails, at least try to delete the entry
        return this.deleteDownload(id);
      });
      throw error;
    }
  }

  /**
   * Download direct video with progress tracking
   */
  private async downloadDirectVideo(
    videoUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      // Report progress every 10%
      if (total > 0 && onProgress) {
        const currentProgress = Math.round((receivedLength / total) * 100);
        if (currentProgress % 10 === 0 || currentProgress === 100) {
          onProgress(currentProgress);
        }
      }
    }

    return new Blob(chunks as BlobPart[], { type: "video/mp4" });
  }

  /**
   * Download HLS video through server-side proxy
   * Uses a progress endpoint to track segments
   */
  private async downloadHLSVideo(
    manifestUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // Use the server-side proxy API to download HLS content
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const proxyUrl = new URL('/api/download-hls', origin);
    proxyUrl.searchParams.set('url', manifestUrl);

    try {
      const response = await fetch(proxyUrl.toString());

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to download: ${response.statusText}`);
      }

      // For HLS, we don't have accurate progress, so we simulate it
      // Start at 10%, update to 90% when done, then 100%
      if (onProgress) {
        onProgress(10);
      }

      // Get the response as a blob
      const blob = await response.blob();

      if (onProgress) {
        onProgress(90);
        // Small delay to show 90% before 100%
        await new Promise(resolve => setTimeout(resolve, 100));
        onProgress(100);
      }

      return blob;
    } catch (error) {
      throw new Error(`HLS download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCachedVideo(videoUrl: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(videoUrl);

    if (response) {
      const blob = await response.blob();

      // Revoke previous blob URL if exists for this key
      const prevUrl = this.activeBlobUrls.get(videoUrl);
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }

      const blobUrl = URL.createObjectURL(blob);
      this.activeBlobUrls.set(videoUrl, blobUrl);
      return blobUrl;
    }

    return null;
  }

  /**
   * Revoke all active blob URLs to free memory
   */
  revokeAllBlobUrls(): void {
    for (const url of this.activeBlobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.activeBlobUrls.clear();
  }
}

export const downloadManager = new DownloadManager();

export function formatBytes(bytes: number): string {
  if (bytes < 0) bytes = 0;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export async function isVideoDownloaded(animeId: number, episodeNumber: number): Promise<boolean> {
  const id = `${animeId}-${episodeNumber}`;
  const download = await downloadManager.getDownload(id);
  return download?.status === "completed";
}
