/**
 * Magnet Ratings API Endpoint
 *
 * Phase 10: Community Feedback System
 * POST /api/magnets/ratings - Submit a rating
 * GET /api/magnets/ratings?magnetHash=xxx - Get ratings for a magnet
 */

import { NextRequest, NextResponse } from "next/server";
import type { MagnetRating, MagnetSourceStats } from "@/types/magnet-ratings";

// In-memory storage (replace with database in production)
const ratingsStore: Map<string, MagnetRating[]> = new Map();
const statsCache: Map<string, MagnetSourceStats> = new Map();

/**
 * POST /api/magnets/ratings
 * Submit a rating for a magnet source
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      magnetHash,
      animeId,
      episodeNumber,
      userId,
      username,
      rating,
      quality,
      videoQuality,
      audioQuality,
      subtitleQuality,
      playbackIssues,
    } = body;

    // Validation
    if (!magnetHash || !animeId || !episodeNumber || !userId || !rating) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    // Check if user already rated this magnet
    const existingRatings = ratingsStore.get(magnetHash) || [];
    const existingRating = existingRatings.find((r) => r.userId === userId && r.magnetHash === magnetHash);

    if (existingRating) {
      // Update existing rating
      const updatedRating: MagnetRating = {
        ...existingRating,
        rating,
        quality,
        videoQuality,
        audioQuality,
        subtitleQuality,
        playbackIssues: playbackIssues || [],
        updatedAt: new Date().toISOString(),
      };

      const index = existingRatings.findIndex((r) => r.userId === userId);
      existingRatings[index] = updatedRating;
      ratingsStore.set(magnetHash, existingRatings);

      // Update stats
      updateStats(magnetHash);

      return NextResponse.json({ rating: updatedRating, message: "Rating updated" });
    }

    // Create new rating
    const newRating: MagnetRating = {
      id: `rating-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      magnetHash,
      animeId,
      episodeNumber,
      userId,
      username: username || "Anonymous",
      rating,
      quality: quality || "good",
      videoQuality: videoQuality || "720p",
      audioQuality: audioQuality || "good",
      subtitleQuality: subtitleQuality || "good",
      playbackIssues: playbackIssues || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store rating
    if (!ratingsStore.has(magnetHash)) {
      ratingsStore.set(magnetHash, []);
    }
    ratingsStore.get(magnetHash)!.push(newRating);

    // Update stats
    updateStats(magnetHash);

    return NextResponse.json({ rating: newRating, message: "Rating submitted" }, { status: 201 });
  } catch (error) {
    console.error("[MagnetRatingsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/magnets/ratings
 * Get ratings for a magnet source
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const magnetHash = searchParams.get("magnetHash");

    if (!magnetHash) {
      return NextResponse.json({ error: "magnetHash parameter is required" }, { status: 400 });
    }

    const ratings = ratingsStore.get(magnetHash) || [];

    return NextResponse.json({
      magnetHash,
      ratings,
      total: ratings.length,
    });
  } catch (error) {
    console.error("[MagnetRatingsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Update statistics for a magnet source
 */
function updateStats(magnetHash: string): void {
  const ratings = ratingsStore.get(magnetHash) || [];

  if (ratings.length === 0) {
    return;
  }

  // Calculate average rating
  const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  // Calculate quality distribution
  const qualityDistribution: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };

  ratings.forEach((r) => {
    qualityDistribution[r.quality] = (qualityDistribution[r.quality] || 0) + 1;
  });

  // Check if marked as broken
  const brokenCount = ratings.filter((r) => r.playbackIssues.includes("broken")).length;
  const isBroken = brokenCount >= 3; // Mark as broken if 3+ users report it

  const stats: MagnetSourceStats = {
    magnetHash,
    animeId: ratings[0].animeId,
    episodeNumber: ratings[0].episodeNumber,
    totalRatings: ratings.length,
    averageRating: Math.round(averageRating * 10) / 10,
    qualityDistribution,
    totalComments: 0, // Will be updated by comments API
    isVerified: ratings.length >= 5 && averageRating >= 4.0,
    isBroken,
    brokenCount,
    lastChecked: new Date().toISOString(),
  };

  statsCache.set(magnetHash, stats);
}

/**
 * GET /api/magnets/ratings/stats
 * Get statistics for a magnet source
 */
export async function getMagnetStats(magnetHash: string): Promise<MagnetSourceStats | null> {
  return statsCache.get(magnetHash) || null;
}

// Export for use in other endpoints
export { ratingsStore, statsCache };
