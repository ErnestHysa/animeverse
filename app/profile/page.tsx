/**
 * User Profile Page
 * Shows user stats, watch history, achievements, and connected accounts
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  useStore,
  useAniListAuth,
  useFavorites,
  useWatchlist,
} from "@/store";
import {
  User,
  Trophy,
  Clock,
  Heart,
  BookMarked,
  BarChart3,
  Star,
  Play,
  CheckCircle,
  TrendingUp,
  Calendar,
  Settings,
  LogIn,
  Award,
  Film,
  Tv,
  Hash,
  ExternalLink,
} from "lucide-react";

// ===================================
// Types
// ===================================

interface GenreCount {
  genre: string;
  count: number;
}

// ===================================
// Stat Card Component
// ===================================

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "secondary" | "green" | "orange" | "purple";
}) {
  const colorMap = {
    primary: "text-primary bg-primary/10",
    secondary: "text-secondary bg-secondary/10",
    green: "text-green-400 bg-green-400/10",
    orange: "text-orange-400 bg-orange-400/10",
    purple: "text-purple-400 bg-purple-400/10",
  };

  return (
    <GlassCard className="p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </GlassCard>
  );
}

// ===================================
// Profile Page
// ===================================

export default function ProfilePage() {
  const { anilistUser, isAuthenticated } = useAniListAuth();
  const { favorites } = useFavorites();
  const { watchlist } = useWatchlist();
  const watchHistory = useStore((state) => state.watchHistory);
  const anilistMediaList = useStore((state) => state.anilistMediaList);
  const mediaCache = useStore((state) => state.mediaCache);
  const achievements = useStore((state) => state.achievements);

  const [topGenres, setTopGenres] = useState<GenreCount[]>([]);

  // Compute stats
  const totalEpisodesWatched = watchHistory.length;
  const completedAnime = watchHistory.filter((h) => h.completed).length;
  const uniqueAnimeWatched = new Set(watchHistory.map((h) => h.mediaId)).size;
  const totalFavorites = favorites.length;
  const totalWatchlist = watchlist.length;

  // Compute watch time (assuming ~24 min per episode)
  const estimatedHours = Math.round((totalEpisodesWatched * 24) / 60);
  const estimatedDays = Math.round(estimatedHours / 24);

  // Achievements count
  const unlockedAchievements = Object.values(achievements).filter(
    (v) => v >= 1
  ).length;

  // AniList stats
  const anilistCompleted = anilistMediaList.filter(
    (e) => e.status === "COMPLETED"
  ).length;
  const anilistCurrent = anilistMediaList.filter(
    (e) => e.status === "CURRENT"
  ).length;
  const anilistPlanning = anilistMediaList.filter(
    (e) => e.status === "PLANNING"
  ).length;
  const anilistDropped = anilistMediaList.filter(
    (e) => e.status === "DROPPED"
  ).length;

  // Compute top genres from watched anime
  useEffect(() => {
    const genreMap = new Map<string, number>();
    watchHistory.forEach((item) => {
      const media = mediaCache[item.mediaId];
      if (media?.genres) {
        media.genres.forEach((genre: string) => {
          genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
        });
      }
    });

    const sorted = Array.from(genreMap.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    setTopGenres(sorted);
  }, [watchHistory, mediaCache]);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">

          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
            <div className="relative">
              {isAuthenticated && anilistUser?.avatar ? (
                <img
                  src={anilistUser.avatar.large || anilistUser.avatar.medium}
                  alt={anilistUser.name}
                  className="w-24 h-24 rounded-2xl object-cover ring-2 ring-primary/30"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <User className="w-12 h-12 text-primary" />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-display font-bold">
                {isAuthenticated && anilistUser
                  ? anilistUser.name
                  : "Local User"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isAuthenticated
                  ? "AniList account connected"
                  : "Guest profile — connect AniList to sync your data"}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {isAuthenticated && anilistUser && (
                  <a
                    href={`https://anilist.co/user/${anilistUser.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    AniList Profile
                  </a>
                )}
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-sm hover:bg-white/10 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </Link>
                <Link
                  href="/achievements"
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-sm hover:bg-white/10 transition-colors"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Achievements
                </Link>
              </div>
            </div>

            {!isAuthenticated && (
              <Link href="/settings">
                <Button className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Connect AniList
                </Button>
              </Link>
            )}
          </div>

          {/* Watch Stats Grid */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Watch Statistics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <StatCard
                icon={<Play className="w-6 h-6" />}
                label="Episodes Watched"
                value={totalEpisodesWatched.toLocaleString()}
                color="primary"
              />
              <StatCard
                icon={<Tv className="w-6 h-6" />}
                label="Anime Watched"
                value={uniqueAnimeWatched.toLocaleString()}
                color="secondary"
              />
              <StatCard
                icon={<CheckCircle className="w-6 h-6" />}
                label="Completed"
                value={completedAnime.toLocaleString()}
                color="green"
              />
              <StatCard
                icon={<Clock className="w-6 h-6" />}
                label="Watch Time"
                value={estimatedHours >= 24 ? `${estimatedDays}d` : `${estimatedHours}h`}
                sub={`~${estimatedHours}h total`}
                color="orange"
              />
              <StatCard
                icon={<Heart className="w-6 h-6" />}
                label="Favorites"
                value={totalFavorites.toLocaleString()}
                color="purple"
              />
              <StatCard
                icon={<BookMarked className="w-6 h-6" />}
                label="Watchlist"
                value={totalWatchlist.toLocaleString()}
                color="primary"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">

              {/* AniList Status Breakdown */}
              {isAuthenticated && anilistMediaList.length > 0 && (
                <section>
                  <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                    <Film className="w-5 h-5 text-primary" />
                    AniList Library
                  </h2>
                  <GlassCard className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Watching", value: anilistCurrent, color: "bg-green-500", icon: <Play className="w-4 h-4" /> },
                        { label: "Completed", value: anilistCompleted, color: "bg-primary", icon: <CheckCircle className="w-4 h-4" /> },
                        { label: "Planning", value: anilistPlanning, color: "bg-blue-500", icon: <Calendar className="w-4 h-4" /> },
                        { label: "Dropped", value: anilistDropped, color: "bg-red-500", icon: <Hash className="w-4 h-4" /> },
                      ].map((item) => (
                        <div key={item.label} className="text-center">
                          <div className={`w-12 h-12 rounded-full ${item.color}/20 flex items-center justify-center mx-auto mb-2`}>
                            <span className={`${item.color.replace('bg-', 'text-')}`}>
                              {item.icon}
                            </span>
                          </div>
                          <p className="text-2xl font-bold">{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar breakdown */}
                    {anilistMediaList.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-white/10">
                        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                          {anilistCurrent > 0 && (
                            <div
                              className="bg-green-500"
                              style={{ width: `${(anilistCurrent / anilistMediaList.length) * 100}%` }}
                            />
                          )}
                          {anilistCompleted > 0 && (
                            <div
                              className="bg-primary"
                              style={{ width: `${(anilistCompleted / anilistMediaList.length) * 100}%` }}
                            />
                          )}
                          {anilistPlanning > 0 && (
                            <div
                              className="bg-blue-500"
                              style={{ width: `${(anilistPlanning / anilistMediaList.length) * 100}%` }}
                            />
                          )}
                          {anilistDropped > 0 && (
                            <div
                              className="bg-red-500"
                              style={{ width: `${(anilistDropped / anilistMediaList.length) * 100}%` }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-right">
                          {anilistMediaList.length} total entries
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <Link href="/watchlist" className="flex-1">
                        <Button variant="glass" className="w-full text-sm">View Full List</Button>
                      </Link>
                    </div>
                  </GlassCard>
                </section>
              )}

              {/* Top Genres */}
              {topGenres.length > 0 && (
                <section>
                  <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-primary" />
                    Top Genres
                  </h2>
                  <GlassCard className="p-6">
                    <div className="space-y-3">
                      {topGenres.map((item, index) => (
                        <div key={item.genre}>
                          <div className="flex items-center justify-between mb-1">
                            <Link
                              href={`/genre/${item.genre.toLowerCase()}`}
                              className="text-sm font-medium hover:text-primary transition-colors"
                            >
                              {item.genre}
                            </Link>
                            <span className="text-xs text-muted-foreground">{item.count} anime</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full transition-all"
                              style={{ width: `${(item.count / (topGenres[0]?.count || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </section>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">

              {/* Achievements Preview */}
              <section>
                <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Achievements
                </h2>
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold">{unlockedAchievements}</p>
                      <p className="text-sm text-muted-foreground">Unlocked</p>
                    </div>
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <Link href="/achievements">
                    <Button variant="glass" className="w-full text-sm">View All Achievements</Button>
                  </Link>
                </GlassCard>
              </section>

              {/* Quick Links */}
              <section>
                <h2 className="text-xl font-display font-semibold mb-4">Quick Links</h2>
                <GlassCard className="p-2">
                  <div className="space-y-1">
                    {[
                      { href: "/history", icon: <Clock className="w-4 h-4" />, label: "Watch History" },
                      { href: "/favorites", icon: <Heart className="w-4 h-4" />, label: "Favorites" },
                      { href: "/watchlist", icon: <BookMarked className="w-4 h-4" />, label: "Watchlist" },
                      { href: "/stats", icon: <BarChart3 className="w-4 h-4" />, label: "Detailed Stats" },
                      { href: "/lists", icon: <TrendingUp className="w-4 h-4" />, label: "Custom Lists" },
                      { href: "/settings", icon: <Settings className="w-4 h-4" />, label: "Settings" },
                    ].map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
                      >
                        <span className="text-muted-foreground">{link.icon}</span>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </GlassCard>
              </section>

              {/* Not authenticated CTA */}
              {!isAuthenticated && (
                <GlassCard className="p-4 border border-primary/20">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <LogIn className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">Sync with AniList</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect your AniList account to sync your watch history, ratings, and lists.
                    </p>
                    <Link href="/settings">
                      <Button className="w-full text-sm">Connect Account</Button>
                    </Link>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// Note: metadata cannot be exported from client components
// Title is set via the layout's template pattern
