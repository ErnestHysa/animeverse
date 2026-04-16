/**
 * Anime Stream Desktop App - Preload Script
 *
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from "electron";

// ===================================
// Types
// ===================================

interface AppConfig {
  autoStart: boolean;
  minimizeToTray: boolean;
  startInBackground: boolean;
  seedingEnabled: boolean;
  maxUploadSpeed: number;
  maxDownloadSpeed: number;
  downloadPath: string;
}

interface TorrentSession {
  infoHash: string;
  name: string;
  path: string;
  seeding: boolean;
  downloaded: number;
  uploaded: number;
  ratio: number;
  speed: {
    download: number;
    upload: number;
  };
  peers: number;
}

// ===================================
// Context Bridge API
// ===================================

contextBridge.exposeInMainWorld("electronAPI", {
  // Config APIs
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke("get-config"),
  setConfig: (config: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke("set-config", config),

  // Torrent APIs
  startTorrent: (magnetUri: string): Promise<TorrentSession> => ipcRenderer.invoke("start-torrent", magnetUri),
  stopTorrent: (infoHash: string): Promise<boolean> => ipcRenderer.invoke("stop-torrent", infoHash),
  getActiveSessions: (): Promise<TorrentSession[]> => ipcRenderer.invoke("get-active-sessions"),
  getSession: (infoHash: string): Promise<TorrentSession | undefined> => ipcRenderer.invoke("get-session", infoHash),

  // App control APIs
  minimizeToTray: (): Promise<void> => ipcRenderer.invoke("minimize-to-tray"),
  quitApp: (): Promise<void> => ipcRenderer.invoke("quit-app"),

  // Notifications
  showNotification: (title: string, body: string): Promise<void> => ipcRenderer.invoke("show-notification", title, body),

  // Event listeners
  onTorrentStarted: (callback: (session: TorrentSession) => void) => {
    ipcRenderer.on("torrent-started", (_event, session) => callback(session));
  },
  onTorrentStopped: (callback: (data: { infoHash: string }) => void) => {
    ipcRenderer.on("torrent-stopped", (_event, data) => callback(data));
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on("open-settings", () => callback());
  },
});

// ===================================
// Type Declarations
// ===================================

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<AppConfig>;
      setConfig: (config: Partial<AppConfig>) => Promise<AppConfig>;
      startTorrent: (magnetUri: string) => Promise<TorrentSession>;
      stopTorrent: (infoHash: string) => Promise<boolean>;
      getActiveSessions: () => Promise<TorrentSession[]>;
      getSession: (infoHash: string) => Promise<TorrentSession | undefined>;
      minimizeToTray: () => Promise<void>;
      quitApp: () => Promise<void>;
      showNotification: (title: string, body: string) => Promise<void>;
      onTorrentStarted: (callback: (session: TorrentSession) => void) => void;
      onTorrentStopped: (callback: (data: { infoHash: string }) => void) => void;
      onOpenSettings: (callback: () => void) => void;
    };
  }
}
