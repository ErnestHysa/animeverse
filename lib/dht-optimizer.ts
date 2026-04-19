/**
 * DHT Optimizer Module
 *
 * Phase 6: Performance & Optimization
 * Optimizes WebTorrent DHT (Distributed Hash Table) connections for faster peer discovery
 *
 * Features:
 * - Pre-connect to known DHT nodes
 * - Reduce peer discovery time
 * - Track successful DHT connections
 * - Maintain a pool of healthy DHT nodes
 */

// ===================================
// Types
// ===================================

export interface DHTNode {
  address: string;
  port: number;
  lastSeen: number;
  successCount: number;
  failureCount: number;
  averageLatency: number; // milliseconds
}

export interface DHTOptions {
  enablePreconnect: boolean;
  maxPreconnectNodes: number;
  nodeCacheTimeout: number; // milliseconds
  preferTrackers: boolean; // Use trackers before DHT for faster discovery
  bootstrapNodes: DHTNode[];
}

export interface DHTStats {
  totalNodes: number;
  activeNodes: number;
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageLatency: number;
}

// ===================================
// Constants
// ===================================

// Well-known public DHT bootstrap nodes
const DEFAULT_BOOTSTRAP_NODES: DHTNode[] = [
  { address: "router.bittorrent.com", port: 6881, lastSeen: 0, successCount: 0, failureCount: 0, averageLatency: 0 },
  { address: "dht.transmissionbt.com", port: 6881, lastSeen: 0, successCount: 0, failureCount: 0, averageLatency: 0 },
  { address: "router.utorrent.com", port: 6881, lastSeen: 0, successCount: 0, failureCount: 0, averageLatency: 0 },
];

// WebTorrent-compatible DHT nodes
const WEBTORRENT_DHT_NODES: DHTNode[] = [
  { address: "dht.webtorrent.dev", port: 443, lastSeen: 0, successCount: 0, failureCount: 0, averageLatency: 0 },
];

const DEFAULT_MAX_PRECONNECT_NODES = 10;
const DEFAULT_NODE_CACHE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const DHT_STORAGE_KEY = "dht_node_cache";

// ===================================
// DHT Optimizer Class
// ===================================

class DHTOptimizerImpl {
  private options: DHTOptions;
  private nodeCache: Map<string, DHTNode> = new Map();
  private connectionStats: Map<string, { attempts: number; successes: number; failures: number }> = new Map();
  private static instance: DHTOptimizerImpl;
  private webTorrentClient: any = null;
  private lastSaveTime = 0;
  private _destroyed = false;

  private constructor(options: Partial<DHTOptions> = {}) {
    this.options = {
      enablePreconnect: options.enablePreconnect ?? true,
      maxPreconnectNodes: options.maxPreconnectNodes ?? DEFAULT_MAX_PRECONNECT_NODES,
      nodeCacheTimeout: options.nodeCacheTimeout ?? DEFAULT_NODE_CACHE_TIMEOUT,
      preferTrackers: options.preferTrackers ?? true,
      bootstrapNodes: options.bootstrapNodes ?? [...DEFAULT_BOOTSTRAP_NODES],
    };

    // Load cached nodes from localStorage
    this.loadNodeCache();
  }

  static getInstance(options?: Partial<DHTOptions>): DHTOptimizerImpl {
    if (!DHTOptimizerImpl.instance) {
      DHTOptimizerImpl.instance = new DHTOptimizerImpl(options);
    }
    return DHTOptimizerImpl.instance;
  }

  // ===================================
  // Configuration
  // ===================================

  /**
   * Update DHT optimizer options
   */
  updateOptions(options: Partial<DHTOptions>): void {
    this.options = { ...this.options, ...options };
    this.saveNodeCache();
  }

  /**
   * Get current options
   */
  getOptions(): DHTOptions {
    return { ...this.options };
  }

  // ===================================
  // Node Cache Management
  // ===================================

