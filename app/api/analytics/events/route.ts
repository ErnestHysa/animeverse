/**
 * Analytics Events API
 * Endpoint for receiving analytics events from clients
 *
 * POST /api/analytics/events
 *
 * Phase 9: Monitoring & Analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-memory event storage (in production, use a proper database)
// For now, we'll store events in memory and write to a file periodically
interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  [key: string]: unknown;
}

const analyticsEvents: AnalyticsEvent[] = [];
const MAX_ANALYTICS_EVENTS = 10000; // Fix H3: Cap events array size

// Fix C2: Whitelist of allowed event types
const ALLOWED_EVENT_TYPES = new Set([
  "playback_start",
  "playback_end",
  "fallback",
  "buffering",
  "torrent_stats",
  "quality_change",
]);

// Fix C2: Whitelist of allowed event fields
const ALLOWED_EVENT_FIELDS = new Set([
  "eventType",
  "timestamp",
  "id",
  "sessionId",
  "animeId",
  "animeTitle",
  "episode",
  "method",
  "quality",
  "sourceProvider",
  "userAgent",
  "connectionType",
  "duration",
  "completionRate",
  "reasons",
  "fromMethod",
  "toMethod",
  "reason",
  "timeToFallback",
  "bufferDuration",
  "currentTime",
  "seeders",
  "leechers",
  "downloadSpeed",
  "uploadSpeed",
  "progress",
  "infoHash",
  "fromQuality",
  "toQuality",
]);

const MAX_EVENTS_PER_REQUEST = 20;
const MAX_EVENT_SIZE_BYTES = 1024; // 1KB per event

/**
 * POST /api/analytics/events
 * Receive analytics events from clients
 */
export async function POST(request: NextRequest) {
  try {
    // Fix H3: Basic origin check — only accept events from the app itself
    const origin = request.headers.get('origin');
    const host = request.headers.get('host') || '';
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const hostWithoutPort = host.split(':')[0];
        const isAllowedOrigin =
          originHost === 'localhost' ||
          originHost === '127.0.0.1' ||
          originHost.endsWith('.animeverse.app') ||
          originHost === hostWithoutPort;
        if (!isAllowedOrigin) {
          return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      }
    }

    // Body size check
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 1048576) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid events array" }, { status: 400 });
    }

    // Limit events array length (tightened from 100 to 20)
    if (events.length > 20) {
      return NextResponse.json({ error: "Too many events. Maximum 20 events per request." }, { status: 400 });
    }

    // Check approximate payload size
    const payloadSize = JSON.stringify(events).length;
    if (payloadSize > 1024 * 1024) { // 1MB limit
      return NextResponse.json({ error: "Payload too large. Maximum 1MB per request." }, { status: 400 });
    }

    // Fix C2: Validate and sanitize each event
    const sanitizedEvents: AnalyticsEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Validate event is an object
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return NextResponse.json(
          { error: `Event at index ${i} must be an object` },
          { status: 400 }
        );
      }

      // Validate eventType
      if (!event.eventType || typeof event.eventType !== "string") {
        return NextResponse.json(
          { error: `Event at index ${i} must have a string eventType` },
          { status: 400 }
        );
      }
      if (!ALLOWED_EVENT_TYPES.has(event.eventType)) {
        return NextResponse.json(
          { error: `Invalid eventType "${event.eventType}" at index ${i}. Allowed types: ${Array.from(ALLOWED_EVENT_TYPES).join(", ")}` },
          { status: 400 }
        );
      }

      // Check individual event size (max 1KB)
      const eventSize = JSON.stringify(event).length;
      if (eventSize > MAX_EVENT_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Event at index ${i} exceeds maximum size of 1KB (${eventSize} bytes)` },
          { status: 400 }
        );
      }

      // Strip fields not in the whitelist
      const sanitized: Record<string, unknown> = {};
      for (const key of Object.keys(event)) {
        if (ALLOWED_EVENT_FIELDS.has(key)) {
          sanitized[key] = event[key];
        }
      }
      // Ensure timestamp exists
      if (typeof sanitized.timestamp !== "number") {
        sanitized.timestamp = Date.now();
      }

      sanitizedEvents.push(sanitized as AnalyticsEvent);
    }

    // Add sanitized events to storage
    analyticsEvents.push(...sanitizedEvents);

    // Fix H3: Cap the events array at MAX_ANALYTICS_EVENTS, remove oldest if exceeded
    if (analyticsEvents.length > MAX_ANALYTICS_EVENTS) {
      analyticsEvents.splice(0, analyticsEvents.length - MAX_ANALYTICS_EVENTS);
    }

    // Persist to file periodically (every 100 events)
    if (analyticsEvents.length >= 100) {
      await persistEvents();
    }

    return NextResponse.json({
      success: true,
      received: events.length,
      total: analyticsEvents.length,
    });
  } catch (error) {
    console.error("Error processing analytics events:", error);
    return NextResponse.json(
      { error: "Failed to process events" },
      { status: 500 }
    );
  }
}

/**
 * Persist events to file
 */
async function persistEvents() {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const dataDir = path.join(process.cwd(), "data");
    const analyticsDir = path.join(dataDir, "analytics");

    // Ensure directories exist
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(analyticsDir, { recursive: true });

    // Write events to file with timestamp
    const filename = `events-${Date.now()}.json`;
    const filepath = path.join(analyticsDir, filename);

    await fs.writeFile(filepath, JSON.stringify(analyticsEvents, null, 2));

    // Clear in-memory storage
    analyticsEvents.length = 0;
  } catch (error) {
    console.error("Failed to persist analytics events:", error);
  }
}
