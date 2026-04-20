/**
 * Alerts Manager
 * System for monitoring and alerting on critical issues
 *
 * Phase 9: Monitoring & Analytics
 */

import type { Alert } from "@/types/analytics";
import type { AnalyticsSummaryResult } from "@/lib/monitoring-data";
import { getAnalyticsSummaryData, getSeedServerStatusSnapshot, getTorrentHealthSnapshot } from "@/lib/monitoring-data";

interface AlertRule {
  type: Alert["type"];
  severity: Alert["severity"];
  check: () => Promise<boolean>;
  message: () => string;
  metadata?: () => Record<string, unknown>;
}

class AlertsManager {
  private alerts: Map<string, Alert> = new Map();
  private rules: AlertRule[] = [];
  private checkInterval = 60000; // Check every minute
  private checkTimer: NodeJS.Timeout | null = null;
  private isChecking = false; // Prevent concurrent checkRules calls
  private static readonly MAX_ALERTS = 500;
  private static readonly RESOLVED_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    // High fallback rate alert
    this.addRule({
      type: "high_fallback_rate",
      severity: "warning",
      check: async () => {
        const summary = await this.getAnalyticsSummary("hour");
        return summary.fallbackRate > 50; // > 50% fallback rate
      },
      message: () => {
        const summary = this.getLastSummary();
        return `High fallback rate detected: ${summary.fallbackRate}% of streams falling back`;
      },
      metadata: () => ({
        fallbackRate: this.getLastSummary().fallbackRate,
        threshold: 50,
      }),
    });

    // Seed server down alert
    this.addRule({
      type: "seed_server_down",
      severity: "critical",
      check: async () => {
        const status = await this.getSeedServerStatus();
        return !status.online;
      },
      message: () => {
        const status = this.getLastSeedServerStatus();
        return `Seed server is down. Last heartbeat: ${new Date(status.lastHeartbeat).toISOString()}`;
      },
      metadata: () => ({
        lastHeartbeat: this.getLastSeedServerStatus().lastHeartbeat,
        expectedHeartbeat: Date.now() - 60000, // 1 minute ago
      }),
    });

    // Dead torrent alert
    this.addRule({
      type: "dead_torrent",
      severity: "warning",
      check: async () => {
        const health = await this.getTorrentHealth();
        return health.some((t) => t.status === "dead" && t.seeders === 0);
      },
      message: () => {
        const health = this.getLastTorrentHealth();
        const deadCount = health.filter((t) => t.status === "dead").length;
        return `${deadCount} torrents detected as dead (0 seeders)`;
      },
      metadata: () => {
        const health = this.getLastTorrentHealth();
        return {
          deadTorrents: health.filter((t) => t.status === "dead").length,
          totalTorrents: health.length,
        };
      },
    });

    // Low seed count alert
    this.addRule({
      type: "low_seed_count",
      severity: "info",
      check: async () => {
        const summary = await this.getAnalyticsSummary("hour");
        return summary.averageSeederCount > 0 && summary.averageSeederCount < 3;
      },
      message: () => {
        const summary = this.getLastSummary();
        return `Low average seeder count: ${summary.averageSeederCount} seeds per torrent`;
      },
      metadata: () => ({
        averageSeederCount: this.getLastSummary().averageSeederCount,
        threshold: 3,
      }),
    });
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(async () => {
      try {
        await this.checkRules();
      } catch (error) {
        console.error('Alert check failed:', error);
      }
    }, this.checkInterval);

    // Run initial check
    this.checkRules();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Check all alert rules
   */
  private async checkRules(): Promise<void> {
    // Prevent concurrent checkRules calls (H2)
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      for (const rule of this.rules) {
        try {
          const triggered = await rule.check();

          if (triggered) {
            await this.createAlert(rule);
          }
        } catch (error) {
          console.error(`Error checking rule ${rule.type}:`, error);
        }
      }
    } finally {
      this.isChecking = false;
    }

