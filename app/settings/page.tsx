/**
 * Settings Page
 * User preferences for video quality, autoplay, subtitles, theme, streaming method
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { usePreferences, useWatchlist, useFavorites, useAniListAuth } from "@/store";
import { useTheme } from "@/components/providers/theme-provider";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Play,
  Zap,
  Trash2,
  Download,
  RefreshCw,
  Bell,
  Check,
  Shield,
  LogOut,
  LogIn,
  User,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import {
  calculateStats,
  formatWatchTime,
  getGenreColor,
  saveStats,
  type UserStats,
} from "@/lib/stats";
import { useStore } from "@/store";
import { Clock, Flame, TrendingUp, BarChart3, Award } from "lucide-react";

export default function SettingsPage() {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { watchlist, clearWatchlist: clearList } = useWatchlist();
  const { favorites, clearFavorites } = useFavorites();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { mediaCache, watchHistory, clearWatchHistory } = useStore();
  const {
    anilistUser,
    anilistToken,
    isAuthenticated,
    setAniListAuth,
    clearAniListAuth,
    syncAniListData,
  } = useAniListAuth();

  const [historyCount, setHistoryCount] = useState(() => {
    // Initialize with 0 on server, actual count on client
    if (typeof window !== "undefined") {
      return watchHistory.length;
    }
    return 0;
  });

  const [userStats, setUserStats] = useState<UserStats>({
    totalEpisodesWatched: 0,
    totalMinutesWatched: 0,
    totalHoursWatched: 0,
    totalDaysWatched: 0,
    topGenres: [],
    completedAnime: 0,
    uniqueAnimeWatched: 0,
    currentStreak: 0,
    longestStreak: 0,
  });

  const calculateAndSetStats = () => {
    if (typeof window === "undefined") return;

    // Use watchHistory from Zustand store (includes all watch data)
    const stats = calculateStats(watchHistory, mediaCache);
    setUserStats(stats);
    saveStats(stats);
  };

  useEffect(() => {
    calculateAndSetStats();
    // Update history count when watchHistory changes
    setHistoryCount(watchHistory.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchHistory, mediaCache]);

  const handleSavePreference = async (key: string, value: unknown) => {
    updatePreferences({ [key]: value });
    toast.success("Settings saved");
  };

  const handleResetAll = async () => {
    if (confirm("Are you sure you want to reset all settings? This cannot be undone.")) {
      resetPreferences();
      toast.success("Settings reset to default");
    }
  };

  const handleClearHistory = () => {
    clearWatchHistory();
    // Also clear the stats from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("animeverse_stats");
    }
    // Reset stats display
    setUserStats({
      totalEpisodesWatched: 0,
      totalMinutesWatched: 0,
      totalHoursWatched: 0,
      totalDaysWatched: 0,
      topGenres: [],
      completedAnime: 0,
      uniqueAnimeWatched: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
    setHistoryCount(0);
    toast.success("Watch history cleared");
  };

  const handleClearCache = async () => {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      toast.success("Cache cleared");
    }
  };

  const exportData = () => {
    const statsData = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("animeverse_stats") || "null")
      : null;

    const data = {
      preferences,
      watchlist,
      favorites,
      watchHistory,
      stats: statsData,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animeverse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  // ===================================
  // AniList OAuth Handlers
  // ===================================

  // Handle OAuth callback from URL hash
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get("auth");

    if (authStatus === "success") {
      // Get auth data from URL hash
      try {
        const hashData = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
        if (hashData.token && hashData.user) {
          setAniListAuth(hashData.user, hashData.token);
          toast.success(`Welcome back, ${hashData.user.name}!`);

          // Fetch and sync AniList data
          fetchAniListData(hashData.token);
        }
      } catch (error) {
        console.error("Error parsing auth data:", error);
      }

      // Clean up URL
      window.history.replaceState({}, "", "/settings");
    } else if (authStatus === "error") {
      const message = params.get("message");
      toast.error(`Authentication failed: ${message}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [setAniListAuth]);

  // Fetch user's AniList data and sync with local state
  const fetchAniListData = async (token: string) => {
    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `
            query {
              MediaListCollection(userId: $userId, type: ANIME) {
                mediaId
                status
                progress
                score
                media {
                  id
                  idMal
                  title { romaji english }
                  coverImage { large }
                  status
                  episodes
                }
              }
            }
          `,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const mediaList = result.data?.MediaListCollection || [];
        syncAniListData(mediaList);
        toast.success("AniList data synced!");
      }
    } catch (error) {
      console.error("Error fetching AniList data:", error);
    }
  };

  // Login with AniList
  const handleAniListLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID || "16500";
    const redirectUri = `${window.location.origin}/auth/anilist/callback`;
    const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    window.location.href = authUrl;
  };

  // Logout from AniList
  const handleAniListLogout = () => {
    clearAniListAuth();
    toast.success("Logged out from AniList");
  };

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Settings className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Settings</h1>
              <p className="text-muted-foreground">
                Customize your viewing experience
              </p>
            </div>
          </div>

          <div className="max-w-3xl space-y-6">
            {/* Playback Settings */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Playback
              </h2>

              <div className="space-y-4">
                {/* Default Quality */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Default Video Quality</p>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred video quality
                    </p>
                  </div>
                  <select
                    value={preferences.defaultQuality}
                    onChange={(e) => handleSavePreference("defaultQuality", e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="auto">Auto</option>
                    <option value="360p">360p</option>
                    <option value="480p">480p</option>
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p Full HD</option>
                  </select>
                </div>

                {/* Autoplay */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Autoplay</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically play videos when loaded
                    </p>
                  </div>
                  <button
                    onClick={() => handleSavePreference("autoplay", !preferences.autoplay)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      preferences.autoplay ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        preferences.autoplay ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Auto Next Episode */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Auto-play Next Episode</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically play the next episode when current ends
                    </p>
                  </div>
                  <button
                    onClick={() => handleSavePreference("autoNext", !preferences.autoNext)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      preferences.autoNext ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        preferences.autoNext ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Auto Skip Intro */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Auto Skip Intro</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically skip opening themes (when available)
                    </p>
                  </div>
                  <button
                    onClick={() => handleSavePreference("autoSkipIntro", !preferences.autoSkipIntro)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      preferences.autoSkipIntro ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        preferences.autoSkipIntro ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Auto Skip Outro */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Auto Skip Outro</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically skip ending themes (when available)
                    </p>
                  </div>
                  <button
                    onClick={() => handleSavePreference("autoSkipOutro", !preferences.autoSkipOutro)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      preferences.autoSkipOutro ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        preferences.autoSkipOutro ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Hide Adult Content */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Hide Adult Content</p>
                    <p className="text-sm text-muted-foreground">
                      Filter out mature and NSFW anime from browsing
                    </p>
                  </div>
                  <button
                    onClick={() => handleSavePreference("hideAdultContent", !("hideAdultContent" in preferences && (preferences as unknown as Record<string, unknown>).hideAdultContent as boolean))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      "hideAdultContent" in preferences && (preferences as unknown as Record<string, unknown>).hideAdultContent ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        "hideAdultContent" in preferences && (preferences as unknown as Record<string, unknown>).hideAdultContent ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Show Filler Episodes */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <div>
                    <p className="font-medium">Show Filler Episodes</p>
                    <p className="text-sm text-muted-foreground">
                      Display filler episodes in episode lists
                    </p>
                  </div>
                  <button
                    onClick={() => handleSavePreference("showFillerEpisodes", !("showFillerEpisodes" in preferences ? false : (preferences as unknown as Record<string, unknown>).showFillerEpisodes as boolean))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      !("showFillerEpisodes" in preferences) || (preferences as unknown as Record<string, unknown>).showFillerEpisodes ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        !("showFillerEpisodes" in preferences) || (preferences as unknown as Record<string, unknown>).showFillerEpisodes ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Streaming Method */}
                <div className="py-3">
                  <div className="mb-3">
                    <p className="font-medium">Streaming Method</p>
                    <p className="text-sm text-muted-foreground">
                      Choose how you want to stream videos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { value: "hybrid", label: "Hybrid (Recommended)" },
                      { value: "webtorrent", label: "P2P Only" },
                      { value: "direct", label: "Direct Only" },
                    ].map((method) => (
                      <button
                        key={method.value}
                        onClick={() => handleSavePreference("streamingMethod", method.value)}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg border transition-colors text-sm",
                          preferences.streamingMethod === method.value
                            ? "bg-primary border-primary"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Appearance */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-primary" />
                Appearance
              </h2>

              <div className="space-y-4">
                <div className="py-3 border-b border-white/10">
                  <p className="text-sm text-muted-foreground mb-3">
                    Theme
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
                        theme === "dark" || (theme === "system" && resolvedTheme === "dark")
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      )}
                    >
                      <Moon className="w-4 h-4" />
                      Dark
                      {(theme === "dark" || (theme === "system" && resolvedTheme === "dark")) && (
                        <Check className="w-4 h-4 ml-1" />
                      )}
                    </button>
                    <button
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
                        theme === "light" || (theme === "system" && resolvedTheme === "light")
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      )}
                    >
                      <Sun className="w-4 h-4" />
                      Light
                      {(theme === "light" || (theme === "system" && resolvedTheme === "light")) && (
                        <Check className="w-4 h-4 ml-1" />
                      )}
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
                        theme === "system"
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      )}
                    >
                      <Monitor className="w-4 h-4" />
                      System
                      {theme === "system" && <Check className="w-4 h-4 ml-1" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Currently using {resolvedTheme} theme.
                    {theme === "system" && " Matches your system preference."}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* AniList Integration */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                AniList Integration
              </h2>

              {isAuthenticated && anilistUser ? (
                <div className="space-y-4">
                  {/* User Profile */}
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
                    {anilistUser.avatar && (
                      <img
                        src={anilistUser.avatar.large || anilistUser.avatar.medium}
                        alt={anilistUser.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{anilistUser.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Connected to AniList
                      </p>
                    </div>
                    <button
                      onClick={handleAniListLogout}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>

                  {/* Sync Options */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => fetchAniListData(anilistToken || "")}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sync Now
                    </button>
                    <button
                      onClick={handleAniListLogout}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Your favorites and watchlist sync with AniList automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium mb-1">Connect to AniList</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sync your anime list, favorites, and watch history with AniList
                    </p>
                    <button
                      onClick={handleAniListLogin}
                      className="w-full px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      Login with AniList
                    </button>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <LinkIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-400 mb-1">What is AniList?</p>
                      <p className="text-muted-foreground">
                        AniList is a platform to track anime, manga, and discover new series.
                        Connecting allows you to sync your progress between AnimeVerse and AniList.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Notifications */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notifications
              </h2>
              <NotificationSettings />
            </GlassCard>

            {/* Data & Privacy */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Data & Privacy
              </h2>

              <div className="space-y-3">
                <button
                  onClick={exportData}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <Download className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Export My Data</p>
                    <p className="text-xs text-muted-foreground">
                      Download your watchlist, favorites, and settings
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleClearHistory}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <Trash2 className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Clear Watch History</p>
                    <p className="text-xs text-muted-foreground">
                      Remove all watch progress data
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleClearCache}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <RefreshCw className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Clear Cache</p>
                    <p className="text-xs text-muted-foreground">
                      Clear all cached data
                    </p>
                  </div>
                </button>

                <div className="pt-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      clearList();
                      clearFavorites();
                      toast.success("All data cleared");
                    }}
                    className="w-full px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                  >
                    Reset All Data
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Stats */}
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Your Stats</h2>
                <button
                  onClick={calculateAndSetStats}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>

              {/* Primary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="text-center p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
                  <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-primary">{formatWatchTime(userStats.totalMinutesWatched)}</p>
                  <p className="text-xs text-muted-foreground">Watch Time</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg">
                  <Play className="w-5 h-5 text-secondary mx-auto mb-1" />
                  <p className="text-xl font-bold text-secondary">{userStats.totalEpisodesWatched}</p>
                  <p className="text-xs text-muted-foreground">Episodes</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-lg">
                  <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-orange-500">{userStats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-lg">
                  <Award className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-purple-500">{userStats.uniqueAnimeWatched}</p>
                  <p className="text-xs text-muted-foreground">Anime Watched</p>
                </div>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Watch Breakdown</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Favorites</span>
                      <span className="font-medium">{favorites.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Watchlist</span>
                      <span className="font-medium">{watchlist.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">History Items</span>
                      <span className="font-medium">{historyCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hours Watched</span>
                      <span className="font-medium">{userStats.totalHoursWatched}h</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Achievements</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Longest Streak</span>
                      <span className="font-medium">{userStats.longestStreak} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium">{userStats.completedAnime} anime</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Time</span>
                      <span className="font-medium">{userStats.totalDaysWatched} days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Genres */}
              {userStats.topGenres.length > 0 && (
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium">Top Genres</span>
                    <span className="text-xs text-muted-foreground">(based on your watch history)</span>
                  </div>
                  <div className="space-y-2">
                    {userStats.topGenres.map((genre, index) => {
                      const maxCount = userStats.topGenres[0]?.count || 1;
                      const percentage = (genre.count / maxCount) * 100;
                      return (
                        <div key={genre.genre} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-6 text-center">#{index + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{genre.genre}</span>
                              <span className="text-muted-foreground">{genre.count}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full bg-gradient-to-r",
                                  getGenreColor(genre.genre)
                                )}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Reset Button */}
            <button
              onClick={handleResetAll}
              className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Reset All Settings to Default
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
