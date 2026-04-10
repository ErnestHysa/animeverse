/**
 * Magnet Flags API Endpoint
 *
 * Phase 10: Community Feedback System
 * POST /api/magnets/flags - Flag a magnet as broken/malware/etc
 * GET /api/magnets/flags?magnetHash=xxx - Get flags for a magnet
 * PUT /api/magnets/flags/:id/review - Admin review of flag
 */

import { NextRequest, NextResponse } from "next/server";
import type { MagnetFlag } from "@/types/magnet-ratings";

// In-memory storage (replace with database in production)
const flagsStore: Map<string, MagnetFlag[]> = new Map();

/**
 * POST /api/magnets/flags
 * Flag a magnet source
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { magnetHash, userId, username, reason, description } = body;

    // Validation
    if (!magnetHash || !userId || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validReasons = ["broken", "malware", "wrong-content", "poor-quality", "other"];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    // Check if user already flagged this magnet
    const existingFlags = flagsStore.get(magnetHash) || [];
    const existingFlag = existingFlags.find((f) => f.userId === userId && f.magnetHash === magnetHash);

    if (existingFlag) {
      return NextResponse.json({ error: "You have already flagged this magnet" }, { status: 400 });
    }

    // Create new flag
    const newFlag: MagnetFlag = {
      id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      magnetHash,
      userId,
      username: username || "Anonymous",
      reason,
      description: description || "",
      createdAt: new Date().toISOString(),
      reviewed: false,
      reviewAction: "pending",
    };

    // Store flag
    if (!flagsStore.has(magnetHash)) {
      flagsStore.set(magnetHash, []);
    }
    flagsStore.get(magnetHash)!.push(newFlag);

    return NextResponse.json({ flag: newFlag, message: "Flag submitted" }, { status: 201 });
  } catch (error) {
    console.error("[MagnetFlagsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/magnets/flags
 * Get flags for a magnet source
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const magnetHash = searchParams.get("magnetHash");
    const reviewed = searchParams.get("reviewed");

    if (!magnetHash) {
      return NextResponse.json({ error: "magnetHash parameter is required" }, { status: 400 });
    }

    let flags = flagsStore.get(magnetHash) || [];

    // Filter by reviewed status
    if (reviewed !== null) {
      const isReviewed = reviewed === "true";
      flags = flags.filter((f) => f.reviewed === isReviewed);
    }

    // Sort by date (newest first)
    flags.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      magnetHash,
      flags,
      total: flags.length,
    });
  } catch (error) {
    console.error("[MagnetFlagsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/magnets/flags/review
 * Admin review of flag (uses query parameters instead of dynamic route)
 */
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const body = await request.json();
    const { adminId, action } = body;

    // Validation
    if (!id || !adminId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validActions = ["confirmed", "rejected", "pending"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Find flag
    for (const [magnetHash, flags] of flagsStore.entries()) {
      const flagIndex = flags.findIndex((f) => f.id === id);

      if (flagIndex !== -1) {
        const existingFlag = flags[flagIndex];

        // Update flag
        existingFlag.reviewed = true;
        existingFlag.reviewAction = action;
        existingFlag.reviewedBy = adminId;

        return NextResponse.json({ flag: existingFlag, message: "Flag reviewed" });
      }
    }

    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  } catch (error) {
    console.error("[MagnetFlagsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Get all pending flags (admin endpoint)
 */
export async function getPendingFlags(): Promise<MagnetFlag[]> {
  const allFlags: MagnetFlag[] = [];

  for (const flags of flagsStore.values()) {
    allFlags.push(...flags.filter((f) => !f.reviewed));
  }

  // Sort by date (oldest first)
  allFlags.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return allFlags;
}
