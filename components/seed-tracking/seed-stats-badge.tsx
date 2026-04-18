/**
 * Seed Stats Badge Component
 * Displays user's seed rank and statistics
 *
 * Phase 7: Content Acquisition & Seeding
 */

"use client";

import { motion } from "framer-motion";
import { Award, TrendingUp, Clock, Users } from "lucide-react";
import { formatBytes, formatDuration, getRankProgress } from "@/lib/seed-tracker";
import type { SeedAchievement } from "@/types/seed-tracking";

interface SeedStatsBadgeProps {
  totalUploaded: number;
  totalDownloaded: number;
  totalSeededTime: number;
  averageSeedRatio: number;
  totalPeersHelped: number;
}

export function SeedStatsBadge({
  totalUploaded,
  totalDownloaded,
  totalSeededTime,
  averageSeedRatio,
  totalPeersHelped,
}: SeedStatsBadgeProps) {
  const rankProgress = getRankProgress({
    totalSessions: 0,
    totalUploaded,
    totalDownloaded,
    totalSeededTime,
    averageSeedRatio,
    totalPeersHelped,
    achievements: [],
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-lg"
    >
      <div className="text-2xl">{rankProgress.current.icon}</div>
      <div className="text-white">
        <div className="text-sm font-semibold">{rankProgress.current.title}</div>
        <div className="text-xs opacity-90">
          {formatBytes(totalUploaded)} uploaded
        </div>
      </div>
      {averageSeedRatio > 0 && (
        <div className="ml-2 text-xs text-white bg-white/20 px-2 py-1 rounded-full">
          Ratio: {(Number.isFinite(averageSeedRatio) ? averageSeedRatio : 0).toFixed(2)}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Seed Stats Panel Component
 * Full statistics panel for seed tracking
 */

interface SeedStatsPanelProps {
  stats: {
    totalSessions: number;
    totalUploaded: number;
    totalDownloaded: number;
    totalSeededTime: number;
    averageSeedRatio: number;
    totalPeersHelped: number;
  };
  achievements?: SeedAchievement[];
}

export function SeedStatsPanel({ stats, achievements = [] }: SeedStatsPanelProps) {
  // Add achievements to stats for getRankProgress
  const statsWithAchievements = { ...stats, achievements };
  const rankProgress = getRankProgress(statsWithAchievements);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
      {/* Rank Display */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="text-5xl">{rankProgress.current.icon}</div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {rankProgress.current.title}
            </h3>
            <p className="text-sm text-gray-400">
              {formatBytes(stats.totalUploaded)} total uploaded
            </p>
          </div>
        </div>

        {rankProgress.next && (
          <div className="text-right">
            <div className="text-sm text-gray-400">Next Rank</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{rankProgress.next.icon}</span>
              <span className="text-white font-semibold">
                {rankProgress.next.title}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {formatBytes(
                Math.max(0, rankProgress.next.requirement.value - stats.totalUploaded)
              )}{" "}
              remaining
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {rankProgress.next && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progress to {rankProgress.next.title}</span>
            <span>{rankProgress.progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${rankProgress.progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            />
          </div>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Uploaded</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatBytes(stats.totalUploaded)}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4 rotate-180" />
            <span className="text-sm">Downloaded</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatBytes(stats.totalDownloaded)}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Seeding Time</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatDuration(stats.totalSeededTime)}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Peers Helped</span>
          </div>
          <div className="text-xl font-bold text-white">
            {stats.totalPeersHelped}
          </div>
        </div>
      </div>

      {/* Seed Ratio */}
      {stats.averageSeedRatio > 0 && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 mb-6 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Average Seed Ratio</div>
              <div className="text-3xl font-bold text-white">
                {(Number.isFinite(stats.averageSeedRatio) ? stats.averageSeedRatio : 0).toFixed(2)}
              </div>
            </div>
            <div className="text-5xl opacity-20">⚖️</div>
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-white mb-3">
            Achievements ({achievements.filter((a) => a.unlocked).length}/{achievements.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {achievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                whileHover={{ scale: 1.05 }}
                className={`relative p-3 rounded-lg border ${
                  achievement.unlocked
                    ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30"
                    : "bg-gray-900/50 border-gray-700 opacity-50"
                }`}
              >
                <div className="text-2xl mb-1">{achievement.icon}</div>
                <div className="text-sm font-medium text-white">
                  {achievement.title}
                </div>
                <div className="text-xs text-gray-400">
                  {achievement.description}
                </div>
                {achievement.unlocked && (
                  <div className="absolute top-1 right-1">
                    <Award className="w-3 h-3 text-yellow-400" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Thank You Message */}
      {stats.totalUploaded > 0 && (
        <div className="mt-6 text-center">
          <p className="text-lg text-white font-medium">
            🎉 Thanks for seeding! 🎉
          </p>
          <p className="text-sm text-gray-400">
            You've helped {stats.totalPeersHelped} peers and uploaded{" "}
            {formatBytes(stats.totalUploaded)} of data.
          </p>
        </div>
      )}
    </div>
  );
}
