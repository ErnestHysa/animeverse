/**
 * Magnet Ratings and Comments Types
 *
 * Phase 10: Community Feedback System
 * Allows users to rate and comment on magnet sources
 */

export interface MagnetRating {
  id: string;
  magnetHash: string;
  animeId: number;
  episodeNumber: number;
  userId: string;
  username: string;
  rating: number; // 1-5 stars
  quality: "excellent" | "good" | "fair" | "poor";
  videoQuality: "1080p" | "720p" | "480p" | "360p" | "other";
  audioQuality: "excellent" | "good" | "fair" | "poor";
  subtitleQuality: "excellent" | "good" | "fair" | "poor" | "none";
  playbackIssues: string[]; // e.g., ["audio-sync", "video-glitch", "missing-subs"]
  createdAt: string;
  updatedAt: string;
}

export interface MagnetComment {
  id: string;
  magnetHash: string;
  animeId: number;
  episodeNumber: number;
  userId: string;
  username: string;
  comment: string;
  isFlagged: boolean;
  flagReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MagnetSourceStats {
  magnetHash: string;
  animeId: number;
  episodeNumber: number;
  totalRatings: number;
  averageRating: number;
  qualityDistribution: Record<string, number>; // excellent, good, fair, poor
  totalComments: number;
  isVerified: boolean;
  isBroken: boolean;
  brokenCount: number; // Number of users reporting as broken
  lastChecked: string;
}

export interface MagnetFlag {
  id: string;
  magnetHash: string;
  userId: string;
  username: string;
  reason: "broken" | "malware" | "wrong-content" | "poor-quality" | "other";
  description: string;
  createdAt: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewAction?: "confirmed" | "rejected" | "pending";
}