  /**
   * Load cached DHT nodes from localStorage
   */
  private loadNodeCache(): void {
    if (typeof window === "undefined") return;

    try {
      const cached = localStorage.getItem(DHT_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();

        for (const node of parsed.nodes || []) {
          // Skip stale nodes
          if (now - node.lastSeen > this.options.nodeCacheTimeout) {
            continue;
          }

          const key = this.getNodeKey(node.address, node.port);
          this.nodeCache.set(key, node);
        }

        console.log("[DHTOptimizer] Loaded", this.nodeCache.size, "cached nodes");
      }
    } catch (error) {
      console.warn("[DHTOptimizer] Failed to load node cache:", error);
    }
  }

  /**
   * Save DHT node cache to localStorage
   */
  private saveNodeCache(): void {
    if (typeof window === "undefined") return;

    try {
      const nodes = Array.from(this.nodeCache.values());
      localStorage.setItem(
        DHT_STORAGE_KEY,
        JSON.stringify({
          nodes,
          updatedAt: Date.now(),
        })
      );
    } catch (error) {
      console.warn("[DHTOptimizer] Failed to save node cache:", error);
    }
  }

  /**
   * Get node cache key
   */
  private getNodeKey(address: string, port: number): string {
    return `${address}:${port}`;
  }

  /**
   * Add or update a node in the cache
   */
  updateNode(node: DHTNode): void {
    const key = this.getNodeKey(node.address, node.port);
    const existing = this.nodeCache.get(key);

    if (existing) {
      // Update existing node stats
      existing.lastSeen = node.lastSeen;
      // Before incrementing, save the old total for the average calculation
      const previousTotal = existing.successCount + existing.failureCount;
      existing.successCount += node.successCount;
      existing.failureCount += node.failureCount;
      // Update average latency
      if (node.averageLatency > 0) {
        existing.averageLatency =
          (existing.averageLatency * previousTotal + node.averageLatency) / (previousTotal + 1);
      }
    } else {
      // Add new node
      this.nodeCache.set(key, { ...node });

      // Cap nodeCache size to prevent unbounded growth (M7)
      if (this.nodeCache.size > 500) {
        const firstKey = this.nodeCache.keys().next().value;
        if (firstKey) this.nodeCache.delete(firstKey);
      }
    }

    // Debounced saveNodeCache (M10) - only save every 30 seconds
    if (Date.now() - this.lastSaveTime > 30000) {
      this.saveNodeCache();
      this.lastSaveTime = Date.now();
    }
  }

  /**
   * Record a successful connection to a node
   */
  recordSuccess(address: string, port: number, latency: number): void {
    const key = this.getNodeKey(address, port);
    const node = this.nodeCache.get(key);

    if (node) {
      node.lastSeen = Date.now();
      node.successCount++;
      const totalAttempts = node.successCount + node.failureCount;
      node.averageLatency =
        (node.averageLatency * (totalAttempts - 1) + latency) / totalAttempts;
    } else {
      this.updateNode({
        address,
        port,
        lastSeen: Date.now(),
        successCount: 1,
        failureCount: 0,
        averageLatency: latency,
      });
    }

    // Update connection stats
    const stats = this.connectionStats.get(key);
    if (stats) {
      stats.successes++;
    } else {
      this.connectionStats.set(key, { attempts: 1, successes: 1, failures: 0 });
    }
  }

  /**
   * Record a failed connection to a node
   */
  recordFailure(address: string, port: number): void {
    const key = this.getNodeKey(address, port);
    const node = this.nodeCache.get(key);

    if (node) {
      node.failureCount++;
    } else {
      // Track failed nodes so they stay in the cache for future reference
      this.nodeCache.set(key, {
        address,
        port,
        lastSeen: Date.now(),
        successCount: 0,
        failureCount: 1,
        averageLatency: 0,
      });

      // Cap nodeCache size to prevent unbounded growth (M7)
      if (this.nodeCache.size > 500) {
        const firstKey = this.nodeCache.keys().next().value;
        if (firstKey) this.nodeCache.delete(firstKey);
      }
    }

    // Update connection stats
    const stats = this.connectionStats.get(key);
    if (stats) {
      stats.attempts++;
      stats.failures++;
    } else {
      this.connectionStats.set(key, { attempts: 1, successes: 0, failures: 1 });
    }
  }

