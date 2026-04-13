/**
 * Anime-Specific BitTorrent Tracker
 *
 * Phase 10: Private Tracker for Verified Sources
 * Provides verified sources with higher quality assurance
 *
 * Features:
 * - Private tracker for anime content
 * - Content verification and quality control
 * - User authentication and authorization
 * - Seeder rewards system
 * - Statistics and monitoring
 */

import http from "http";
import { WebSocketServer } from "ws";
import { parse as parseUrl } from "url";

// ===================================
// Types
// ===================================

interface TorrentInfo {
  infoHash: string;
  animeId: number;
  episodeNumber: number;
  title: string;
  quality: string;
  size: number;
  uploader: string;
  uploadedAt: Date;
  verified: boolean;
  seeders: number;
  leechers: number;
  completed: number;
}

interface PeerInfo {
  ip: string;
  port: number;
  peerId: string;
  infoHash: string;
  uploaded: number;
  downloaded: number;
  left: number;
  event: "started" | "stopped" | "completed";
  lastAnnounce: Date;
}

interface UserInfo {
  userId: string;
  username: string;
  passkey: string;
  uploaded: number;
  downloaded: number;
  prevUploaded: number;
  prevDownloaded: number;
  ratio: number;
  canUpload: boolean;
  isVIP: boolean;
}

// ===================================
// Tracker Configuration
// ===================================

const TRACKER_CONFIG = {
  port: process.env.ANIME_TRACKER_PORT || 8000,
  wsPort: process.env.ANIME_TRACKER_WS_PORT || 8001,
  announceInterval: 1800, // 30 minutes
  minAnnounceInterval: 300, // 5 minutes
  maxPeersPerResponse: 50,
};

// ===================================
// In-Memory Storage (replace with database in production)
// ===================================

const torrents: Map<string, TorrentInfo> = new Map();
const peers: Map<string, Set<PeerInfo>> = new Map(); // infoHash -> peers
const users: Map<string, UserInfo> = new Map(); // passkey -> user
const pendingVerifications: Set<string> = new Set();

// ===================================
// HTTP Tracker Server
// ===================================

class AnimeTracker {
  private server: http.Server | null = null;
  private wsServer: WebSocketServer | null = null;

  /**
   * Start the tracker servers
   */
  start(): void {
    // Start HTTP tracker
    this.server = http.createServer((req, res) => {
      this.handleHTTPRequest(req, res);
    });

    this.server.listen(Number(TRACKER_CONFIG.port), () => {
      console.log(`[AnimeTracker] HTTP tracker listening on port ${TRACKER_CONFIG.port}`);
    });

    // Start WebSocket tracker
    this.wsServer = new WebSocketServer({ port: Number(TRACKER_CONFIG.wsPort) });
    this.wsServer.on("connection", (ws: any) => {
      this.handleWebSocketConnection(ws);
    });

    console.log(`[AnimeTracker] WebSocket tracker listening on port ${TRACKER_CONFIG.wsPort}`);

    // Start periodic tasks
    this.startPeriodicTasks();
  }

  /**
   * Stop the tracker servers
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
  }

  /**
   * Handle HTTP announce requests
   */
  private handleHTTPRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = parseUrl(req.url || "", true);
    const path = url.pathname;

    if (path === "/announce") {
      this.handleAnnounce(req, res);
    } else if (path === "/scrape") {
      this.handleScrape(req, res);
    } else if (path === "/api/upload") {
      this.handleUpload(req, res);
    } else if (path === "/api/verify") {
      this.handleVerify(req, res);
    } else if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", torrents: torrents.size }));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  }

