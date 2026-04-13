/**
 * Bulk Import API Route
 * Import magnet links from CSV or JSON
 *
 * POST /api/admin/magnets/bulk-import
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
 * Parse CSV content
 */
function parseCSV(csvContent: string): Array<{
  animeId: string;
  animeTitle: string;
  episode: string;
  magnet: string;
  quality?: string;
  notes?: string;
}> {
  const lines = csvContent.trim().split("\n");
  const results = [];
  const headers = lines[0].split(",").map((h) => h.trim());

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    // Required fields
    if (row.animeId && row.episode && row.magnet) {
      results.push({
        animeId: row.animeId,
        animeTitle: row.animeTitle || "",
        episode: row.episode,
        magnet: row.magnet,
        quality: row.quality,
        notes: row.notes,
      });
    }
  }

  return results;
}

/**
 * POST - Bulk import magnet links
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { format, data, submittedBy } = body;

    if (!format || !data) {
      return NextResponse.json(
        { error: "Missing format or data" },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const now = Date.now();
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    let entries: Array<{
      animeId: string;
      animeTitle: string;
      episode: string;
      magnet: string;
      quality?: string;
      notes?: string;
    }> = [];

    if (format === "csv") {
      entries = parseCSV(data);
    } else if (format === "json") {
      entries = Array.isArray(data) ? data : [data];
    } else {
      return NextResponse.json(
        { error: "Invalid format. Use 'csv' or 'json'" },
        { status: 400 }
      );
    }

    // Limit array size to prevent abuse
    if (entries.length > 1000) {
      return NextResponse.json(
        { error: "Too many entries. Maximum 1000 magnets per bulk import." },
        { status: 400 }
      );
    }

    // Process each entry
    for (const entry of entries) {
      try {
        // Validate magnet link
        if (!entry.magnet.startsWith("magnet:?")) {
          errors++;
          errorMessages.push(`Invalid magnet format: ${entry.animeId}-${entry.episode}`);
          continue;
        }

        // Extract infoHash
        const infoHashMatch = entry.magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
        if (!infoHashMatch) {
          errors++;
          errorMessages.push(`No infoHash found: ${entry.animeId}-${entry.episode}`);
          continue;
        }

        const infoHash = infoHashMatch[1].toLowerCase();

        // Check for duplicates
        const existing = db.magnets.find((m) => m.infoHash === infoHash);
        if (existing) {
          duplicates++;
          continue;
        }

        // Create magnet entry
        const newMagnet: MagnetEntry = {
          id: `${entry.animeId}-${entry.episode}-${infoHash.substring(0, 8)}`,
          animeId: parseInt(entry.animeId),
          animeTitle: entry.animeTitle || `Anime ${entry.animeId}`,
          episode: parseInt(entry.episode),
          magnet: entry.magnet,
          infoHash,
          quality: entry.quality || "unknown",
          seeders: 0,
          leechers: 0,
          provider: "manual",
          status: "pending",
          lastChecked: now,
          createdAt: now,
          updatedAt: now,
          submittedBy,
          notes: entry.notes,
        };

        db.magnets.push(newMagnet);
        imported++;
      } catch (error) {
        errors++;
        errorMessages.push(`Error processing ${entry.animeId}-${entry.episode}: ${error}`);
      }
    }

    // Save database
    await writeDatabase(db);

    return NextResponse.json({
      success: true,
      imported,
      duplicates,
      errors,
      errorMessages: errors > 0 ? errorMessages.slice(0, 10) : undefined,
      message: `Imported ${imported} magnet links${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ""}${errors > 0 ? ` (${errors} errors)` : ""}`,
    });
  } catch (error) {
    console.error("Error in bulk import:", error);
    return NextResponse.json(
      { error: "Failed to import magnets" },
      { status: 500 }
    );
  }
}
