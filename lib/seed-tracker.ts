/**
 * Seed Ratio Tracker
 * Tracks user upload/download ratios and seeding statistics
 *
 * Phase 7: Content Acquisition & Seeding
 */

import type { SeedSession, SeedStats, SeedAchievement, SeedRank } from "@/types/seed-tracking";

// ===================================
// Constants
// ===================================

// NOTE: lib/achievements.ts is the canonical achievement definition source.
// The SEED_ACHIEVEMENTS and SEED_RANKS defined here are seed-specific and
// re-exported via achievements.ts for unified consumer access.

export const SEED_ACHIEVEMENTS: SeedAchievement[] = [
  {
    id: "first_seed",
    title: "First Seed",
    description: "Complete your first seeding session",
    icon: "🌱",
    requirement: { type: "upload", value: 1 },
    unlocked: false,
  },
  {
    id: "seed_1gb",
    title: "Contributor",
    description: "Upload 1 GB of data",
    icon: "📤",
    requirement: { type: "upload", value: 1073741824 },
    unlocked: false,
  },
  {
    id: "seed_10gb",
    title: "Seeder",
    description: "Upload 10 GB of data",
    icon: "💾",
    requirement: { type: "upload", value: 10737418240 },
    unlocked: false,
  },
  {
    id: "seed_100gb",
    title: "Super Seeder",
    description: "Upload 100 GB of data",
    icon: "🚀",
    requirement: { type: "upload", value: 107374182400 },
    unlocked: false,
  },
  {
    id: "ratio_2",
    title: "Generous",
    description: "Achieve 2.0 seed ratio",
    icon: "⚖️",
    requirement: { type: "ratio", value: 2.0 },
    unlocked: false,
  },
  {
    id: "ratio_5",
    title: "Philanthropist",
    description: "Achieve 5.0 seed ratio",
    icon: "🎁",
    requirement: { type: "ratio", value: 5.0 },
    unlocked: false,
  },
  {
    id: "time_1hour",
    title: "Dedicated",
    description: "Seed for 1 hour total",
    icon: "⏰",
    requirement: { type: "time", value: 3600 },
    unlocked: false,
  },
  {
    id: "time_24hours",
    title: "Committed",
    description: "Seed for 24 hours total",
    icon: "🌟",
    requirement: { type: "time", value: 86400 },
    unlocked: false,
  },
  {
    id: "peers_10",
    title: "Helpful",
    description: "Help 10 peers",
    icon: "🤝",
    requirement: { type: "peers", value: 10 },
    unlocked: false,
  },
  {
    id: "peers_100",
    title: "Community Hero",
    description: "Help 100 peers",
    icon: "🏆",
    requirement: { type: "peers", value: 100 },
    unlocked: false,
  },
];

export const SEED_RANKS: SeedRank[] = [
  {
    level: "bronze",
    title: "Bronze Seeder",
    requirement: { type: "upload", value: 1073741824 }, // 1 GB
    color: "#cd7f32",
    icon: "🥉",
  },
  {
    level: "silver",
    title: "Silver Seeder",
    requirement: { type: "upload", value: 10737418240 }, // 10 GB
    color: "#c0c0c0",
    icon: "🥈",
  },
  {
    level: "gold",
    title: "Gold Seeder",
    requirement: { type: "upload", value: 107374182400 }, // 100 GB
    color: "#ffd700",
    icon: "🥇",
  },
  {
    level: "platinum",
    title: "Platinum Seeder",
    requirement: { type: "upload", value: 1073741824000 }, // 1 TB
    color: "#e5e4e2",
    icon: "💎",
  },
  {
    level: "diamond",
    title: "Diamond Seeder",
    requirement: { type: "upload", value: 10737418240000 }, // 10 TB
    color: "#b9f2ff",
    icon: "👑",
  },
];

// ===================================
// Seed Tracking Functions
// ===================================

/**
 * Start a new seed session
 */
