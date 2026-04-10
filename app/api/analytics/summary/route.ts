/**
 * Analytics Summary API
 * Endpoint for retrieving analytics summary data
 *
 * GET /api/analytics/summary?period=hour|day|week|month
 *
 * Phase 9: Monitoring & Analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  method?: string;
  animeId?: number;
  episode?: number;
  watchTime?: number;
  animeTitle?: string;
  bufferTime?: number;
  seederCount?: number;
  fallbackReason?: string;
  quality?: string;
  [key: string]: unknown;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/summary
 * Get analytics summary for the specified period
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "day";

    // Calculate time range
    const now = Date.now();
    let startTime: number;

    switch (period) {
      case "hour":
        startTime = now - 60 * 60 * 1000;
        break;
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = now - 24 * 60 * 60 * 1000;
    }

    // Read analytics events from files
    const events = await loadAnalyticsEvents(startTime);

    // Calculate summary
    const summary = calculateSummary(events, period);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error generating analytics summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

/**
 * Load analytics events from files
 */
async function loadAnalyticsEvents(startTime: number) {
  try {
    const analyticsDir = join(process.cwd(), "data", "analytics");
    const files = await readdir(analyticsDir);

    const events: AnalyticsEvent[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const filepath = join(analyticsDir, file);
          const content = await readFile(filepath, "utf-8");
          const fileEvents = JSON.parse(content);

          // Filter events by time range
          const filteredEvents = fileEvents.filter(
            (event: AnalyticsEvent) => event.timestamp >= startTime
          );

          events.push(...filteredEvents);
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }
    }

    return events;
  } catch (error) {
    console.error("Error loading analytics events:", error);
    return [];
  }
}

/**
 * Calculate analytics summary
 */
function calculateSummary(events: AnalyticsEvent[], period: string) {
  const playbackStartEvents = events.filter((e) => e.eventType === "playback_start");
  const playbackEndEvents = events.filter((e) => e.eventType === "playback_end");
  const fallbackEvents = events.filter((e) => e.eventType === "fallback");
  const bufferingEvents = events.filter((e) => e.eventType === "buffering");
  const torrentStatsEvents = events.filter((e) => e.eventType === "torrent_stats");

  // Method distribution
  const methodDistribution = {
    hls: 0,
    webtorrent: 0,
    hybrid: 0,
  };

  playbackStartEvents.forEach((event) => {
    if (event.method && event.method in methodDistribution) {
      methodDistribution[event.method as keyof typeof methodDistribution]++;
    }
  });

  // Calculate total streams
  const totalStreams = playbackStartEvents.length;

  // Calculate average watch time
  const totalWatchTime = playbackEndEvents.reduce((sum, event) => sum + (event.duration as number || 0), 0);
  const averageWatchTime = playbackEndEvents.length > 0
    ? totalWatchTime / playbackEndEvents.length
    : 0;

  // Calculate fallback rate
  const fallbackRate = totalStreams > 0
    ? fallbackEvents.length / totalStreams
    : 0;

  // Calculate average seeder count
  const totalSeeders = torrentStatsEvents.reduce((sum, event) => sum + (event.seeders as number || 0), 0);
  const averageSeederCount = torrentStatsEvents.length > 0
    ? totalSeeders / torrentStatsEvents.length
    : 0;

  // Calculate average buffer time
  const totalBufferTime = bufferingEvents.reduce((sum, event) => sum + (event.bufferDuration as number || 0), 0);
  const averageBufferTime = bufferingEvents.length > 0
    ? Math.round(totalBufferTime / bufferingEvents.length)
    : 0;

  // Calculate top anime
  const animeStreamCounts = new Map<number, { title: string; count: number }>();
  playbackStartEvents.forEach((event) => {
    const animeId = event.animeId as number;
    const animeTitle = event.animeTitle as string;
    const current = animeStreamCounts.get(animeId) || { title: animeTitle, count: 0 };
    current.count++;
    animeStreamCounts.set(animeId, current);
  });

  const topAnime = Array.from(animeStreamCounts.entries())
    .map(([animeId, data]) => ({
      animeId,
      animeTitle: data.title,
      streams: data.count,
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, 10);

  // Estimate bandwidth savings
  // Assume average stream uses 1GB for CDN, P2P saves 80%
  const p2pStreams = methodDistribution.webtorrent + methodDistribution.hybrid;
  const totalBytes = totalStreams * 1024 * 1024 * 1024; // 1GB per stream
  const p2pBytes = p2pStreams * 1024 * 1024 * 1024 * 0.8; // 80% P2P
  const cdnBytes = totalBytes - p2pBytes;
  const bandwidthSaved = totalBytes - cdnBytes;
  const savingsPercent = totalBytes > 0 ? (bandwidthSaved / totalBytes) * 100 : 0;

  // Estimate cost savings (assuming $0.01 per GB)
  const costSavings = (bandwidthSaved / (1024 * 1024 * 1024)) * 0.01;

  return {
    period,
    totalStreams,
    methodDistribution,
    averageWatchTime: Math.round(averageWatchTime),
    totalBandwidthSaved: bandwidthSaved,
    fallbackRate: Math.round(fallbackRate * 1000) / 10, // percentage with 1 decimal
    deadTorrentRate: 0, // Would need more complex tracking
    averageSeederCount: Math.round(averageSeederCount * 10) / 10,
    averageBufferTime: Math.round(averageBufferTime),
    topAnime,
    bandwidthSavings: {
      period,
      totalBytes,
      p2pBytes,
      cdnBytes,
      savingsPercent: Math.round(savingsPercent * 10) / 10,
      costSavings: Math.round(costSavings * 100) / 100,
      streamCount: totalStreams,
    },
  };
}
