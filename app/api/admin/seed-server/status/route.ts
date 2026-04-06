/**
 * Seed Server Status API
 * Endpoint for checking seed server status
 *
 * GET /api/admin/seed-server/status
 *
 * Phase 9: Monitoring & Analytics
 * Phase 11: Production Deployment - Added authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Seed server status (in production, fetch from actual seed server)
// For now, return mock data
let seedServerStatus = {
  online: true,
  activeTorrents: 0,
  totalPeers: 0,
  uploadSpeed: 0,
  uptime: 0,
  lastHeartbeat: Date.now(),
  version: "1.0.0",
};

/**
 * GET /api/admin/seed-server/status
 * Get seed server status (admin only)
 */
export async function GET(request: NextRequest) {
  // Check admin access
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // In production, fetch from actual seed server
    // For now, return mock data with some randomness

    const now = Date.now();
    const uptime = Math.floor((now - seedServerStatus.lastHeartbeat) / 1000);

    // Simulate some activity
    const mockStatus = {
      online: Math.random() > 0.1, // 90% uptime
      activeTorrents: Math.floor(Math.random() * 50) + 10,
      totalPeers: Math.floor(Math.random() * 200) + 50,
      uploadSpeed: Math.floor(Math.random() * 100 * 1024 * 1024), // Up to 100 MB/s
      uptime: uptime,
      lastHeartbeat: now,
      version: "1.0.0",
    };

    seedServerStatus = mockStatus;

    return NextResponse.json(seedServerStatus);
  } catch (error) {
    console.error("Error fetching seed server status:", error);
    return NextResponse.json(
      {
        online: false,
        error: "Failed to fetch seed server status",
      },
      { status: 500 }
    );
  }
}
