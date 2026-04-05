/**
 * Seed Ratio Tracking Types
 *
 * Phase 7: Content Acquisition & Seeding
 */

export interface SeedSession {
  id: string;
  animeId: number;
  animeTitle: string;
  episode: number;
  infoHash: string;
  startedAt: number;
  endedAt?: number;
  duration: number; // seconds
  uploaded: number; // bytes
  downloaded: number; // bytes
  seedRatio: number; // uploaded / downloaded
  peers: number; // number of peers connected to
  status: "active" | "completed" | "error";
}

export interface SeedStats {
  totalSessions: number;
  totalUploaded: number; // bytes
  totalDownloaded: number; // bytes
  totalSeededTime: number; // seconds
  averageSeedRatio: number;
  totalPeersHelped: number;
  achievements: SeedAchievement[];
}

export interface SeedAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: {
    type: "upload" | "ratio" | "time" | "peers";
    value: number;
  };
  unlocked: boolean;
  unlockedAt?: number;
}

export interface SeedRank {
  level: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  title: string;
  requirement: {
    type: "upload" | "ratio" | "time";
    value: number;
  };
  color: string;
  icon: string;
}
