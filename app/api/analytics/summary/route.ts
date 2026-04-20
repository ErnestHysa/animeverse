/**
 * Analytics Summary API
 * Endpoint for retrieving analytics summary data
 *
 * GET /api/analytics/summary?period=hour|day|week|month
 *
 * Phase 9: Monitoring & Analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getAnalyticsSummaryData } from "@/lib/monitoring-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/summary
 * Get analytics summary for the specified period
 */
export async function GET(request: NextRequest) {
  try {
    // Fix C1: Require admin auth to access analytics summary
    if (!(await isAdminRequest(request))) {
      return NextResponse.json(
        { error: "Unauthorized - admin access required" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "day";

    const summary = await getAnalyticsSummaryData(period);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error generating analytics summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
