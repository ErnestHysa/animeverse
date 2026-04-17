/**
 * Seed Tracking Settings Component
 * Displays user's seed statistics and achievements
 *
 * Phase 7: Content Acquisition & Seeding
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Award, TrendingUp, Clock, Users, Download, Upload } from "lucide-react";
import { useStore } from "@/store";
import {
  formatBytes,
  formatDuration,
  getRankProgress,
  checkSeedAchievements,
  SEED_ACHIEVEMENTS,
} from "@/lib/seed-tracker";
import { SeedStatsPanel } from "@/components/seed-tracking/seed-stats-badge";

export function SeedTrackingSettings() {
  const [seedSessions, setSeedSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalUploaded: 0,
    totalDownloaded: 0,
    totalSeededTime: 0,
    averageSeedRatio: 0,
    totalPeersHelped: 0,
  });
  const [achievements, setAchievements] = useState(SEED_ACHIEVEMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeedData();
  }, []);

  const loadSeedData = async () => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem("seedSessions");
      const sessions = stored ? JSON.parse(stored) : [];

      // Calculate stats
      const totalUploaded = sessions.reduce((sum: number, s: any) => sum + (s.uploaded || 0), 0);
      const totalDownloaded = sessions.reduce((sum: number, s: any) => sum + (s.downloaded || 0), 0);
      const totalSeededTime = sessions.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
      const totalPeersHelped = sessions.reduce((sum: number, s: any) => sum + (s.peers || 0), 0);

      const averageSeedRatio =
        sessions.length > 0 && totalDownloaded > 0
          ? totalUploaded / totalDownloaded
          : 0;

      const newStats = {
        totalSessions: sessions.length,
        totalUploaded,
        totalDownloaded,
        totalSeededTime,
        averageSeedRatio,
        totalPeersHelped,
        achievements: [],
      };

      // Check achievements
      const newAchievements = checkSeedAchievements(newStats);

      setSeedSessions(sessions);
      setStats(newStats);
      setAchievements(newAchievements);
    } catch (error) {
      console.error("Error loading seed data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading seed statistics...</p>
        </div>
      </div>
    );
  }

  if (stats.totalSessions === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🌱</div>
        <h3 className="text-xl font-semibold mb-2">Start Seeding Today!</h3>
        <p className="text-muted-foreground mb-4">
          Watch anime using the P2P/Torrent streaming method to start contributing
          to the community and earn achievements.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg">
          <Award className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300">
            {achievements.length} achievements waiting to be unlocked!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 text-purple-300 mb-1">
            <Upload className="w-4 h-4" />
            <span className="text-sm">Uploaded</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatBytes(stats.totalUploaded)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 text-blue-300 mb-1">
            <Download className="w-4 h-4" />
            <span className="text-sm">Downloaded</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatBytes(stats.totalDownloaded)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-2 text-green-300 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Seeding Time</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatDuration(stats.totalSeededTime)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-4 border border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-300 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Peers Helped</span>
          </div>
          <div className="text-xl font-bold text-white">
            {stats.totalPeersHelped}
          </div>
        </div>
      </div>

      {/* Rank Progress */}
      {(() => {
        const statsWithAchievements = { ...stats, achievements: [] };
        const rankProgress = getRankProgress(statsWithAchievements);
        return (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-6 border border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
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
                  <div className="flex items-center gap-2 justify-end">
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
              <div>
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
          </div>
        );
      })()}

      {/* Seed Ratio */}
      {stats.averageSeedRatio > 0 && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-6 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 mb-1">Average Seed Ratio</div>
              <div className="text-4xl font-bold text-white">
                {stats.averageSeedRatio.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Total Sessions</div>
              <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-400" />
          Achievements ({achievements.filter((a) => a.unlocked).length}/{achievements.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {achievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              whileHover={{ scale: 1.02 }}
              className={`relative p-4 rounded-lg border ${
                achievement.unlocked
                  ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30"
                  : "bg-gray-900/50 border-gray-700 opacity-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-white">{achievement.title}</h4>
                    {achievement.unlocked && (
                      <Award className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{achievement.description}</p>
                  {achievement.unlocked && achievement.unlockedAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Thank You Message */}
      {stats.totalUploaded > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-white mb-2">
            Thanks for Seeding!
          </h3>
          <p className="text-gray-400">
            You've helped {stats.totalPeersHelped} peers and uploaded{" "}
            {formatBytes(stats.totalUploaded)} of data.
            {stats.averageSeedRatio >= 1.0 &&
              " Your seed ratio of " + stats.averageSeedRatio.toFixed(2) + " is excellent!"}
          </p>
        </motion.div>
      )}

      {/* View Detailed Stats Button */}
      <button
        onClick={() => {
          window.open("/stats", "_blank", "noopener,noreferrer");
        }}
        className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <TrendingUp className="w-4 h-4" />
        View Detailed Statistics
      </button>
    </div>
  );
}
