/**
 * Magnet Validation API Route
 * Validate magnet links and check seeders/peers
 *
 * POST /api/admin/magnets/validate - Validate specific magnet
 * GET /api/admin/magnets/validate?id=<id> - Get validation status
 *
 * Phase 7: Content Acquisition & Seeding
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAGNETS_DB_PATH = path.join(process.cwd(), "data", "magnets.json");

interface MagnetEntry {
  id: string;
  animeId: number;
  animeTitle: string;
  episode: number;
  magnet: string;
  infoHash: string;
  quality: string;
  seeders: number;
  leechers: number;
  provider: "manual" | "nyaa" | "nyaa-land" | "anidex" | "scraper";
  status: "active" | "dead" | "pending" | "verified";
  lastChecked: number;
  createdAt: number;
  updatedAt: number;
  submittedBy?: string;
  notes?: string;
}

interface MagnetsDatabase {
  magnets: MagnetEntry[];
  lastUpdated: number;
}

/**
 * Read database
 */
async function readDatabase(): Promise<MagnetsDatabase> {
  if (!existsSync(MAGNETS_DB_PATH)) {
    return { magnets: [], lastUpdated: Date.now() };
  }

  try {
    const content = await readFile(MAGNETS_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading magnets database:", error);
    return { magnets: [], lastUpdated: Date.now() };
  }
}

/**
 * Write database
 */
async function writeDatabase(data: MagnetsDatabase): Promise<void> {
  data.lastUpdated = Date.now();
  await writeFile(MAGNETS_DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Validate magnet link via DHT (simplified version)
 * In production, this would use actual DHT peer discovery
 */
async function validateMagnetViaDHT(magnet: string): Promise<{
  seeders: number;
  leechers: number;
  status: "active" | "dead" | "pending";
}> {
  try {
    // For now, return a mock response
    // In production, integrate with actual DHT or tracker
    const infoHashMatch = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
    if (!infoHashMatch) {
      return { seeders: 0, leechers: 0, status: "dead" };
    }

    // Simulate validation (replace with actual DHT check)
    // This is a placeholder - real implementation would:
    // 1. Connect to DHT
    // 2. Query for peers
    // 3. Count seeders/leechers
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return mock data (in production, use real data)
    return {
      seeders: Math.floor(Math.random() * 100),
      leechers: Math.floor(Math.random() * 50),
      status: "active",
    };
  } catch (error) {
    console.error("Error validating magnet:", error);
    return { seeders: 0, leechers: 0, status: "dead" };
  }
}

/**
 * GET - Get validation status for a magnet
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing magnet ID" },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const magnet = db.magnets.find((m) => m.id === id);

    if (!magnet) {
      return NextResponse.json(
        { error: "Magnet link not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      magnet,
      validationStatus: {
        seeders: magnet.seeders,
        leechers: magnet.leechers,
        status: magnet.status,
        lastChecked: magnet.lastChecked,
      },
    });
  } catch (error) {
    console.error("Error getting validation status:", error);
    return NextResponse.json(
      { error: "Failed to get validation status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Validate a magnet link
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, magnet: magnetLink } = body;

    let magnet: MagnetEntry | undefined;
    let magnetToValidate = magnetLink;

    const db = await readDatabase();

    // If ID provided, use existing magnet
    if (id) {
      magnet = db.magnets.find((m) => m.id === id);
      if (!magnet) {
        return NextResponse.json(
          { error: "Magnet link not found" },
          { status: 404 }
        );
      }
      magnetToValidate = magnet.magnet;
    }

    if (!magnetToValidate) {
      return NextResponse.json(
        { error: "No magnet link to validate" },
        { status: 400 }
      );
    }

    // Validate magnet
    const validation = await validateMagnetViaDHT(magnetToValidate);

    // Update database if we have a magnet entry
    if (magnet) {
      const magnetIndex = db.magnets.findIndex((m) => m.id === id);
      if (magnetIndex !== -1) {
        db.magnets[magnetIndex].seeders = validation.seeders;
        db.magnets[magnetIndex].leechers = validation.leechers;
        db.magnets[magnetIndex].status = validation.status;
        db.magnets[magnetIndex].lastChecked = Date.now();
        db.magnets[magnetIndex].updatedAt = Date.now();

        await writeDatabase(db);

        return NextResponse.json({
          success: true,
          magnet: db.magnets[magnetIndex],
          validation,
          message: `Validation complete: ${validation.seeders} seeders, ${validation.leechers} leechers`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      validation,
      message: `Validation complete: ${validation.seeders} seeders, ${validation.leechers} leechers`,
    });
  } catch (error) {
    console.error("Error validating magnet:", error);
    return NextResponse.json(
      { error: "Failed to validate magnet" },
      { status: 500 }
    );
  }
}