    // Cleanup old resolved alerts (H9)
    this.cleanupAlerts();
  }

  /**
   * Cleanup old resolved alerts and enforce max cap
   */
  private cleanupAlerts(): void {
    const now = Date.now();

    // Remove resolved alerts older than 24 hours
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && (now - alert.resolvedAt > AlertsManager.RESOLVED_TTL)) {
        this.alerts.delete(id);
      }
    }

    // Enforce max cap: remove oldest resolved alerts if over limit
    if (this.alerts.size > AlertsManager.MAX_ALERTS) {
      const resolvedAlerts = Array.from(this.alerts.entries())
        .filter(([, a]) => a.resolved)
        .sort(([, a], [, b]) => (a.resolvedAt || a.timestamp) - (b.resolvedAt || b.timestamp));

      const toRemove = this.alerts.size - AlertsManager.MAX_ALERTS;
      for (let i = 0; i < Math.min(toRemove, resolvedAlerts.length); i++) {
        this.alerts.delete(resolvedAlerts[i][0]);
      }
      // Fallback: remove oldest unresolved alerts if still over limit
      if (this.alerts.size > AlertsManager.MAX_ALERTS) {
        const oldestUnresolved = Array.from(this.alerts.entries())
          .filter(([, a]) => !a.resolved)
          .sort(([, a], [, b]) => a.timestamp - b.timestamp);
        const remaining = this.alerts.size - AlertsManager.MAX_ALERTS;
        for (let i = 0; i < Math.min(remaining, oldestUnresolved.length); i++) {
          this.alerts.delete(oldestUnresolved[i][0]);
        }
      }
    }
  }

  /**
   * Create alert if not exists
   */
  private async createAlert(rule: AlertRule): Promise<void> {
    // Check if alert already exists and is not resolved
    const existingAlert = Array.from(this.alerts.values()).find(
      (a) => a.type === rule.type && !a.resolved
    );

    if (existingAlert) {
      return; // Alert already active
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2,9)}_${rule.type}`,
      type: rule.type,
      severity: rule.severity,
      message: rule.message(),
      timestamp: Date.now(),
      resolved: false,
      metadata: rule.metadata?.(),
    };

    this.alerts.set(alert.id, alert);

    // Call webhook or send notification
    await this.notifyAlert(alert);
  }

  /**
   * Manually create an alert (public method for admin use)
   */
  manualCreateAlert(
    type: Alert["type"],
    severity: Alert["severity"],
    message: string,
    metadata?: Record<string, unknown>
  ): Alert {
    const alert: Alert = {
      id: `alert_manual_${Date.now()}_${Math.random().toString(36).slice(2,9)}_${type}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      resolved: false,
      metadata,
    };

    this.alerts.set(alert.id, alert);

    // Call webhook or send notification
    this.notifyAlert(alert).catch((err) => {
      console.error("[AlertsManager] Error notifying alert:", err);
    });

    return alert;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter((a) => !a.resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Notify alert (webhook, email, etc.)
   */
  private async notifyAlert(alert: Alert): Promise<void> {
    // In production, send to webhook, email, Slack, etc.
    console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);

    // Example: Send to webhook
    // await fetch(process.env.ALERT_WEBHOOK_URL, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(alert),
    // });
  }

  /**
   * Fetch analytics summary
   */
  private async getAnalyticsSummary(period: string): Promise<AnalyticsSummaryResult> {
    try {
      const data = await getAnalyticsSummaryData(period);
      this.lastSummary = data;
      return data;
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      return this.lastSummary || this.getDefaultSummary();
    }
  }

  /**
   * Fetch seed server status
   */
  private async getSeedServerStatus(): Promise<{ online: boolean; lastHeartbeat: number }> {
    try {
      const data = await getSeedServerStatusSnapshot();
      this.lastSeedServerStatus = data;
      return data;
    } catch (error) {
      console.error("Error fetching seed server status:", error);
      return this.lastSeedServerStatus || this.getDefaultSeedServerStatus();
    }
  }

  /**
   * Fetch torrent health
   */
  private async getTorrentHealth(): Promise<Array<{ status: string; seeders: number }>> {
    try {
      this.lastTorrentHealth = await getTorrentHealthSnapshot();
      return this.lastTorrentHealth;
    } catch (error) {
      console.error("Error fetching torrent health:", error);
      return this.lastTorrentHealth || [];
    }
  }

  private lastSummary: AnalyticsSummaryResult | null = null;
  private lastSeedServerStatus: { online: boolean; lastHeartbeat: number } | null = null;
  private lastTorrentHealth: Array<{ status: string; seeders: number }> = [];

  private getLastSummary() {
    return this.lastSummary || this.getDefaultSummary();
  }

  private getLastSeedServerStatus() {
    return this.lastSeedServerStatus || this.getDefaultSeedServerStatus();
  }

  private getLastTorrentHealth() {
    return this.lastTorrentHealth || [];
  }

  private getDefaultSummary(): AnalyticsSummaryResult {
    return {
      period: "hour",
      totalStreams: 0,
      methodDistribution: {
        hls: 0,
        webtorrent: 0,
        hybrid: 0,
      },
      averageWatchTime: 0,
      totalBandwidthSaved: 0,
      fallbackRate: 0,
      deadTorrentRate: 0,
      averageSeederCount: 0,
      averageBufferTime: 0,
      topAnime: [],
      playbackErrors: 0,
      bandwidthSavings: {
        period: "hour",
        totalBytes: 0,
        p2pBytes: 0,
        cdnBytes: 0,
        savingsPercent: 0,
        costSavings: 0,
        streamCount: 0,
        estimated: false,
      },
    };
  }

  private getDefaultSeedServerStatus() {
    return {
      online: false,
      lastHeartbeat: 0,
    };
  }
}

// Singleton instance
let alertsManagerInstance: AlertsManager | null = null;

export function getAlertsManager(): AlertsManager {
  if (!alertsManagerInstance) {
    alertsManagerInstance = new AlertsManager();
    alertsManagerInstance.startMonitoring();
  }
  return alertsManagerInstance;
}

export function destroyAlertsManager(): void {
  if (alertsManagerInstance) {
    alertsManagerInstance.stopMonitoring();
    alertsManagerInstance = null;
  }
}
