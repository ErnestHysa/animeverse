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
import { getSeedServerStatusSnapshot } from "@/lib/monitoring-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const status = await getSeedServerStatusSnapshot();
    return NextResponse.json(status);
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
