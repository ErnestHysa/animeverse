/**
 * Admin Magnet Management API Route
 * Handles CRUD operations for magnet links
 *
 * GET /api/admin/magnets - List all magnet links
 * POST /api/admin/magnets - Add new magnet link
 * PUT /api/admin/magnets - Update magnet link
 * DELETE /api/admin/magnets - Delete magnet link
 *
 * Phase 7: Content Acquisition & Seeding
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Database file path
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
  submittedBy?: string; // admin username
  notes?: string;
}

interface MagnetsDatabase {
  magnets: MagnetEntry[];
  lastUpdated: number;
}

/**
 * Initialize database file if it doesn't exist
 */
async function initDatabase(): Promise<void> {
  if (!existsSync(MAGNETS_DB_PATH)) {
    const dataDir = path.dirname(MAGNETS_DB_PATH);
    if (!existsSync(dataDir)) {
      await writeFile(dataDir, "");
    }

    const initialDb: MagnetsDatabase = {
      magnets: [],
      lastUpdated: Date.now(),
    };

    await writeFile(MAGNETS_DB_PATH, JSON.stringify(initialDb, null, 2));
  }
}

/**
 * Read database
 */
async function readDatabase(): Promise<MagnetsDatabase> {
  await initDatabase();

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
 * GET - List all magnet links with optional filtering
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const animeId = searchParams.get("animeId");
    const episode = searchParams.get("episode");
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const limit = parseInt(searchParams.get("limit") || "100");

    const db = await readDatabase();
    let filtered = db.magnets;

    // Apply filters
    if (animeId) {
      filtered = filtered.filter((m) => m.animeId === parseInt(animeId));
    }
    if (episode) {
      filtered = filtered.filter((m) => m.episode === parseInt(episode));
    }
    if (status) {
      filtered = filtered.filter((m) => m.status === status);
    }
    if (provider) {
      filtered = filtered.filter((m) => m.provider === provider);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    const paginated = filtered.slice(0, limit);

    return NextResponse.json({
      magnets: paginated,
      total: filtered.length,
      lastUpdated: db.lastUpdated,
    });
  } catch (error) {
    console.error("Error listing magnets:", error);
    return NextResponse.json(
      { error: "Failed to list magnets", magnets: [], total: 0 },
      { status: 500 }
    );
  }
}

/**
 * POST - Add new magnet link
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      animeId,
      animeTitle,
      episode,
      magnet,
      quality,
      provider = "manual",
      submittedBy,
      notes,
    } = body;

    // Validate required fields
    if (!animeId || !episode || !magnet) {
      return NextResponse.json(
        { error: "Missing required fields: animeId, episode, magnet" },
        { status: 400 }
      );
    }

    // Validate magnet link format
    if (!magnet.startsWith("magnet:?")) {
      return NextResponse.json(
        { error: "Invalid magnet link format" },
        { status: 400 }
      );
    }

    // Extract infoHash from magnet
    const infoHashMatch = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
    if (!infoHashMatch) {
      return NextResponse.json(
        { error: "Could not extract infoHash from magnet link" },
        { status: 400 }
      );
    }

    const infoHash = infoHashMatch[1].toLowerCase();
    const now = Date.now();

    const db = await readDatabase();

    // Check for duplicate infoHash
    const existing = db.magnets.find((m) => m.infoHash === infoHash);
    if (existing) {
      return NextResponse.json(
        { error: "Magnet link with this infoHash already exists", existing },
        { status: 409 }
      );
    }

    // Create new magnet entry
    const newMagnet: MagnetEntry = {
      id: `${animeId}-${episode}-${infoHash.substring(0, 8)}`,
      animeId: parseInt(animeId),
      animeTitle: animeTitle || `Anime ${animeId}`,
      episode: parseInt(episode),
      magnet,
      infoHash,
      quality: quality || "unknown",
      seeders: 0,
      leechers: 0,
      provider,
      status: "pending",
      lastChecked: now,
      createdAt: now,
      updatedAt: now,
      submittedBy,
      notes,
    };

    db.magnets.push(newMagnet);
    await writeDatabase(db);

    return NextResponse.json(
      {
        success: true,
        magnet: newMagnet,
        message: "Magnet link added successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding magnet:", error);
    return NextResponse.json(
      { error: "Failed to add magnet link" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update magnet link
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, status, notes, quality } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing magnet ID" },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const magnetIndex = db.magnets.findIndex((m) => m.id === id);

    if (magnetIndex === -1) {
      return NextResponse.json(
        { error: "Magnet link not found" },
        { status: 404 }
      );
    }

    // Update fields
    if (status) {
      db.magnets[magnetIndex].status = status;
    }
    if (notes !== undefined) {
      db.magnets[magnetIndex].notes = notes;
    }
    if (quality) {
      db.magnets[magnetIndex].quality = quality;
    }
    db.magnets[magnetIndex].updatedAt = Date.now();

    await writeDatabase(db);

    return NextResponse.json({
      success: true,
      magnet: db.magnets[magnetIndex],
      message: "Magnet link updated successfully",
    });
  } catch (error) {
    console.error("Error updating magnet:", error);
    return NextResponse.json(
      { error: "Failed to update magnet link" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove magnet link
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing magnet ID" },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const magnetIndex = db.magnets.findIndex((m) => m.id === id);

    if (magnetIndex === -1) {
      return NextResponse.json(
        { error: "Magnet link not found" },
        { status: 404 }
      );
    }

    // Remove magnet
    db.magnets.splice(magnetIndex, 1);
    await writeDatabase(db);

    return NextResponse.json({
      success: true,
      message: "Magnet link deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting magnet:", error);
    return NextResponse.json(
      { error: "Failed to delete magnet link" },
      { status: 500 }
    );
  }
}