  /**
   * Handle announce requests from clients
   */
  private async handleAnnounce(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = parseUrl(req.url || "", true);
      const query = url.query;

      const infoHash = query.info_hash as string;
      const peerId = query.peer_id as string;
      const ip = query.ip as string || req.socket.remoteAddress || "";
      const port = parseInt(query.port as string);
      const uploaded = parseInt(query.uploaded as string) || 0;
      const downloaded = parseInt(query.downloaded as string) || 0;
      const left = parseInt(query.left as string) || 0;
      const event = query.event as "started" | "stopped" | "completed" || "started";
      const passkey = query.passkey as string;

      // Authenticate user
      const user = users.get(passkey);
      if (!user) {
        this.writeBencodeError(res, "Authentication failed");
        return;
      }

      // Validate request
      if (!infoHash || !peerId || !port) {
        this.writeBencodeError(res, "Missing required parameters");
        return;
      }

      // Check if torrent exists
      if (!torrents.has(infoHash)) {
        this.writeBencodeError(res, "Torrent not found");
        return;
      }

      // Update peer info
      const peerInfo: PeerInfo = {
        ip,
        port,
        peerId,
        infoHash,
        uploaded,
        downloaded,
        left,
        event,
        lastAnnounce: new Date(),
      };

      // Update peer storage
      if (!peers.has(infoHash)) {
        peers.set(infoHash, new Set());
      }

      const torrentPeers = peers.get(infoHash)!;

      // Remove old peer entry if exists
      torrentPeers.forEach((p) => {
        if (p.peerId === peerId) {
          torrentPeers.delete(p);
        }
      });

      // Add new peer entry if not stopped
      if (event !== "stopped") {
        torrentPeers.add(peerInfo);
      }

      // Update torrent statistics
      const torrent = torrents.get(infoHash)!;
      this.updateTorrentStats(infoHash, event);

      // Update user stats
      this.updateUserStats(user, uploaded, downloaded, event);

      // Get peers to return
      const peersList = Array.from(torrentPeers)
        .filter((p) => p.peerId !== peerId)
        .slice(0, TRACKER_CONFIG.maxPeersPerResponse)
        .map((p) => ({
          "ip": p.ip,
          "port": p.port,
          "peer id": p.peerId,
        }));

      // Write response
      const response = {
        interval: TRACKER_CONFIG.announceInterval,
        "min interval": TRACKER_CONFIG.minAnnounceInterval,
        peers: peersList,
      };

      this.writeBencode(res, response);
    } catch (error) {
      console.error("[AnimeTracker] Announce error:", error);
      this.writeBencodeError(res, "Internal server error");
    }
  }

  /**
   * Handle scrape requests
   */
  private handleScrape(req: http.IncomingMessage, res: http.ServerResponse): void {
    try {
      const url = parseUrl(req.url || "", true);
      const query = url.query;
      const infoHashes = query.info_hash as string | string[];

      const hashes = Array.isArray(infoHashes) ? infoHashes : [infoHashes];
      const files: Record<string, any> = {};

      hashes.forEach((hash) => {
        const torrent = torrents.get(hash);
        if (torrent) {
          files[hash] = {
            complete: torrent.seeders,
            downloaded: torrent.completed,
            incomplete: torrent.leechers,
          };
        }
      });

      const response = { files };
      this.writeBencode(res, response);
    } catch (error) {
      console.error("[AnimeTracker] Scrape error:", error);
      this.writeBencodeError(res, "Internal server error");
    }
  }

  /**
   * Handle torrent upload (verified uploaders only)
   */
  private async handleUpload(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      const passkey = parseUrl(req.url || "", true).query.passkey as string;
      const user = users.get(passkey);

      if (!user || !user.canUpload) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not authorized to upload" }));
        return;
      }

      // Parse request body
      const body = await this.parseRequestBody(req);
      const { infoHash, animeId, episodeNumber, title, quality, size } = body;

      if (!infoHash || !animeId || !episodeNumber || !title) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing required fields" }));
        return;
      }

      // Create torrent entry
      const torrentInfo: TorrentInfo = {
        infoHash,
        animeId,
        episodeNumber,
        title,
        quality: quality || "unknown",
        size: size || 0,
        uploader: user.username,
        uploadedAt: new Date(),
        verified: false, // Requires verification
        seeders: 0,
        leechers: 0,
        completed: 0,
      };

      torrents.set(infoHash, torrentInfo);
      pendingVerifications.add(infoHash);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Torrent uploaded pending verification", infoHash }));
    } catch (error) {
      console.error("[AnimeTracker] Upload error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * Handle torrent verification (admin endpoint)
   */
  private async handleVerify(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      const body = await this.parseRequestBody(req);
      const { infoHash, verified, adminKey } = body;

      if (adminKey !== process.env.ADMIN_KEY) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const torrent = torrents.get(infoHash);
      if (!torrent) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Torrent not found" }));
        return;
      }

      torrent.verified = verified;
      pendingVerifications.delete(infoHash);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Torrent verified", torrent }));
    } catch (error) {
      console.error("[AnimeTracker] Verify error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * Handle WebSocket connections for real-time updates
   */
  private handleWebSocketConnection(ws: any): void {
    console.log("[AnimeTracker] New WebSocket connection");

    ws.on("message", (data: any) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "announce") {
          // Handle WebSocket announce
          this.handleWSAnnounce(ws, message);
        } else if (message.type === "subscribe") {
          // Subscribe to torrent updates
          this.handleWSSubscribe(ws, message);
        }
      } catch (error) {
        console.error("[AnimeTracker] WebSocket error:", error);
      }
    });

    ws.on("close", () => {
      console.log("[AnimeTracker] WebSocket disconnected");
    });
  }

  /**
   * Handle WebSocket announce
   */
  private handleWSAnnounce(ws: any, message: any): void {
    const { infoHash, peerId, port } = message;

    if (!infoHash || !peerId || !port) {
      ws.send(JSON.stringify({ error: "Missing required parameters" }));
      return;
    }

    // Similar to HTTP announce but with WebSocket
    // Implementation omitted for brevity
  }

  /**
   * Handle WebSocket subscription to torrent updates
   */
  private handleWSSubscribe(ws: any, message: any): void {
    const { infoHash } = message;

    if (!infoHash) {
      ws.send(JSON.stringify({ error: "Missing infoHash" }));
      return;
    }

    // Subscribe to updates for this torrent
    // Implementation omitted for brevity
  }

  /**
   * Update torrent statistics based on peer event
   */
  private updateTorrentStats(infoHash: string, event: string): void {
    const torrent = torrents.get(infoHash);
    if (!torrent) return;

    const torrentPeers = peers.get(infoHash) || new Set();

    // Count seeders and leechers
    let seeders = 0;
    let leechers = 0;

    torrentPeers.forEach((peer) => {
      if (peer.left === 0) {
        seeders++;
      } else {
        leechers++;
      }
    });

    torrent.seeders = seeders;
    torrent.leechers = leechers;

    // Update completed count
    if (event === "completed") {
      torrent.completed++;
    }
  }

  /**
   * Update user statistics
   */
  private updateUserStats(user: UserInfo, uploaded: number, downloaded: number, event: string): void {
    const deltaUploaded = uploaded - (user.prevUploaded || 0);
    const deltaDownloaded = downloaded - (user.prevDownloaded || 0);
    user.uploaded += deltaUploaded;
    user.downloaded += deltaDownloaded;
    user.prevUploaded = uploaded;
    user.prevDownloaded = downloaded;

    if (user.downloaded > 0) {
      user.ratio = user.uploaded / user.downloaded;
    }
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Clean up inactive peers every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const timeout = 3600000; // 1 hour

      for (const [infoHash, torrentPeers] of peers.entries()) {
        const toRemove: PeerInfo[] = [];
        torrentPeers.forEach((peer) => {
          if (now - peer.lastAnnounce.getTime() > timeout) {
            toRemove.push(peer);
          }
        });
        toRemove.forEach((peer) => torrentPeers.delete(peer));
      }
    }, 300000);

    // Update torrent stats every minute
    setInterval(() => {
      for (const infoHash of torrents.keys()) {
        const torrentPeers = peers.get(infoHash) || new Set();
        let seeders = 0;
        let leechers = 0;

        torrentPeers.forEach((peer) => {
          if (peer.left === 0) {
            seeders++;
          } else {
            leechers++;
          }
        });

        const torrent = torrents.get(infoHash)!;
        torrent.seeders = seeders;
        torrent.leechers = leechers;
      }
    }, 60000);
  }

  /**
   * Write bencoded response
   */
  private writeBencode(res: http.ServerResponse, data: any): void {
    // Simple bencoder (for production use a proper bencode library)
    const bencoded = this.bencode(data);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(bencoded);
  }

  /**
   * Write bencoded error response
   */
  private writeBencodeError(res: http.ServerResponse, message: string): void {
    const failureReason = this.bencode({ "failure reason": message });
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(failureReason);
  }

  /**
   * Simple bencode implementation
   */
  private bencode(data: any): string {
    if (typeof data === "string") {
      return `${data.length}:${data}`;
    } else if (typeof data === "number") {
      return `i${data}e`;
    } else if (Array.isArray(data)) {
      return `l${data.filter((item) => item != null).map((item) => this.bencode(item)).join("")}e`;
    } else if (typeof data === "object") {
      let result = "d";
      for (const [key, value] of Object.entries(data)) {
        if (value == null) continue;
        result += this.bencode(key);
        result += this.bencode(value);
      }
      result += "e";
      return result;
    }
    return "";
  }

  /**
   * Parse request body
   */
  private async parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = "";
      let totalBytes = 0;
      req.on("data", (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > 1048576) {
          req.destroy();
          reject(new Error("Body too large"));
          return;
        }
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
      req.on("error", reject);
    });
  }
}

// ===================================
// Export
// ===================================

export const animeTracker = new AnimeTracker();

if (require.main === module) {
  animeTracker.start();
}
