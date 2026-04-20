import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

import type { AnalyticsEvent, SeedServerStatus, TorrentHealth } from "@/types/analytics";

export interface AnalyticsSummaryResult {
  period: string;
  totalStreams: number;
  methodDistribution: {
    hls: number;
    webtorrent: number;
    hybrid: number;
  };
  averageWatchTime: number;
  totalBandwidthSaved: number;
  fallbackRate: number;
  deadTorrentRate: number;
  averageSeederCount: number;
  averageBufferTime: number;
  topAnime: Array<{ animeId: number; animeTitle: string; streams: number }>;
  playbackErrors: number;
  bandwidthSavings: {
    period: string;
    totalBytes: number;
    p2pBytes: number;
    cdnBytes: number;
    savingsPercent: number;
    costSavings: number;
    streamCount: number;
    estimated: boolean;
  };
}

interface MagnetEntry {
  animeId: number;
  animeTitle: string;
  episode: number;
  infoHash: string;
  seeders: number;
  leechers: number;
  lastChecked: number;
  status: "active" | "dead" | "pending" | "verified";
}

interface MagnetsDatabase {
  magnets: MagnetEntry[];
}

const ANALYTICS_DIR = join(process.cwd(), "data", "analytics");
const MAGNETS_DB_PATH = join(process.cwd(), "data", "magnets.json");

let cachedSummary:
  | {
      period: string;
      summary: AnalyticsSummaryResult;
      computedAt: number;
    }
  | null = null;

const SUMMARY_CACHE_TTL_MS = 60 * 1000;

export function getPeriodStart(period: string, now = Date.now()): number {
  switch (period) {
    case "hour":
      return now - 60 * 60 * 1000;
    case "day":
      return now - 24 * 60 * 60 * 1000;
    case "week":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "month":
      return now - 30 * 24 * 60 * 60 * 1000;
    default:
      return now - 24 * 60 * 60 * 1000;
  }
}

export async function loadAnalyticsEvents(startTime: number): Promise<AnalyticsEvent[]> {
  try {
    if (!existsSync(ANALYTICS_DIR)) {
      return [];
    }

    const files = await readdir(ANALYTICS_DIR);
    const events: AnalyticsEvent[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const content = await readFile(join(ANALYTICS_DIR, file), "utf-8");
        const parsed = JSON.parse(content) as AnalyticsEvent[];
        events.push(...parsed.filter((event) => event.timestamp >= startTime));
      } catch (error) {
        console.error(`[MonitoringData] Failed to read analytics file ${file}:`, error);
      }
    }

    return events;
  } catch (error) {
    console.error("[MonitoringData] Failed to load analytics events:", error);
    return [];
  }
}

