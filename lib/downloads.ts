/**
 * Download Manager
 * Handles offline video downloads using IndexedDB and Cache API
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

class DownloadManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
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
      request.onerror = () => reject(request.error);
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

    const existing = await this.getDownload(id);
    if (existing?.status === "completed") {
      return id;
    }

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
      const response = await fetch(videoUrl);
      
      if (!response.ok) throw new Error("Failed to download video");

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total > 0 && onProgress) {
          onProgress(Math.round((receivedLength / total) * 100));
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
      const newResponse = new Response(blob, {
        headers: { "Content-Type": "video/mp4" },
      });

      await cache.put(videoUrl, newResponse);

      await this.updateDownload(id, {
        status: "completed",
        progress: 100,
        size: blob.size,
      });

      return id;
    } catch (error) {
      await this.updateDownload(id, {
        status: "error",
        progress: 0,
      });
      throw error;
    }
  }

  async getCachedVideo(videoUrl: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(videoUrl);
    
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    
    return null;
  }
}

export const downloadManager = new DownloadManager();

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export async function isVideoDownloaded(animeId: number, episodeNumber: number): Promise<boolean> {
  const id = `${animeId}-${episodeNumber}`;
  const download = await downloadManager.getDownload(id);
  return download?.status === "completed";
}
