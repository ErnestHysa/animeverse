/**
 * Statistics Dashboard Page
 * Comprehensive viewing statistics and analytics
 */

"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { useStore } from "@/store";
import {
  Clock,
  Flame,
  TrendingUp,
  Award,
  BarChart3,
  Calendar,
  Heart,
  PlayCircle,
  Target,
  Zap,
} from "lucide-react";
import { ShareStatsCard } from "@/components/stats/share-stats-card";

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  color: string;
}

function StatCard({ icon, title, value, subtitle, trend, color }: StatCardProps) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        {trend !== undefined && (
          <div className={`flex items-center text-sm ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? "rotate-180" : ""}`} />
            <span className="ml-1">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-bold">{value}</h3>
        <p className="text-muted-foreground text-sm mt-1">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </GlassCard>
  );
}

interface GenreBarProps {
  genre: string;
  count: number;
  maxCount: number;
  color: string;
}

function GenreBar({ genre, count, maxCount, color }: GenreBarProps) {
  const percentage = (count / maxCount) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-24 text-right truncate">{genre}</span>
      <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-sm font-medium w-12">{count}</span>
    </div>
  );
}

export default function StatsPage() {
  const watchHistory = useStore((s) => s.watchHistory);
  const favorites = useStore((s) => s.favorites);
  const mediaCache = useStore((s) => s.mediaCache);
  const anilistMediaList = useStore((s) => s.anilistMediaList);
  const [currentTimestamp] = useState(() => Date.now());

  // Compute stable dependency keys to avoid re-computation on unrelated state changes (M12)
  const watchHistoryKey = watchHistory.map((h) => `${h.mediaId}:${h.episodeNumber}:${h.completed}:${h.timestamp}`).join('|');
  const favoritesKey = favorites.length;
  const mediaCacheKey = Object.keys(mediaCache).sort().join(',');

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    const totalEpisodes = watchHistory.length;
    const uniqueAnime = new Set(watchHistory.map((item) => item.mediaId));
    const completedAnime = watchHistory.filter((item) => item.completed).length;
    const totalWatchTime = watchHistory.reduce((acc, item) => {
      const anime = mediaCache[item.mediaId];
      const duration = anime?.duration || 24;
      return acc + duration;
    }, 0);

    // Calculate completion rate
    const completionRate = uniqueAnime.size > 0
      ? Math.round((completedAnime / uniqueAnime.size) * 100)
      : 0;

    // Calculate average episodes per anime
    const avgEpisodesPerAnime = uniqueAnime.size > 0
      ? Math.round(totalEpisodes / uniqueAnime.size)
      : 0;

    // Calculate weekly activity
    const now = currentTimestamp;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weeklyEpisodes = watchHistory.filter(
      (item) => item.timestamp >= oneWeekAgo
    ).length;

    // Calculate monthly activity
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const monthlyEpisodes = watchHistory.filter(
      (item) => item.timestamp >= oneMonthAgo
    ).length;

    // Genre distribution
    const genreCounts: Record<string, number> = {};
    watchHistory.forEach((item) => {
      const anime = mediaCache[item.mediaId];
      if (anime?.genres) {
        anime.genres.forEach((genre) => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }
    });

    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Most watched anime
    const animeWatchCounts: Record<number, number> = {};
    watchHistory.forEach((item) => {
      animeWatchCounts[item.mediaId] = (animeWatchCounts[item.mediaId] || 0) + 1;
    });

    const mostWatched = Object.entries(animeWatchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        anime: mediaCache[Number(id)],
        count,
      }))
      .filter((item) => item.anime);

    // Recent activity (last 7 days)
    const dailyActivity: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 86400000);
      const dateStr = date.toISOString().slice(0, 10);
      const dayLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()];
      dailyActivity[dayLabel] = 0;
    }

    watchHistory.forEach((item) => {
      const watchDate = new Date(item.timestamp);
      const daysDiff = Math.floor((now - item.timestamp) / 86400000);
      if (daysDiff < 7) {
        const dayLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][watchDate.getUTCDay()];
        if (dailyActivity.hasOwnProperty(dayLabel)) {
          dailyActivity[dayLabel]++;
        }
      }
    });

    return {
      totalEpisodes,
      uniqueAnimeCount: uniqueAnime.size,
      completedAnime,
      totalWatchTime,
      completionRate,
      avgEpisodesPerAnime,
      weeklyEpisodes,
      monthlyEpisodes,
      sortedGenres,
      mostWatched,
      dailyActivity,
      favoritesCount: favorites.length,
      maxGenreCount: sortedGenres[0]?.[1] || 1,
    };
  }, [watchHistoryKey, favoritesKey, mediaCacheKey, currentTimestamp]);

  const genreColors = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
    "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#6366f1",
  ];

  // Format watch time
  const formatWatchTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Viewing Statistics</h1>
            <p className="text-muted-foreground">Track your anime watching journey</p>
          </div>
          <ShareStatsCard
            totalEpisodes={stats.totalEpisodes}
            totalHours={Math.floor(stats.totalWatchTime / 60)}
            uniqueAnime={stats.uniqueAnimeCount}
            topGenre={stats.sortedGenres[0]?.[0] ?? ""}
            completionRate={stats.completionRate}
          />
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<PlayCircle className="w-6 h-6 text-white" />}
            title="Episodes Watched"
            value={stats.totalEpisodes}
            subtitle={`${stats.weeklyEpisodes} this week`}
            trend={stats.weeklyEpisodes > 0 ? 12 : undefined}
            color="bg-blue-500"
          />
          <StatCard
            icon={<Flame className="w-6 h-6 text-white" />}
            title="Anime Completed"
            value={stats.completedAnime}
            subtitle={`out of ${stats.uniqueAnimeCount} started`}
            trend={stats.completionRate >= 50 ? 8 : undefined}
            color="bg-orange-500"
          />
          <StatCard
            icon={<Clock className="w-6 h-6 text-white" />}
            title="Watch Time"
            value={formatWatchTime(stats.totalWatchTime)}
            subtitle={`${stats.monthlyEpisodes} episodes this month`}
            color="bg-purple-500"
          />
          <StatCard
            icon={<Target className="w-6 h-6 text-white" />}
            title="Completion Rate"
            value={`${stats.completionRate}%`}
            subtitle="avg anime finished"
            color="bg-green-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Genre Distribution */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Genre Distribution
              </h2>
              <span className="text-sm text-muted-foreground">
                Top {stats.sortedGenres.length} genres
              </span>
            </div>
            <div className="space-y-3">
              {stats.sortedGenres.map(([genre, count], index) => (
                <GenreBar
                  key={genre}
                  genre={genre}
                  count={count}
                  maxCount={stats.maxGenreCount}
                  color={genreColors[index % genreColors.length]}
                />
              ))}
              {stats.sortedGenres.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Watch some anime to see your genre preferences!
                </p>
              )}
            </div>
          </GlassCard>

          {/* Most Watched */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Most Watched
              </h2>
              <span className="text-sm text-muted-foreground">
                By episodes
              </span>
            </div>
            <div className="space-y-3">
              {stats.mostWatched.map((item, index) => (
                <div
                  key={item.anime.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <img
                    src={item.anime.coverImage.large || "/images/anime-placeholder.svg"}
                    alt={item.anime.title.userPreferred || ""}
                    className="w-12 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {item.anime.title.userPreferred || item.anime.title.english}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {item.count} episodes
                    </p>
                  </div>
                </div>
              ))}
              {stats.mostWatched.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No anime watched yet. Start watching!
                </p>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Weekly Activity */}
        <GlassCard className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Weekly Activity
            </h2>
            <span className="text-sm text-muted-foreground">
              Last 7 days
            </span>
          </div>
          <div className="flex items-end justify-between gap-2 h-40">
            {Object.entries(stats.dailyActivity).map(([day, count], index) => {
              const maxCount = Math.max(...Object.values(stats.dailyActivity), 1);
              const height = (count / maxCount) * 100;
              const isToday = index === Object.keys(stats.dailyActivity).length - 1;

              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">{count}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      isToday ? "bg-primary" : "bg-primary/50"
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className={`text-xs ${isToday ? "font-semibold" : "text-muted-foreground"}`}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <GlassCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-pink-500/20">
                <Heart className="w-6 h-6 text-pink-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{stats.favoritesCount}</h3>
                <p className="text-sm text-muted-foreground">Favorites</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-500/20">
                <PlayCircle className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{stats.avgEpisodesPerAnime}</h3>
                <p className="text-sm text-muted-foreground">Avg Episodes/Anime</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/20">
                <Award className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{stats.uniqueAnimeCount}</h3>
                <p className="text-sm text-muted-foreground">Unique Anime</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* AniList Sync Stats */}
        {anilistMediaList.length > 0 && (
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold">AniList Sync Stats</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{anilistMediaList.length}</p>
                <p className="text-sm text-muted-foreground">Synced Anime</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {anilistMediaList.filter((a) => a.status === "COMPLETED").length}
                </p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {anilistMediaList.filter((a) => a.status === "CURRENT").length}
                </p>
                <p className="text-sm text-muted-foreground">Watching</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {anilistMediaList.filter((a) => a.status === "PLANNING").length}
                </p>
                <p className="text-sm text-muted-foreground">Plan to Watch</p>
              </div>
            </div>
          </GlassCard>
        )}
      </main>

      <Footer />
    </div>
  );
}
