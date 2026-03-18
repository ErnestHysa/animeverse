/**
 * Scraper Fallback API Route
 * Provides alternative anime search using AniList integration
 */

import { NextRequest, NextResponse } from "next/server";
import { anilist } from "@/lib/anilist";

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
 * Search anime using AniList as the scraper
 */
async function callScraper(query: string, type: string = "search", maxResults: number = 10): Promise<any> {
  try {
    if (type === "search") {
      // Use AniList search functionality
      const result = await anilist.search({ search: query, page: 1, perPage: maxResults });
      const media = result.data?.Page?.media || [];

      return {
        results: media.map((m: any) => ({
          id: m.id,
          title: {
            romaji: m.title?.romaji,
            english: m.title?.english,
            native: m.title?.native,
          },
          coverImage: {
            extraLarge: m.coverImage?.extraLarge || m.coverImage?.large || "/placeholder.jpg",
          },
          description: m.description,
          episodes: m.episodes,
          status: m.status,
          format: m.format,
          seasonYear: m.seasonYear,
          averageScore: m.averageScore,
        })),
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
