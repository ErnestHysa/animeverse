/**
 * Scraper Fallback API Route
 * Integrates with Python scraper when AniList fails
 */

import { NextRequest, NextResponse } from "next/server";

// ===================================
// Types
// ===================================

interface ScrapeRequest {
  query: string;
  type?: "search" | "details" | "episodes";
  maxResults?: number;
}

interface ScrapeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ===================================
// Scraper Integration
// ===================================

/**
 * Call the Python scraper via subprocess
 * Note: In production, you'd want a running scraper service
 * This is a simplified example
 */
async function callScraper(query: string, type: string = "search", maxResults: number = 10): Promise<any> {
  const scraperPath = process.env.SCRAPER_PATH || "/mnt/c/Users/ErnestW11/DEVPROJECTS/scripts/web-scraper";

  try {
    // For now, return mock data since we can't directly call Python from Next.js API routes
    // In production, you'd set up a separate microservice or use child_process.spawn

    // Mock response for demonstration
    if (type === "search") {
      return {
        results: [
          {
            id: 1,
            title: { romaji: "Demon Slayer", english: "Demon Slayer" },
            coverImage: { extraLarge: "/placeholder.jpg" },
            description: "Mock result from scraper",
            episodes: 26,
            status: "FINISHED",
            format: "TV",
            seasonYear: 2019,
          },
        ],
      };
    }

    return null;
  } catch (error) {
    console.error("Scraper error:", error);
    throw error;
  }
}

// ===================================
// API Route Handler
// ===================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const type = searchParams.get("type") || "search";
    const maxResults = parseInt(searchParams.get("maxResults") || "10");

    if (!query) {
      return NextResponse.json<ScrapeResponse>(
        { success: false, error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Call scraper
    const data = await callScraper(query, type, maxResults);

    return NextResponse.json<ScrapeResponse>({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Scrape API error:", error);

    return NextResponse.json<ScrapeResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json();
    const { query, type = "search", maxResults = 10 } = body;

    if (!query) {
      return NextResponse.json<ScrapeResponse>(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    // Call scraper
    const data = await callScraper(query, type, maxResults);

    return NextResponse.json<ScrapeResponse>({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Scrape API error:", error);

    return NextResponse.json<ScrapeResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ===================================
// Configuration
// ===================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