  /**
   * Get best DHT nodes sorted by success rate and latency
   */
  getBestNodes(limit: number = 10): DHTNode[] {
    const nodes = Array.from(this.nodeCache.values());

    return nodes
      .filter((n) => n.successCount > 0)
      .sort((a, b) => {
        // Sort by success rate first, then by latency
        const aRate = a.successCount / (a.successCount + a.failureCount);
        const bRate = b.successCount / (b.successCount + b.failureCount);

        if (bRate !== aRate) {
          return bRate - aRate;
        }

        return a.averageLatency - b.averageLatency;
      })
      .slice(0, limit);
  }

  /**
   * Get all bootstrap nodes (default + cached)
   */
  getBootstrapNodes(): DHTNode[] {
    const nodes = [...this.options.bootstrapNodes];

    // Add best cached nodes
    const bestCached = this.getBestNodes(this.options.maxPreconnectNodes);
    for (const cached of bestCached) {
      if (!nodes.some((n) => n.address === cached.address && n.port === cached.port)) {
        nodes.push(cached);
      }
    }

    return nodes.slice(0, this.options.maxPreconnectNodes);
  }

  // ===================================
  // Preconnection
  // ===================================

  /**
   * Pre-connect to DHT nodes to speed up future torrent connections
   */
  async preconnectToDHT(client: any): Promise<void> {
    if (!this.options.enablePreconnect) {
      return;
    }

    if (!client) {
      console.warn("[DHTOptimizer] No WebTorrent client provided");
      return;
    }

    this.webTorrentClient = client;

    const nodes = this.getBootstrapNodes();
    console.log("[DHTOptimizer] Pre-connecting to", nodes.length, "DHT nodes");

    // Preconnect to nodes in parallel
    const promises = nodes.map((node) => this.pingNode(client, node));

    await Promise.allSettled(promises);

    console.log("[DHTOptimizer] Pre-connection complete");
  }

  /**
   * Ping a DHT node to check connectivity and latency
   */
  private async pingNode(client: any, node: DHTNode): Promise<boolean> {
    const startTime = Date.now();

    try {
      // NOTE: Actual DHT ping requires sending a DHT query and waiting for a response.
      // This is a simplified health check. Real implementation should use dht.lookup or
      // the underlying WebTorrent DHT instance to send a proper ping and verify round-trip.
      // Currently records success unconditionally — latency reflects only local overhead.
      // TODO: Integrate with client.dht?.ping?.({ address, port }) when available.

      // Attempt a basic connectivity probe via WebTorrent's DHT if accessible
      if (client?.dht && typeof client.dht.ping === 'function') {
        await client.dht.ping({ host: node.address, port: node.port });
        const latency = Date.now() - startTime;
        this.recordSuccess(node.address, node.port, latency);
        return true;
      }

      // Fix M4: Don't record false success when ping is unavailable
      const latency = Date.now() - startTime;
      console.warn(
        `[DHTOptimizer] pingNode: no DHT ping available for ${node.address}:${node.port}, ` +
        `skipping unverified latency (${latency}ms)`
      );
      // Cannot verify - don't record false success
      return false;
    } catch (error) {
      this.recordFailure(node.address, node.port);
      return false;
    }
  }

  // ===================================
  // Tracker Integration
  // ===================================

  /**
   * Get optimized tracker list for WebTorrent
   * Combines default trackers with any cached successful trackers
   */
  getOptimizedTrackers(): string[] {
    const defaultTrackers = [
      "wss://tracker.webtorrent.dev",
      "wss://tracker.btorrent.xyz",
      "wss://tracker.openwebtorrent.com",
      "wss://tracker.fastcast.nz",
      "wss://tracker.files.fm:443/announce",
    ];

    // Add any additional trackers from successful connections
    const cachedTrackers: string[] = [];

    for (const node of this.nodeCache.values()) {
      if (node.successCount > 0 && node.address.includes("tracker")) {
        const url = node.port === 443
          ? `wss://${node.address}`
          : `ws://${node.address}:${node.port}`;
        if (!defaultTrackers.includes(url)) {
          cachedTrackers.push(url);
        }
      }
    }

    return [...defaultTrackers, ...cachedTrackers];
  }

  /**
   * Build magnet link with optimized trackers
   */
  buildMagnetWithOptimizedTrackers(
    infoHash: string,
    title?: string
  ): string {
    const trackers = this.getOptimizedTrackers();

    const parts = [
      `xt=urn:btih:${infoHash}`,
      title ? `dn=${encodeURIComponent(title)}` : "",
      ...trackers.map((t) => `tr=${encodeURIComponent(t)}`),
    ].filter(Boolean);

    return `magnet:?${parts.join("&")}`;
  }

