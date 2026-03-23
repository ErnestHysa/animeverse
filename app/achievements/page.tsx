/**
 * Achievements Page
 * Displays user achievements and gamification stats
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Trophy, Target, Award, TrendingUp, Lock } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { useStore } from "@/store";
import { ACHIEVEMENTS, RARITY_COLORS, RARITY_BADGES, getAchievementRequirement } from "@/lib/achievements";

export default function AchievementsPage() {
  const { achievements, unlockedAchievements, watchHistory, favorites } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<"all" | "watching" | "social" | "collection" | "exploration">("all");

  // Calculate stats
  const totalEpisodes = watchHistory.length;
  const uniqueAnime = new Set(watchHistory.map((item) => item.mediaId)).size;
  const completedAnime = watchHistory.filter((item) => item.completed).length;
  const favoritesCount = favorites.length;

  // Group achievements by category
  const groupedAchievements = ACHIEVEMENTS.reduce((acc, achievement) => {
    if (!acc[achievement.category]) acc[achievement.category] = [];
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<string, typeof ACHIEVEMENTS>);

  // Filter by category
  const filteredAchievements = selectedCategory === "all"
    ? ACHIEVEMENTS
    : (groupedAchievements[selectedCategory] || []);

  // Sort by rarity (legendary first)
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sortedAchievements = [...filteredAchievements].sort((a, b) =>
    rarityOrder[a.rarity] - rarityOrder[b.rarity]
  );

  // Calculate progress for each achievement
  const getProgress = (achievement: typeof ACHIEVEMENTS[0]) => {
    const progress = achievements[achievement.id] || 0;
    const requirement = achievement.requirement;
    return Math.min(100, (progress / requirement) * 100);
  };

  const isUnlocked = (achievementId: string) => unlockedAchievements.includes(achievementId);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <div>
              <h1 className="text-3xl font-display font-bold">Achievements</h1>
              <p className="text-muted-foreground">
                {unlockedAchievements.length} / {ACHIEVEMENTS.length} unlocked
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <GlassCard className="p-4 text-center">
              <div className="text-3xl mb-2">{totalEpisodes}</div>
              <div className="text-sm text-muted-foreground">Episodes</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-3xl mb-2">{uniqueAnime}</div>
              <div className="text-sm text-muted-foreground">Anime Watched</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-3xl mb-2">{completedAnime}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-3xl mb-2">{favoritesCount}</div>
              <div className="text-sm text-muted-foreground">Favorites</div>
            </GlassCard>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-primary text-white"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedCategory("watching")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === "watching"
                  ? "bg-primary text-white"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground"
              }`}
            >
              📺 Watching
            </button>
            <button
              onClick={() => setSelectedCategory("collection")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === "collection"
                  ? "bg-primary text-white"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground"
              }`}
            >
              📚 Collection
            </button>
            <button
              onClick={() => setSelectedCategory("exploration")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === "exploration"
                  ? "bg-primary text-white"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground"
              }`}
            >
              🧭 Exploration
            </button>
            <button
              onClick={() => setSelectedCategory("social")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === "social"
                  ? "bg-primary text-white"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground"
              }`}
            >
              💬 Social
            </button>
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAchievements.map((achievement) => {
              const unlocked = isUnlocked(achievement.id);
              const progress = getProgress(achievement);

              return (
                <GlassCard
                  key={achievement.id}
                  className={`p-6 transition-all ${
                    unlocked
                      ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-3xl ${
                          unlocked ? "" : "grayscale opacity-50"
                        }`}
                      >
                        {achievement.icon}
                      </span>
                      <div>
                        <h3 className={`font-semibold ${unlocked ? "text-yellow-400" : ""}`}>
                          {achievement.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                    {unlocked ? (
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className={unlocked ? "text-yellow-400 font-semibold" : "text-muted-foreground"}>
                        {unlocked ? "Unlocked!" : `${Math.round(progress)}%`}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          unlocked
                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                            : "bg-primary"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-1 rounded bg-gradient-to-r opacity-50 font-semibold"
                      style={{
                        background: RARITY_COLORS[achievement.rarity],
                      }}
                    >
                      {RARITY_BADGES[achievement.rarity]}
                    </span>
                    <span className="text-muted-foreground">
                      {achievement.requirement} required
                    </span>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* Empty State (if no achievements) */}
          {ACHIEVEMENTS.length === 0 && (
            <GlassCard className="max-w-2xl mx-auto p-12 text-center">
              <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Start Your Journey</h2>
              <p className="text-muted-foreground mb-6">
                Watch anime and complete challenges to unlock achievements!
              </p>
            </GlassCard>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
