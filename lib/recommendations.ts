/**
 * AI-Powered Anime Recommendation Engine
 * Analyzes user watch history to provide personalized recommendations
 */

import type { Media } from "@/types/anilist";

// ===================================
// Types
// ===================================

interface WatchHistoryItem {
  mediaId: number;
  episodeNumber: number;
  timestamp: number;
  completed: boolean;
}

interface GenreScore {
  genre: string;
  score: number;
  count: number;
}

interface UserPreferences {
  favoriteGenres: GenreScore[];
  preferredFormats: string[];
  preferredStudios: string[];
  averageScorePreference: number;
  watchingPattern: "binge" | "casual" | "weekly";
}

interface RecommendationResult {
  anime: Media;
  score: number;
  reasons: string[];
  matchPercentage: number;
}

// ===================================
// Recommendation Engine
// ===================================

class RecommendationEngine {
  /**
   * Analyze user's watch history to extract preferences
   */
  analyzeWatchHistory(
    watchHistory: WatchHistoryItem[],
    favorites: number[],
    candidates: Media[]
  ): UserPreferences {
    const animeMap = new Map(candidates.map((anime) => [anime.id, anime]));
    const genreCounts = new Map<string, number>();
    const formatCounts = new Map<string, number>();
    const studioCounts = new Map<string, number>();
    let totalScore = 0;
    let scoreCount = 0;

    const favoriteSet = new Set(favorites);
    const watchedIds = new Set(watchHistory.map((entry) => entry.mediaId));
    const preferenceIds = new Set([...favoriteSet, ...watchedIds]);

    for (const animeId of preferenceIds) {
      const anime = animeMap.get(animeId);
      if (!anime) {
        continue;
      }

      const historyEntries = watchHistory.filter((entry) => entry.mediaId === animeId);
      const watchWeight =
        historyEntries.length +
        (historyEntries.some((entry) => entry.completed) ? 2 : 0) +
        (favoriteSet.has(animeId) ? 3 : 0);

      anime.genres?.forEach((genre) => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + watchWeight);
      });

      if (anime.format) {
        formatCounts.set(anime.format, (formatCounts.get(anime.format) || 0) + watchWeight);
      }

      anime.studios?.nodes?.forEach((studio) => {
        studioCounts.set(studio.name, (studioCounts.get(studio.name) || 0) + watchWeight);
      });

