/**
 * WebTorrent Seed Server
 *
 * Phase 6: Performance & Optimization
 * Standalone Node.js service for seeding popular anime content
 *
 * Features:
 * - Run as separate process/service
 * - Seed popular content from CDN sources
 * - Ensure availability for new releases
 * - Automatic torrent management
 *
 * Usage:
 *   node services/seed-server.js
 *   or with PM2: pm2 start services/seed-server.js --name anime-seed-server
 *
 * Environment Variables:
 *   - PORT: WebTorrent port (default: 6881)
 *   - SEED_CONTENT_PATH: Path to content directory
 *   - MAX_TORRENTS: Maximum concurrent torrents (default: 50)
 *   - LOG_LEVEL: Log level (default: info)
 */

const WebTorrent = require("webtorrent");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ===================================
// Configuration
// ===================================

const CONFIG = {
  port: parseInt(process.env.PORT || "6881", 10),
  contentPath: process.env.SEED_CONTENT_PATH || path.join(__dirname, "..", "content"),
  maxTorrents: parseInt(process.env.MAX_TORRENTS || "50", 10),
  logLevel: process.env.LOG_LEVEL || "info",
  dhtEnabled: process.env.DHT_ENABLED !== "false",
  trackerEnabled: process.env.TRACKER_ENABLED !== "false",
  webSeedEnabled: process.env.WEB_SEED_ENABLED !== "false",
  maxUploadSpeed: parseInt(process.env.MAX_UPLOAD_SPEED || "0", 10), // 0 = unlimited
  seedRatio: parseFloat(process.env.SEED_RATIO || "2.0"), // Seed until ratio reached
  cleanupAfterHours: parseInt(process.env.CLEANUP_AFTER_HOURS || "24", 10),
  torrentListPath: process.env.TORRENT_LIST_PATH || path.join(__dirname, "torrent-list.json"),
  statsPath: process.env.STATS_PATH || path.join(__dirname, "seed-server-stats.json"),
};

// ===================================
// Logger
// ===================================

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[CONFIG.logLevel] || 2;