export function startSeedSession(
  animeId: number,
  animeTitle: string,
  episode: number,
  infoHash: string
): SeedSession {
  return {
    id: `${animeId}-${episode}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
    animeId,
    animeTitle,
    episode,
    infoHash,
    startedAt: Date.now(),
    duration: 0,
    uploaded: 0,
    downloaded: 0,
    seedRatio: 0,
    peers: 0,
    status: "active",
  };
}

/**
 * Update seed session with current stats
 */
export function updateSeedSession(
  session: SeedSession,
  uploaded: number,
  downloaded: number,
  peers: number
): SeedSession {
  const now = Date.now();
  const duration = Math.floor((now - session.startedAt) / 1000);
  let seedRatio: number;
  if (downloaded === 0 && uploaded > 0) {
    seedRatio = 999; // Cap instead of Infinity to avoid corrupting averages
  } else if (downloaded > 0) {
    seedRatio = uploaded / downloaded;
  } else {
    seedRatio = 0;
  }

  return {
    ...session,
    uploaded,
    downloaded,
    duration,
    seedRatio,
    peers,
  };
}

/**
 * End a seed session
 */
export function endSeedSession(session: SeedSession, status: "completed" | "error" = "completed"): SeedSession {
  return {
    ...session,
    endedAt: Date.now(),
    status,
  };
}

/**
 * Calculate aggregate seed statistics from sessions
 */
export function calculateSeedStats(sessions: SeedSession[]): SeedStats {
  const completedSessions = sessions.filter((s) => s.status === "completed");

  const totalUploaded = completedSessions.reduce((sum, s) => sum + s.uploaded, 0);
  const totalDownloaded = completedSessions.reduce((sum, s) => sum + s.downloaded, 0);
  const totalSeededTime = completedSessions.reduce((sum, s) => sum + s.duration, 0);
  const totalPeersHelped = completedSessions.reduce((sum, s) => sum + s.peers, 0);

  const validRatios = completedSessions
    .filter(s => isFinite(s.seedRatio))
    .map(s => s.seedRatio);
  const averageSeedRatio = validRatios.length > 0
    ? validRatios.reduce((sum, r) => sum + r, 0) / validRatios.length
    : 0;

  return {
    totalSessions: completedSessions.length,
    totalUploaded,
    totalDownloaded,
    totalSeededTime,
    averageSeedRatio,
    totalPeersHelped,
    achievements: [],
  };
}

/**
 * Check and unlock achievements based on stats
 */
export function checkSeedAchievements(stats: SeedStats): SeedAchievement[] {
  const unlocked: SeedAchievement[] = [];

  for (const achievement of SEED_ACHIEVEMENTS) {
    if (achievement.unlocked) continue;

    let shouldUnlock = false;

    switch (achievement.requirement.type) {
      case "upload":
        shouldUnlock = stats.totalUploaded >= achievement.requirement.value;
        break;
      case "ratio":
        shouldUnlock = stats.averageSeedRatio >= achievement.requirement.value;
        break;
      case "time":
        shouldUnlock = stats.totalSeededTime >= achievement.requirement.value;
        break;
      case "peers":
        shouldUnlock = stats.totalPeersHelped >= achievement.requirement.value;
        break;
      default:
        console.warn(`Unknown achievement type: ${achievement.requirement.type}`);
        shouldUnlock = false;
        break;
    }

    if (shouldUnlock) {
      unlocked.push({
        ...achievement,
        unlocked: true,
        unlockedAt: Date.now(),
      });
    }
  }

  return unlocked;
}

/**
 * Get user's current seed rank based on stats
 */
export function getSeedRank(stats: SeedStats): SeedRank {
  // Find highest rank achieved
  let currentRank = SEED_RANKS[0]; // Start with bronze

  for (const rank of SEED_RANKS) {
    if (rank.requirement.type === "upload" && stats.totalUploaded >= rank.requirement.value) {
      currentRank = rank;
    }
  }

  return currentRank;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) bytes = 0;
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Calculate progress to next rank
 */
export function getRankProgress(stats: SeedStats): {
  current: SeedRank;
  next?: SeedRank;
  progress: number; // 0-100
  remaining: string;
} {
  const current = getSeedRank(stats);
  const currentIndex = SEED_RANKS.findIndex((r) => r.level === current.level);

  if (currentIndex >= SEED_RANKS.length - 1) {
    return {
      current,
      progress: 100,
      remaining: "Max rank!",
    };
  }

  const next = SEED_RANKS[currentIndex + 1];
  const currentUpload = stats.totalUploaded;
  const required = next.requirement.value;

  if (currentUpload >= required) {
    return {
      current,
      next,
      progress: 100,
      remaining: "Rank achieved!",
    };
  }

  const progress = Math.min(100, (currentUpload / required) * 100);
  const remaining = formatBytes(required - currentUpload);

  return {
    current,
    next,
    progress,
    remaining,
  };
}