  // ===================================
  // Statistics
  // ===================================

  /**
   * Get DHT connection statistics
   */
  getStats(): DHTStats {
    const nodes = Array.from(this.nodeCache.values());
    const activeNodes = nodes.filter(
      (n) => Date.now() - n.lastSeen < this.options.nodeCacheTimeout
    );

    let totalConnections = 0;
    let successfulConnections = 0;
    let failedConnections = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const stats of this.connectionStats.values()) {
      totalConnections += stats.attempts;
      successfulConnections += stats.successes;
      failedConnections += stats.failures;
    }

    for (const node of nodes) {
      if (node.averageLatency > 0) {
        totalLatency += node.averageLatency;
        latencyCount++;
      }
    }

    return {
      totalNodes: nodes.length,
      activeNodes: activeNodes.length,
      totalConnections,
      successfulConnections,
      failedConnections,
      averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
    };
  }

  /**
   * Clear node cache
   */
  clearCache(): void {
    this.nodeCache.clear();
    this.connectionStats.clear();
    this.saveNodeCache();
    console.log("[DHTOptimizer] Cache cleared");
  }

  /**
   * Remove stale nodes from cache
   */
  removeStaleNodes(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, node] of this.nodeCache.entries()) {
      if (now - node.lastSeen > this.options.nodeCacheTimeout) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.nodeCache.delete(key);
      this.connectionStats.delete(key);
    }

    // Cap connectionStats size to prevent unbounded growth (M9)
    if (this.connectionStats.size > 500) {
      const entries = Array.from(this.connectionStats.entries())
        .sort((a, b) => (b[1].attempts) - (a[1].attempts));
      this.connectionStats.clear();
      for (const [key, value] of entries.slice(0, 250)) {
        this.connectionStats.set(key, value);
      }
    }

    if (toDelete.length > 0) {
      console.log("[DHTOptimizer] Removed", toDelete.length, "stale nodes");
      this.saveNodeCache();
    }
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.connectionStats.clear();
    console.log("[DHTOptimizer] Stats reset");
  }

  /**
   * Check if this instance is still active (not destroyed)
   */
  isActive(): boolean {
    return !this._destroyed;
  }

  /**
   * Destroy the optimizer, clearing all state (L10)
   */
  destroy(): void {
    this._destroyed = true;
    this.connectionStats.clear();
    this.nodeCache.clear();
    this.saveNodeCache();
    this.webTorrentClient = null;
    DHTOptimizerImpl.instance = undefined as any;
  }
}

// ===================================
// Export lazy singleton
// ===================================

let _dhtOptimizer: DHTOptimizerImpl | null = null;

function getDHTOptimizer(): DHTOptimizerImpl {
  if (!_dhtOptimizer || !_dhtOptimizer.isActive()) {
    _dhtOptimizer = DHTOptimizerImpl.getInstance();
  }
  return _dhtOptimizer;
}

export { DHTOptimizerImpl, getDHTOptimizer };

// ===================================
// Export convenience functions
// ===================================

export function optimizeDHT(options?: Partial<DHTOptions>): DHTOptimizerImpl {
  const dht = getDHTOptimizer();
  if (options) {
    dht.updateOptions(options);
  }
  return dht;
}

export async function preconnectToDHT(client: any): Promise<void> {
  return getDHTOptimizer().preconnectToDHT(client);
}

export function getOptimizedTrackers(): string[] {
  return getDHTOptimizer().getOptimizedTrackers();
}

export function buildMagnetWithOptimizedTrackers(
  infoHash: string,
  title?: string
): string {
  return getDHTOptimizer().buildMagnetWithOptimizedTrackers(infoHash, title);
}

export function getDHTStats(): DHTStats {
  return getDHTOptimizer().getStats();
}

export function recordDHTSuccess(address: string, port: number, latency: number): void {
  getDHTOptimizer().recordSuccess(address, port, latency);
}

export function recordDHTFailure(address: string, port: number): void {
  getDHTOptimizer().recordFailure(address, port);
}
