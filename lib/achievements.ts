/**
 * Achievement System
 * Gamification to increase user engagement
 *
 * CANONICAL SOURCE: This file is the canonical achievement definition source.
 * Other modules (e.g., seed-tracker.ts) should reference achievement definitions
 * from here rather than maintaining their own parallel achievement arrays.
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "watching" | "social" | "collection" | "exploration";
  requirement: number; // Number required to unlock
  rarity: "common" | "rare" | "epic" | "legendary";
  reward: string;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: number;
  progress: number;
}

// All available achievements
export const ACHIEVEMENTS: Achievement[] = [
  // Watching Achievements
  {
    id: "first-anime",
    name: "Anime Beginnings",
    description: "Watch your first anime episode",
    icon: "🎬",
    category: "watching",
    requirement: 1,
    rarity: "common",
    reward: "Started your journey",
  },
  {
    id: "episode-10",
    name: "Binge Watcher",
    description: "Watch 10 anime episodes",
    icon: "📺",
    category: "watching",
    requirement: 10,
    rarity: "common",
    reward: "Getting into it",
  },
  {
    id: "episode-50",
    name: "Dedicated Fan",
    description: "Watch 50 anime episodes",
    icon: "🔥",
    category: "watching",
    requirement: 50,
    rarity: "rare",
    reward: "True fan status",
  },
  {
    id: "episode-100",
    name: "Anime Veteran",
    description: "Watch 100 anime episodes",
    icon: "⭐",
    category: "watching",
    requirement: 100,
    rarity: "epic",
    reward: "100 episodes watched!",
  },
  {
    id: "episode-500",
    name: "Anime Master",
    description: "Watch 500 anime episodes",
    icon: "👑",
    category: "watching",
    requirement: 500,
    rarity: "legendary",
    reward: "500 episodes - incredible!",
  },
  {
    id: "anime-10",
    name: "Explorer",
    description: "Watch 10 different anime",
    icon: "🧭",
    category: "exploration",
    requirement: 10,
    rarity: "common",
    reward: "Branching out",
  },
  {
    id: "anime-50",
    name: "Collector",
    description: "Watch 50 different anime",
    icon: "📚",
    category: "collection",
    requirement: 50,
    rarity: "epic",
    reward: "Impressive collection!",
  },
  {
    id: "completed-5",
    name: "Series Finisher",
    description: "Complete 5 anime series",
    icon: "🏁",
    category: "watching",
    requirement: 5,
    rarity: "common",
    reward: "Finish what you start",
  },
  {
    id: "completed-25",
    name: "Marathon Runner",
    description: "Complete 25 anime series",
    icon: "🏆",
    category: "watching",
    requirement: 25,
    rarity: "epic",
    reward: "Committed viewer",
  },
  {
    id: "favorites-10",
    name: "Fan Favorite",
    description: "Add 10 anime to favorites",
    icon: "❤️",
    category: "collection",
    requirement: 10,
    rarity: "common",
    reward: "Building your collection",
  },
  {
    id: "favorites-50",
    name: "Super Fan",
    description: "Add 50 anime to favorites",
    icon: "💖",
    category: "collection",
    requirement: 50,
    rarity: "rare",
    reward: "Huge fan!",
  },
  {
    id: "list-creator",
    name: "List Maker",
    description: "Create your first custom list",
    icon: "📝",
    category: "social",
    requirement: 1,
    rarity: "common",
    reward: "Getting organized",
  },
  {
    id: "shonen-fan",
    name: "Shonen Enthusiast",
    description: "Watch 100 shonen episodes",
    icon: "⚔️",
    category: "watching",
    requirement: 100,
    rarity: "rare",
    reward: "Action lover!",
  },
  {
    id: "slice-of-life",
    name: "Slice of Life",
    description: "Watch 50 slice of life episodes",
    icon: "🌸",
    category: "watching",
    requirement: 50,
    rarity: "rare",
    reward: "Relaxing vibes",
  },
];

// Rarity colors for UI
export const RARITY_COLORS = {
  common: "from-gray-500 to-gray-600",
  rare: "from-blue-500 to-blue-600",
  epic: "from-purple-500 to-purple-600",
  legendary: "from-yellow-500 to-orange-500",
};

export const RARITY_BADGES = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

// Helper function to get achievement requirement
export function getAchievementRequirement(achievementId: string): number {
  const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
  return achievement?.requirement || 0;
}

// ===================================
// Re-exports for unified achievement access
// ===================================

// Re-export seed-tracker achievements and ranks so consumers can import
// from this canonical module instead of reaching into seed-tracker directly.
export { SEED_ACHIEVEMENTS, SEED_RANKS, checkSeedAchievements, getSeedRank } from "./seed-tracker";
