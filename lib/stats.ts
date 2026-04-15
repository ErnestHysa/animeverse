/**
 * User Statistics
 * Calculate and track user watching statistics
 */

import type { Media } from "@/types/anilist";
import { WatchHistoryItem } from "@/store";

// Average episode duration by format (in minutes)
const AVG_DURATION_MINUTES: Record<string, number> = {
  TV: 24,
  TV_SHORT: 12,
  MOVIE: 120,
  SPECIAL: 24,
  OVA: 24,
  ONA: 24,
  MUSIC: 4,
};

export interface UserStats {
  totalEpisodesWatched: number;
  totalMinutesWatched: number;
  totalHoursWatched: number;
  totalDaysWatched: number;
  topGenres: Array<{ genre: string; count: number }>;
  completedAnime: number;
  uniqueAnimeWatched: number;
  currentStreak: number;
  longestStreak: number;
}

export interface StatsData {
  stats: UserStats;
  lastUpdated: number;
}

const STATS_STORAGE_KEY = "animeverse_stats";

/**
 * Calculate user statistics from watch history and media cache
 */
export function calculateStats(
  watchHistory: WatchHistoryItem[],
  mediaCache: Record<number, Media>
): UserStats {
  // Get unique anime count
  const uniqueAnime = new Set(watchHistory.map((item) => item.mediaId));
  const uniqueAnimeWatched = uniqueAnime.size;

  // Count total episodes watched
  const totalEpisodesWatched = watchHistory.length;

  // Calculate watch time
  let totalMinutes = 0;
  const genreCounts: Record<string, number> = {};

  for (const item of watchHistory) {
    const media = mediaCache[item.mediaId];

    if (media) {
      // Use actual duration if available, otherwise estimate by format
      const duration = media.duration || AVG_DURATION_MINUTES[media.format || "TV"] || 24;

      // Count watch time (completed episodes count as full duration)
      if (item.completed) {
        totalMinutes += duration;
      } else if (item.progress > 0) {
        // Partial watch: count minutes watched (progress is in seconds)
        const minutesWatched = Math.min(item.progress / 60, duration);
        totalMinutes += minutesWatched;
      }

      // Count genres
      if (media.genres && Array.isArray(media.genres)) {
        for (const genre of media.genres) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      }
    } else {
      // Fallback: estimate 24 minutes per episode
      if (item.completed) {
        totalMinutes += 24;
      } else if (item.progress > 0) {
        totalMinutes += Math.min(item.progress / 60, 24);
      }
    }
  }

  // Calculate top genres
  const topGenres = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate completed anime (all main episodes watched)
  // This is a simplified calculation - in real app would need total episode count
  const completedAnime = watchHistory.filter(
    (item) => item.completed && item.episodeNumber >= 12
  ).length;

  // Calculate streaks
  const { currentStreak, longestStreak } = calculateStreaks(watchHistory);

  return {
    totalEpisodesWatched,
    totalMinutesWatched: Math.round(totalMinutes),
    totalHoursWatched: Math.round(totalMinutes / 60),
    totalDaysWatched: Math.round(totalMinutes / 60 / 24 * 10) / 10,
    topGenres,
    completedAnime,
    uniqueAnimeWatched,
    currentStreak,
    longestStreak,
  };
}

/**
 * Calculate watching streaks
 */
function calculateStreaks(watchHistory: WatchHistoryItem[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (watchHistory.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Group by date using UTC to avoid timezone-dependent grouping
  const watchDates = new Set<number>();
  for (const item of watchHistory) {
    const d = new Date(item.timestamp);
    const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    watchDates.add(utcDate.getTime());
  }

  const sortedDates = Array.from(watchDates).sort((a, b) => a - b);
  const now = new Date();
  const todayTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = todayTime;

  for (let i = 0; i < sortedDates.length; i++) {
    const checkDateObj = new Date(checkDate);
    const utcCheckDate = new Date(Date.UTC(checkDateObj.getUTCFullYear(), checkDateObj.getUTCMonth(), checkDateObj.getUTCDate()));
    if (sortedDates.includes(utcCheckDate.getTime())) {
      currentStreak++;
      checkDate -= 24 * 60 * 60 * 1000; // Go back one day
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const dayDiff = (sortedDates[i] - sortedDates[i - 1]) / (24 * 60 * 60 * 1000);
    if (dayDiff <= 1) {
      currentRun++;
    } else {
      longestStreak = Math.max(longestStreak, currentRun);
      currentRun = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentRun);

  return { currentStreak, longestStreak };
}

/**
 * Get stats from localStorage
 */
export function getStoredStats(): StatsData | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STATS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load stats:", error);
  }

  return null;
}

/**
 * Save stats to localStorage
 */
export function saveStats(stats: UserStats): void {
  if (typeof window === "undefined") return;

  try {
    const data: StatsData = {
      stats,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save stats:", error);
  }
}

/**
 * Format watch time for display
 */
export function formatWatchTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Get genre color for stats display
 */
export function getGenreColor(genre: string): string {
  const colors: Record<string, string> = {
    Action: "from-red-500 to-orange-500",
    Adventure: "from-emerald-500 to-teal-500",
    Comedy: "from-yellow-500 to-amber-500",
    Drama: "from-purple-500 to-pink-500",
    Fantasy: "from-indigo-500 to-violet-500",
    "Sci-Fi": "from-blue-500 to-cyan-500",
    Romance: "from-pink-500 to-rose-500",
    Horror: "from-gray-600 to-slate-800",
    Mystery: "from-violet-500 to-purple-500",
    "Slice of Life": "from-green-500 to-lime-500",
  };
  return colors[genre] || "from-primary to-secondary";
}
