/**
 * Analytics Events API
 * Endpoint for receiving analytics events from clients
 *
 * POST /api/analytics/events
 *
 * Phase 9: Monitoring & Analytics
 */

import { NextRequest, NextResponse } from "next/server";

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

/**
 * POST /api/analytics/events
 * Receive analytics events from clients
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid events array" }, { status: 400 });
    }

    // Add events to storage
    analyticsEvents.push(...events);

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
