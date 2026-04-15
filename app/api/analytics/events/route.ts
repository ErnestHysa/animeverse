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

    // Add events to storage
    analyticsEvents.push(...events);

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
