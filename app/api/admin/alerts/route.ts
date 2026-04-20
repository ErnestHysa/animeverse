/**
 * Alerts API
 * Endpoint for managing alerts
 *
 * GET /api/admin/alerts - Get all alerts
 * PATCH /api/admin/alerts?id=:id - Resolve an alert
 *
 * Phase 9: Monitoring & Analytics
 * Phase 11: Production Deployment - Added authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getAlertsManager } from "@/lib/alerts-manager";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

getAlertsManager();

/**
 * GET /api/admin/alerts
 * Get all alerts (admin only)
 */
export async function GET(request: NextRequest) {
  // Check admin access
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
 * PATCH /api/admin/alerts/resolve
 * Resolve an alert (admin only, uses query parameters instead of dynamic route)
 */
export async function PATCH(request: NextRequest) {
  // Check admin access
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: 'Missing alert ID' }, { status: 400 });
    }

    const alertsManager = getAlertsManager();
    alertsManager.resolveAlert(id);

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

/**
 * POST /api/admin/alerts
 * Create a new alert (admin only)
 */
export async function POST(request: NextRequest) {
  // Check admin access
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fix M8: Body size check
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 1048576) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }

    const body = await request.json();
    const { type, severity, message, metadata } = body;

    const alertsManager = getAlertsManager();
    const alert = alertsManager.manualCreateAlert(type, severity, message, metadata);

    return NextResponse.json({
      success: true,
      alert,
      message: "Alert created",
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}
