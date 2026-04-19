/**
 * User Ratings & Reviews System
 * localStorage-based user ratings for anime
 */

export interface AnimeRating {
  animeId: number;
  score: number; // 1-10
  review?: string;
  ratedAt: number; // timestamp
  updatedAt?: number;
}

const STORAGE_KEY = "animeverse-ratings";

export function getRatings(): Record<number, AnimeRating> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getRating(animeId: number): AnimeRating | null {
  const ratings = getRatings();
  return ratings[animeId] ?? null;
}

export function setRating(animeId: number, score: number, review?: string): AnimeRating {
  if (!Number.isInteger(score) || score < 1 || score > 10) throw new Error('Score must be an integer between 1 and 10');
  const ratings = getRatings();
  const existing = ratings[animeId];
  const rating: AnimeRating = {
    animeId,
    score,
    review: review ?? existing?.review,
    ratedAt: existing?.ratedAt ?? Date.now(),
    updatedAt: existing ? Date.now() : undefined,
  };
  ratings[animeId] = rating;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }
  return rating;
}

export function removeRating(animeId: number): void {
  const ratings = getRatings();
  delete ratings[animeId];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }
}

export function getAllRated(): AnimeRating[] {
  return Object.values(getRatings()).sort((a, b) => b.ratedAt - a.ratedAt);
}

export function getAverageScore(): number | null {
  const all = getAllRated();
  if (all.length === 0) return null;
  return Math.round((all.reduce((sum, r) => sum + r.score, 0) / all.length) * 10) / 10;
}
