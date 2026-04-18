/**
 * Admin Dashboard Page
 * Admin dashboard for monitoring streaming analytics
 *
 * Phase 9: Monitoring & Analytics
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  Activity,
  Users,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Server,
  Zap,
  Clock,
  Film,
  RefreshCw,
  Bell,
} from "lucide-react";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger('admin-dashboard');

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

interface AnalyticsData {
  totalStreams: number;
  methodDistribution: {
    hls: number;
    webtorrent: number;
    hybrid: number;
  };
  averageWatchTime: number;
  bandwidthSavings: {
    totalBytes: number;
    p2pBytes: number;
    cdnBytes: number;
    savingsPercent: number;
    costSavings: number;
    streamCount: number;
  };
  fallbackRate: number;
  averageSeederCount: number;
  averageBufferTime: number;
  topAnime: Array<{
    animeId: number;
    animeTitle: string;
    streams: number;
  }>;
}

interface SeedServerStatus {
  online: boolean;
  activeTorrents: number;
  totalPeers: number;
  uploadSpeed: number;
  uptime: number;
  lastHeartbeat: number;
  version: string;
}

interface Alert {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, unknown>;
}

export default function AdminDashboardPage() {
  // Client-side auth guard
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { window.location.href = '/admin/login'; return; }
  }, []);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [seedServerStatus, setSeedServerStatus] = useState<SeedServerStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"hour" | "day" | "week" | "month">("day");

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const authHeaders = getAuthHeaders();
      const [analyticsRes, serverRes, alertsRes] = await Promise.all([
        fetch(`/api/analytics/summary?period=${period}`),
        fetch("/api/admin/seed-server/status", { headers: authHeaders }),
        fetch("/api/admin/alerts", { headers: authHeaders }),
      ]);

      const [analyticsData, serverData, alertsData] = await Promise.all([
        analyticsRes.json(),
        serverRes.json(),
        alertsRes.json(),
      ]);

      setAnalytics(analyticsData);
      setSeedServerStatus(serverData);
      setAlerts(alertsData.alerts || []);
    } catch (error) {
      logger.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success("Alert resolved");
        setAlerts(alerts.filter((a) => a.id !== alertId));
      }
    } catch (error) {
      logger.error("Error resolving alert:", error);
      toast.error("Failed to resolve alert");
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + "/s";
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-2">Streaming analytics and monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "hour" | "day" | "week" | "month")}
              className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hour">Last Hour</option>
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
        </div>

        {/* Alerts Section */}
        {activeAlerts.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-500" />
                Active Alerts ({activeAlerts.length})
              </h2>
            </div>
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border ${
                    alert.severity === "critical"
                      ? "bg-red-900/20 border-red-500"
                      : alert.severity === "warning"
                      ? "bg-yellow-900/20 border-yellow-500"
                      : "bg-blue-900/20 border-blue-500"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {alert.severity === "critical" && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {alert.severity === "warning" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                        {alert.severity === "info" && <Activity className="w-4 h-4 text-blue-500" />}
                        <span className="font-medium">{alert.message}</span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Streams */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Streams</p>
                <p className="text-3xl font-bold mt-2">
                  {analytics?.totalStreams.toLocaleString() || "0"}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Film className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Active Viewers */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Watch Time</p>
                <p className="text-3xl font-bold mt-2">
                  {analytics ? formatDuration(analytics.averageWatchTime) : "0m"}
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Clock className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Bandwidth Saved */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Bandwidth Saved</p>
                <p className="text-3xl font-bold mt-2 text-green-500">
                  {(analytics?.bandwidthSavings?.savingsPercent ?? 0).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>

          {/* Cost Savings */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Cost Savings</p>
                <p className="text-3xl font-bold mt-2 text-green-500">
                  ${(analytics?.bandwidthSavings?.costSavings ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Zap className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Streaming Methods */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Streaming Methods</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">HLS (CDN)</span>
                  <span className="font-medium">
                    {analytics?.methodDistribution.hls || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${
                        analytics
                          ? (() => {
                              const total =
                                (analytics.methodDistribution.hls || 0) +
                                (analytics.methodDistribution.webtorrent || 0) +
                                (analytics.methodDistribution.hybrid || 0);
                              return total > 0
                                ? Math.round(((analytics.methodDistribution.hls || 0) / total) * 100)
                                : 0;
                            })()
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">WebTorrent (P2P)</span>
                  <span className="font-medium">
                    {analytics?.methodDistribution.webtorrent || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${
                        analytics
                          ? (() => {
                              const total =
                                (analytics.methodDistribution.hls || 0) +
                                (analytics.methodDistribution.webtorrent || 0) +
                                (analytics.methodDistribution.hybrid || 0);
                              return total > 0
                                ? Math.round(((analytics.methodDistribution.webtorrent || 0) / total) * 100)
                                : 0;
                            })()
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Hybrid</span>
                  <span className="font-medium">
                    {analytics?.methodDistribution.hybrid || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${
                        analytics
                          ? (() => {
                              const total =
                                (analytics.methodDistribution.hls || 0) +
                                (analytics.methodDistribution.webtorrent || 0) +
                                (analytics.methodDistribution.hybrid || 0);
                              return total > 0
                                ? Math.round(((analytics.methodDistribution.hybrid || 0) / total) * 100)
                                : 0;
                            })()
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seed Server Status */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5" />
              Seed Server Status
            </h3>
            {seedServerStatus ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  <span
                    className={`flex items-center gap-2 ${
                      seedServerStatus.online ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {seedServerStatus.online ? (
                      <>
                        <CheckCircle className="w-4 h-4" /> Online
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" /> Offline
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Active Torrents</span>
                  <span className="font-medium">{seedServerStatus.activeTorrents}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Peers</span>
                  <span className="font-medium">{seedServerStatus.totalPeers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Upload Speed</span>
                  <span className="font-medium">
                    {formatSpeed(seedServerStatus.uploadSpeed)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Uptime</span>
                  <span className="font-medium">{formatDuration(seedServerStatus.uptime)}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Loading...</p>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fallback Rate */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Fallback Rate</span>
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-bold">{analytics?.fallbackRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {analytics && analytics.fallbackRate > 50 ? (
                <span className="text-yellow-500">Above 50% threshold</span>
              ) : (
                <span className="text-green-500">Within normal range</span>
              )}
            </p>
          </div>

          {/* Average Seeders */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Avg Seeders</span>
              <Users className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-bold">{analytics?.averageSeederCount.toFixed(1)}</p>
            <p className="text-sm text-gray-500 mt-1">
              {analytics && analytics.averageSeederCount < 3 ? (
                <span className="text-yellow-500">Low seeder count</span>
              ) : (
                <span className="text-green-500">Healthy</span>
              )}
            </p>
          </div>

          {/* Buffer Time */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Avg Buffer Time</span>
              <Download className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-bold">{analytics?.averageBufferTime}ms</p>
            <p className="text-sm text-gray-500 mt-1">
              {analytics && analytics.averageBufferTime > 5000 ? (
                <span className="text-yellow-500">High buffer time</span>
              ) : (
                <span className="text-green-500">Good performance</span>
              )}
            </p>
          </div>
        </div>

        {/* Top Anime */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Top Anime This Period</h3>
          <div className="space-y-3">
            {analytics?.topAnime.slice(0, 10).map((anime, index) => (
              <div
                key={anime.animeId}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-500">#{index + 1}</span>
                  <span className="font-medium">{anime.animeTitle}</span>
                </div>
                <span className="text-gray-400">{anime.streams} streams</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