function log(level, message, ...args) {
  if (LOG_LEVELS[level] <= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [SeedServer]`;
    console[level](prefix, message, ...args);
  }
}

// ===================================
// Stats Tracking
// ===================================

class StatsTracker {
  constructor(filePath) {
    this.filePath = filePath;
    this.stats = this.load();
    this.saveTimeout = null;
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      log("warn", "Failed to load stats:", error.message);
    }
    return {
      startedAt: Date.now(),
      totalTorrentsSeeded: 0,
      totalUploaded: 0,
      totalDownloaded: 0,
      totalUptime: 0,
      torrentStats: {},
    };
  }

  save() {
    try {
      this.stats.totalUptime = Date.now() - this.stats.startedAt;
      fs.writeFileSync(this.filePath, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      log("error", "Failed to save stats:", error.message);
    }
  }

  updateTorrent(infoHash, stats) {
    if (!this.stats.torrentStats[infoHash]) {
      this.stats.torrentStats[infoHash] = {
        infoHash,
        name: stats.name,
        seededAt: Date.now(),
        uploaded: 0,
        downloaded: 0,
        peers: 0,
      };
      this.stats.totalTorrentsSeeded++;
    }

    const torrentStats = this.stats.torrentStats[infoHash];
    torrentStats.uploaded = stats.uploaded;
    torrentStats.downloaded = stats.downloaded;
    torrentStats.peers = stats.peers;
    torrentStats.lastUpdate = Date.now();

    // Update totals
    this.stats.totalUploaded = Object.values(this.stats.torrentStats)
      .reduce((sum, t) => sum + (t.uploaded || 0), 0);
    this.stats.totalDownloaded = Object.values(this.stats.torrentStats)
      .reduce((sum, t) => sum + (t.downloaded || 0), 0);

    this.debouncedSave();
  }

  // Debounced save: coalesce rapid updates into a single write (H10)
  debouncedSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.save();
      this.saveTimeout = null;
    }, 30000); // 30s debounce
  }

  removeTorrent(infoHash) {
    delete this.stats.torrentStats[infoHash];
    this.save();
  }

  getSummary() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startedAt,
      activeTorrents: Object.keys(this.stats.torrentStats).length,
    };
  }
}

// ===================================
// Seed Server
// ===================================

class SeedServer {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.torrents = new Map();
    this.stats = new StatsTracker(config.statsPath);
    this.torrentList = this.loadTorrentList();
    this.cleanupInterval = null;
    this.statsInterval = null;
    this.logStatsInterval = null;
  }

  /**
   * Start the seed server
   */
  start() {
    log("info", "Starting WebTorrent Seed Server...");
    log("info", "Configuration:", {
      port: this.config.port,
      contentPath: this.config.contentPath,
      maxTorrents: this.config.maxTorrents,
      dhtEnabled: this.config.dhtEnabled,
      trackerEnabled: this.config.trackerEnabled,
      webSeedEnabled: this.config.webSeedEnabled,
    });

    // Create WebTorrent client
    this.client = new WebTorrent({
      dht: this.config.dhtEnabled,
      tracker: this.config.trackerEnabled,
      webSeeds: this.config.webSeedEnabled,
    });

    // Event handlers
    this.client.on("error", (err) => {
      log("error", "WebTorrent client error:", err.message);
    });

    this.client.on("warning", (warn) => {
      log("warn", "WebTorrent client warning:", warn);
    });

    // Start seeding torrents from list
    this.loadAndSeedTorrents();

    // Setup periodic tasks
    this.setupPeriodicTasks();

    log("info", "Seed server started successfully");
    log("info", "Seeding", this.torrents.size, "torrents");
  }

  /**
   * Stop the seed server
   */
  stop() {
    log("info", "Stopping seed server...");

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    if (this.logStatsInterval) {
      clearInterval(this.logStatsInterval);
    }

    // Destroy all torrents
    for (const [infoHash, torrent] of this.torrents) {
      torrent.destroy();
    }
    this.torrents.clear();

    // Destroy client
    if (this.client) {
      this.client.destroy(() => {
        log("info", "Seed server stopped");
      });
    }

    // Save final stats
    this.stats.save();
  }

  /**
   * Load torrent list from file
   */
  loadTorrentList() {
    try {
      if (fs.existsSync(this.config.torrentListPath)) {
        const data = fs.readFileSync(this.config.torrentListPath, "utf-8");
        const list = JSON.parse(data);
        log("info", "Loaded", list.length, "torrents from list");
        return list;
      }
    } catch (error) {
      log("warn", "Failed to load torrent list:", error.message);
    }
    return [];
  }

  /**
   * Save torrent list to file
   */
  saveTorrentList() {
    try {
      const list = Array.from(this.torrents.values()).map((t) => ({
        infoHash: t.infoHash,
        name: t.name,
        magnetURI: t.magnetURI,
        path: t.path,
      }));
      fs.writeFileSync(this.config.torrentListPath, JSON.stringify(list, null, 2));
    } catch (error) {
      log("error", "Failed to save torrent list:", error.message);
    }
  }

  /**
   * Load and seed torrents from list
   */
  loadAndSeedTorrents() {
    for (const item of this.torrentList.slice(0, this.config.maxTorrents)) {
      if (item.magnetURI) {
        this.seedMagnet(item.magnetURI);
      } else if (item.path && fs.existsSync(item.path)) {
        this.seedFile(item.path);
      }
    }
  }

  /**
   * Seed a torrent from magnet URI
   */
  seedMagnet(magnetURI) {
    if (this.torrents.size >= this.config.maxTorrents) {
      log("warn", "Max torrents reached, skipping:", magnetURI.substring(0, 50));
      return null;
    }

    const infoHash = this.extractInfoHash(magnetURI);
    if (this.torrents.has(infoHash)) {
      log("debug", "Already seeding:", infoHash);
      return this.torrents.get(infoHash);
    }

    log("info", "Adding torrent from magnet:", magnetURI.substring(0, 50) + "...");

    const torrent = this.client.add(magnetURI, {
      path: this.config.contentPath,
    });

    this.setupTorrentHandlers(torrent);
    this.torrents.set(infoHash, torrent);

    return torrent;
  }

  /**
   * Seed a file or directory
   */
  seedFile(filePath) {
    if (!fs.existsSync(filePath)) {
      log("error", "File not found:", filePath);
      return null;
    }

    if (this.torrents.size >= this.config.maxTorrents) {
      log("warn", "Max torrents reached, skipping:", filePath);
      return null;
    }

    log("info", "Seeding file:", filePath);

    const torrent = this.client.seed(filePath, {
      path: this.config.contentPath,
    });

    this.setupTorrentHandlers(torrent);

    torrent.on("infoHash", () => {
      this.torrents.set(torrent.infoHash, torrent);
      log("info", "Created torrent:", torrent.name, "(" + torrent.infoHash + ")");
      log("info", "Magnet URI:", torrent.magnetURI);
      this.saveTorrentList();
    });

    return torrent;
  }

  /**
   * Setup torrent event handlers
   */
  setupTorrentHandlers(torrent) {
    torrent.on("done", () => {
      log("info", "Torrent download complete:", torrent.name);
    });

    torrent.on("error", (err) => {
      log("error", "Torrent error:", torrent.name, "-", err.message);
    });

    torrent.on("warning", (warn) => {
      log("warn", "Torrent warning:", torrent.name, "-", warn);
    });

    torrent.on("metadata", () => {
      log("info", "Metadata received:", torrent.name);
    });

    torrent.on("ready", () => {
      log("info", "Torrent ready:", torrent.name, "- Peers:", torrent.numPeers);
    });

    // Track progress
    const progressInterval = setInterval(() => {
      if (torrent.destroyed) {
        clearInterval(progressInterval);
        return;
      }

      this.stats.updateTorrent(torrent.infoHash, {
        name: torrent.name,
        uploaded: torrent.uploaded,
        downloaded: torrent.downloaded,
        peers: torrent.numPeers,
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Extract infoHash from magnet URI
   */
  extractInfoHash(magnetURI) {
    const match = magnetURI.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Setup periodic maintenance tasks
   */
  setupPeriodicTasks() {
    // Cleanup completed torrents every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupTorrents();
    }, 60 * 60 * 1000);

    // Save stats every minute
    this.statsInterval = setInterval(() => {
      this.stats.save();
    }, 60 * 1000);

    // Log stats every 5 minutes (H6: store interval reference for cleanup)
    this.logStatsInterval = setInterval(() => {
      this.logStats();
    }, 5 * 60 * 1000);
  }

  /**
   * Cleanup torrents that meet criteria
   */
  cleanupTorrents() {
    const now = Date.now();
    const toRemove = [];

    for (const [infoHash, torrent] of this.torrents) {
      const torrentStats = this.stats.stats.torrentStats[infoHash];

      if (!torrentStats) continue;

      // Remove if seed ratio reached
      if (this.config.seedRatio > 0 && torrentStats.downloaded > 0) {
        const ratio = torrentStats.uploaded / torrentStats.downloaded;
        if (ratio >= this.config.seedRatio) {
          log("info", "Seed ratio reached for:", torrent.name);
          toRemove.push(infoHash);
          continue;
        }
      }

      // Remove if old and no peers
      const age = now - torrentStats.seededAt;
      if (age > this.config.cleanupAfterHours * 60 * 60 * 1000 && torrentStats.peers === 0) {
        log("info", "Removing old inactive torrent:", torrent.name);
        toRemove.push(infoHash);
      }
    }

    for (const infoHash of toRemove) {
      const torrent = this.torrents.get(infoHash);
      if (torrent) {
        torrent.destroy();
        this.torrents.delete(infoHash);
        this.stats.removeTorrent(infoHash);
      }
    }

    if (toRemove.length > 0) {
      this.saveTorrentList();
      log("info", "Cleaned up", toRemove.length, "torrents");
    }
  }

  /**
   * Log current statistics
   */
  logStats() {
    const summary = this.stats.getSummary();
    const uploadSpeed = this.client ? this.client.uploadSpeed : 0;
    const downloadSpeed = this.client ? this.client.downloadSpeed : 0;

    log("info", "Stats:", {
      activeTorrents: this.torrents.size,
      totalSeeded: summary.totalTorrentsSeeded,
      uploadSpeed: formatBytes(uploadSpeed) + "/s",
      downloadSpeed: formatBytes(downloadSpeed) + "/s",
      totalUploaded: formatBytes(summary.totalUploaded),
      totalDownloaded: formatBytes(summary.totalDownloaded),
      uptime: formatUptime(summary.uptime),
    });
  }

  /**
   * Get server status
   */
  getStatus() {
    const torrents = [];
    for (const [infoHash, torrent] of this.torrents) {
      torrents.push({
        infoHash,
        name: torrent.name,
        progress: torrent.progress,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        numPeers: torrent.numPeers,
        downloaded: torrent.downloaded,
        uploaded: torrent.uploaded,
        ratio: torrent.downloaded > 0 ? torrent.uploaded / torrent.downloaded : 0,
      });
    }

    return {
      uptime: Date.now() - this.stats.stats.startedAt,
      torrentsCount: this.torrents.size,
      torrents,
      stats: this.stats.getSummary(),
      client: {
        uploadSpeed: this.client?.uploadSpeed || 0,
        downloadSpeed: this.client?.downloadSpeed || 0,
        ratio: (this.client?.uploadSpeed || 0) / (this.client?.downloadSpeed || 1) || 0,
      },
    };
  }
}

// ===================================
// Utility Functions
// ===================================

function formatBytes(bytes) {
  if (bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ===================================
// CLI Interface
// ===================================

if (require.main === module) {
  const server = new SeedServer(CONFIG);

  // Handle shutdown
  const shutdown = () => {
    log("info", "Shutting down...");
    if (statusServer) {
      statusServer.close();
    }
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    log("info", "Received SIGINT, shutting down...");
    shutdown();
  });

  process.on("SIGTERM", () => {
    log("info", "Received SIGTERM, shutting down...");
    shutdown();
  });

  // Handle uncaught errors
  process.on("uncaughtException", (err) => {
    log("error", "Uncaught exception:", err);
    if (statusServer) {
      statusServer.close();
    }
    server.stop();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    log("error", "Unhandled rejection at:", promise, "reason:", reason);
  });

  // Start server
  server.start();

  // Simple HTTP status endpoint (optional)
  const http = require("http");
  const { verify } = require("jsonwebtoken");
  const STATUS_PORT = parseInt(process.env.STATUS_PORT || "3001", 10);

  const statusServer = http.createServer((req, res) => {
    if (req.url === "/status") {
      // Authenticate status endpoint
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      try {
        if (!process.env.JWT_SECRET) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Server configuration error" }));
          return;
        }
        // H11: Specify algorithms to prevent algorithm confusion attacks
        verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid token" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(server.getStatus(), null, 2));
    } else if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  statusServer.listen(STATUS_PORT, '127.0.0.1', () => {
    log("info", "Status server listening on port", STATUS_PORT);
    log("info", "Status available at http://localhost:" + STATUS_PORT + "/status");
  });
}

// Export for programmatic use
module.exports = { SeedServer, CONFIG };
