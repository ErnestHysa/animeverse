/**
 * Alerts API
 * Endpoint for managing alerts
 *
 * GET /api/admin/alerts - Get all alerts
 * PUT /api/admin/alerts/:id/resolve - Resolve an alert
 *
 * Phase 9: Monitoring & Analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { getAlertsManager } from "@/lib/alerts-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/alerts
 * Get all alerts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("active") === "true";

    const alertsManager = getAlertsManager();
    const alerts = activeOnly
      ? alertsManager.getActiveAlerts()
      : alertsManager.getAllAlerts();

    return NextResponse.json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/alerts/[id]/resolve
 * Resolve an alert
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const alertsManager = getAlertsManager();
    alertsManager.resolveAlert(params.id);

    return NextResponse.json({
      success: true,
      message: "Alert resolved",
    });
  } catch (error) {
    console.error("Error resolving alert:", error);
    return NextResponse.json(
      { error: "Failed to resolve alert" },
      { status: 500 }
    );
  }
}