export function calculateAnalyticsSummary(events: AnalyticsEvent[], period: string): AnalyticsSummaryResult {
  const playbackStartEvents = events.filter((e) => e.eventType === "playback_start");
  const playbackEndEvents = events.filter((e) => e.eventType === "playback_end");
  const playbackErrorEvents = events.filter((e) => e.eventType === "playback_error");
  const fallbackEvents = events.filter((e) => e.eventType === "fallback");
  const bufferingEvents = events.filter((e) => e.eventType === "buffering");
  const torrentStatsEvents = events.filter((e) => e.eventType === "torrent_stats");

  const methodDistribution = { hls: 0, webtorrent: 0, hybrid: 0 };

  for (const event of playbackStartEvents) {
    if (event.method && event.method in methodDistribution) {
      methodDistribution[event.method]++;
    }
  }

  const totalStreams = playbackStartEvents.length;
  const totalWatchTime = playbackEndEvents.reduce((sum, event) => sum + (event.duration || 0), 0);
  const averageWatchTime = playbackEndEvents.length > 0 ? totalWatchTime / playbackEndEvents.length : 0;
  const fallbackRate = totalStreams > 0 ? (fallbackEvents.length / totalStreams) * 100 : 0;

  const totalSeeders = torrentStatsEvents.reduce((sum, event) => sum + (event.seeders || 0), 0);
  const averageSeederCount = torrentStatsEvents.length > 0 ? totalSeeders / torrentStatsEvents.length : 0;

  const totalBufferTime = bufferingEvents.reduce((sum, event) => sum + (event.bufferDuration || 0), 0);
  const averageBufferTime = bufferingEvents.length > 0 ? totalBufferTime / bufferingEvents.length : 0;

  const animeStreamCounts = new Map<number, { title: string; count: number }>();
  for (const event of playbackStartEvents) {
    const animeId = event.animeId;
    const animeTitle = event.animeTitle || `Anime ${animeId}`;
    const current = animeStreamCounts.get(animeId) || { title: animeTitle, count: 0 };
    current.count++;
    animeStreamCounts.set(animeId, current);
  }

  const topAnime = Array.from(animeStreamCounts.entries())
    .map(([animeId, data]) => ({
      animeId,
      animeTitle: data.title,
      streams: data.count,
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, 10);

  const measuredP2pBytes = torrentStatsEvents.reduce((sum, event) => sum + (event.p2pBytes || 0), 0);
  const measuredCdnBytes = torrentStatsEvents.reduce((sum, event) => sum + (event.cdnBytes || 0), 0);
  const totalBytes = measuredP2pBytes + measuredCdnBytes;
  const savingsPercent = totalBytes > 0 ? (measuredP2pBytes / totalBytes) * 100 : 0;
  const costSavings = (measuredP2pBytes / (1024 * 1024 * 1024)) * 0.01;

  return {
    period,
    totalStreams,
    methodDistribution,
    averageWatchTime: Math.round(averageWatchTime),
    totalBandwidthSaved: measuredP2pBytes,
    fallbackRate: Math.round(fallbackRate * 10) / 10,
    deadTorrentRate: 0,
    averageSeederCount: Math.round(averageSeederCount * 10) / 10,
    averageBufferTime: Math.round(averageBufferTime),
    topAnime,
    playbackErrors: playbackErrorEvents.length,
    bandwidthSavings: {
      period,
      totalBytes,
      p2pBytes: measuredP2pBytes,
      cdnBytes: measuredCdnBytes,
      savingsPercent: Math.round(savingsPercent * 10) / 10,
      costSavings: Math.round(costSavings * 100) / 100,
      streamCount: totalStreams,
      estimated: false,
    },
  };
}

export async function getAnalyticsSummaryData(period: string): Promise<AnalyticsSummaryResult> {
  if (
    cachedSummary &&
    cachedSummary.period === period &&
    Date.now() - cachedSummary.computedAt < SUMMARY_CACHE_TTL_MS
  ) {
    return cachedSummary.summary;
  }

  const startTime = getPeriodStart(period);
  const events = await loadAnalyticsEvents(startTime);
  const summary = calculateAnalyticsSummary(events, period);

  cachedSummary = {
    period,
    summary,
    computedAt: Date.now(),
  };

  return summary;
}

async function readMagnetsDatabase(): Promise<MagnetsDatabase> {
  try {
    if (!existsSync(MAGNETS_DB_PATH)) {
      return { magnets: [] };
    }

    const raw = await readFile(MAGNETS_DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as MagnetsDatabase;
    return { magnets: parsed.magnets || [] };
  } catch (error) {
    console.error("[MonitoringData] Failed to read magnets database:", error);
    return { magnets: [] };
  }
}

export async function getTorrentHealthSnapshot(): Promise<TorrentHealth[]> {
  const db = await readMagnetsDatabase();

  return db.magnets.map((magnet) => {
    const status =
      magnet.seeders <= 0 ? "dead" : magnet.seeders < 3 ? "struggling" : "healthy";

    return {
      infoHash: magnet.infoHash,
      animeId: magnet.animeId,
      animeTitle: magnet.animeTitle,
      episode: magnet.episode,
      seeders: magnet.seeders,
      leechers: magnet.leechers,
      lastChecked: magnet.lastChecked,
      status,
      trend: "stable",
    };
  });
}

export async function getSeedServerStatusSnapshot(): Promise<SeedServerStatus> {
  const torrentHealth = await getTorrentHealthSnapshot();

  return {
    online: true,
    activeTorrents: torrentHealth.length,
    totalPeers: torrentHealth.reduce((sum, torrent) => sum + torrent.seeders + torrent.leechers, 0),
    uploadSpeed: 0,
    uptime: 0,
    lastHeartbeat: Date.now(),
    version: "1.0.0",
  };
}