      if (anime.averageScore) {
        totalScore += anime.averageScore;
        scoreCount++;
      }
    }

    const watchingPattern = this.determineWatchingPattern(watchHistory);

    return {
      favoriteGenres: Array.from(genreCounts.entries())
        .map(([genre, count]) => ({ genre, score: count, count }))
        .sort((a, b) => b.score - a.score)
      .slice(0, 5),
      preferredFormats: Array.from(formatCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([format]) => format),
      preferredStudios: Array.from(studioCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([studio]) => studio),
      averageScorePreference: scoreCount > 0 ? totalScore / scoreCount : 75,
      watchingPattern,
    };
  }

  /**
   * Determine user's watching pattern
   */
  private determineWatchingPattern(watchHistory: WatchHistoryItem[]): "binge" | "casual" | "weekly" {
    if (watchHistory.length < 3) return "casual";

    // Fix M2: Sort by timestamp descending before computing intervals
    const sorted = [...watchHistory].sort((a, b) => b.timestamp - a.timestamp);
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(sorted.length, 10); i++) {
      intervals.push(sorted[i - 1].timestamp - sorted[i].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Less than a day between watches = binge
    if (avgInterval < 86400000) return "binge";
    // Less than a week = casual
    if (avgInterval < 604800000) return "casual";
    return "weekly";
  }

  /**
   * Score an anime for recommendation based on user preferences
   */
  scoreAnime(
    anime: Media,
    preferences: UserPreferences,
    recentlyWatched: Set<number>,
    favorites: Set<number>
  ): RecommendationResult {
    let score = 0;
    const reasons: string[] = [];

    // 1. Genre matching (up to 40 points)
    if (anime.genres && preferences.favoriteGenres.length > 0) {
      const genreMatch = anime.genres.filter((g) =>
        preferences.favoriteGenres.some((fg) => fg.genre === g)
      );
      if (genreMatch.length > 0) {
        const genreScore = Math.min(40, genreMatch.length * 10);
        score += genreScore;
        reasons.push(`Matches your favorite genres: ${genreMatch.slice(0, 2).join(", ")}`);
      }
    }

    // 2. Studio matching (up to 15 points)
    if (anime.studios?.nodes && preferences.preferredStudios.length > 0) {
      const studioMatch = anime.studios.nodes.some((s) =>
        preferences.preferredStudios.includes(s.name)
      );
      if (studioMatch) {
        score += 15;
        reasons.push(`From a studio you like`);
      }
    }

    // 3. Quality score (up to 20 points)
    if (anime.averageScore) {
      // AniList averageScore is 0-100, so divide by 100 to get 0-1, then multiply by 20
      const qualityScore = (anime.averageScore / 100) * 20;
      score += qualityScore;
      if (anime.averageScore >= 80) {
        reasons.push(`Highly rated (${anime.averageScore}% score)`);
      }
      if (anime.averageScore >= preferences.averageScorePreference) {
        score += 6;
      }
    }

    // 4. Popularity/Trending (up to 10 points)
    if (anime.trending > 10000) {
      score += 10;
      reasons.push(`Trending now`);
    } else if (anime.popularity > 50000) {
      score += 5;
    }

    // 5. Format preference (up to 10 points)
    if (anime.format && preferences.preferredFormats.includes(anime.format)) {
      score += 10;
      reasons.push(`Matches your preferred format`);
    }

    if (preferences.watchingPattern === "binge" && anime.episodes && anime.episodes >= 24) {
      score += 5;
      reasons.push("Great for binge sessions");
    }

    if (preferences.watchingPattern === "weekly" && anime.status === "RELEASING") {
      score += 5;
      reasons.push("Fits your weekly watch pattern");
    }

    if (favorites.size > 0 && anime.genres?.some((genre) =>
      preferences.favoriteGenres.some((favGenre) => favGenre.genre === genre)
    )) {
      score += 5;
    }

    // 6. Currently airing bonus (up to 5 points)
    if (anime.status === "RELEASING") {
      score += 5;
      reasons.push(`Currently airing`);
    }

    // Deductions:
    // Already watched (exclude completely)
    if (recentlyWatched.has(anime.id)) {
      return {
        anime,
        score: 0,
        reasons: ["Already watched"],
        matchPercentage: 0,
      };
    }

    // Not yet released
    if (anime.status === "NOT_YET_RELEASED") {
      score -= 10;
    }

    const matchPercentage = Math.min(100, Math.max(0, score));

    return {
      anime,
      score,
      reasons,
      matchPercentage,
    };
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(
    candidates: Media[],
    watchHistory: WatchHistoryItem[],
    favorites: number[],
    limit: number = 20
  ): Promise<RecommendationResult[]> {
    const preferences = this.analyzeWatchHistory(watchHistory, favorites, candidates);
    const recentlyWatched = new Set(watchHistory.map((h) => h.mediaId));
    const favoriteIds = new Set(favorites);

    // Score all candidates
    const scored = candidates
      .map((anime) => this.scoreAnime(anime, preferences, recentlyWatched, favoriteIds))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  /**
   * Get "Because you watched X" recommendations
   */
  getSimilarRecommendations(
    basedOnAnime: Media,
    candidates: Media[],
    limit: number = 10
  ): RecommendationResult[] {
    // Score candidates based on similarity to base anime
    const scored = candidates
      .filter((a) => a.id !== basedOnAnime.id)
      .map((anime) => {
        let score = 0;
        const reasons: string[] = [];

        // Same genres (50 points)
        if (basedOnAnime.genres && anime.genres) {
          const sharedGenres = basedOnAnime.genres.filter((g) => anime.genres?.includes(g));
          if (sharedGenres.length > 0) {
            score += sharedGenres.length * 10;
            reasons.push(`Similar genres: ${sharedGenres.slice(0, 2).join(", ")}`);
          }
        }

        // Same studio (20 points)
        if (basedOnAnime.studios?.nodes && anime.studios?.nodes) {
          const sameStudio = basedOnAnime.studios.nodes.some((s1) =>
            anime.studios?.nodes?.some((s2) => s1.name === s2.name)
          );
          if (sameStudio) {
            score += 20;
            reasons.push(`Same studio`);
          }
        }

        // Same format (10 points)
        if (basedOnAnime.format === anime.format) {
          score += 10;
          reasons.push(`Same format`);
        }

        // Same source material (10 points)
        if (basedOnAnime.source === anime.source) {
          score += 10;
          reasons.push(`Same source material`);
        }

        return {
          anime,
          score,
          reasons,
          matchPercentage: Math.min(100, score),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }
}

// Singleton instance
export const recommendationEngine = new RecommendationEngine();

/**
 * Helper to get "Because you watched" recommendations
 */
export async function getBecauseYouWatched(
  animeId: number,
  allAnime: Media[]
): Promise<RecommendationResult[]> {
  const basedOn = allAnime.find((a) => a.id === animeId);
  if (!basedOn) return [];

  return recommendationEngine.getSimilarRecommendations(basedOn, allAnime);
}

/**
 * Helper to get personalized recommendations for user
 */
export async function getPersonalizedRecommendations(
  allAnime: Media[],
  watchHistory: WatchHistoryItem[],
  favorites: number[]
): Promise<RecommendationResult[]> {
  return recommendationEngine.getRecommendations(allAnime, watchHistory, favorites);
}
