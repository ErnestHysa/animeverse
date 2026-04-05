/**
 * Settings Page
 * User preferences for video quality, autoplay, subtitles, theme, streaming method
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import { SubtitleSettings } from "@/components/settings/subtitle-settings";
import { StreamingSettings } from "@/components/settings/streaming-settings";
import {
  calculateStats,
  formatWatchTime,
  getGenreColor,
  saveStats,
  type UserStats,
} from "@/lib/stats";
import { useStore } from "@/store";
import { Clock, Flame, TrendingUp, BarChart3, Award, Keyboard } from "lucide-react";
import { DEFAULT_SHORTCUTS } from "@/lib/keyboard-shortcuts";

export default function SettingsPage() {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { watchlist, clearWatchlist: clearList } = useWatchlist();
  const { favorites, clearFavorites } = useFavorites();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { mediaCache, watchHistory, clearWatchHistory } = useStore();
  const {
    anilistUser,
    anilistToken,
    anilistMediaList,
    isAuthenticated,
    setAniListAuth,
    clearAniListAuth,
    syncAniListData,
    migrateAniListData,
  } = useAniListAuth();

  // MAL auth state
  const malToken = useStore((s) => s.malToken);
  const malUser = useStore((s) => s.malUser);
  const setMALAuth = useStore((s) => s.setMALAuth);
  const clearMALAuth = useStore((s) => s.clearMALAuth);
  const [isSyncingMAL, setIsSyncingMAL] = useState(false);

  // AniList auth state
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [clientId] = useState(process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID ?? "");
  const [isSyncing, setIsSyncing] = useState(false);
  const [anilistFilter, setAnilistFilter] = useState<'all' | 'watching' | 'completed' | 'planning' | 'paused' | 'dropped'>('all');

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

  // Fetch user's AniList data and sync with local state
  const fetchAniListData = useCallback(async (token: string) => {
    if (!token) {
      toast.error("No access token available. Please login again.");
      return;
    }

    if (!anilistUser?.id) {
      toast.error("User data not available. Please login again.");
      return;
    }

    setIsSyncing(true);
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
            query ($userId: Int) {
              MediaListCollection(userId: $userId, type: ANIME) {
                lists {
                  entries {
                    mediaId
                    status
                    progress
                    score
                    startedAt { year month day }
                    completedAt { year month day }
                    media {
                      id
                      idMal
                      title { romaji english }
                      coverImage { large extraLarge }
                      status
                      episodes
                      genres
                      averageScore
                      format
                      duration
                      description
                      studios { nodes { name } }
                    }
                  }
                }
              }
            }
          `,
          variables: {
            userId: anilistUser.id,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const lists = result.data?.MediaListCollection?.lists || [];
        // Flatten the lists to get all entries
        const allEntries = lists.flatMap((list: { entries: unknown[] }) => list.entries || []);

        // First sync the AniList data (synchronous Zustand set)
        syncAniListData(allEntries);

        // Zustand set() is synchronous — read the updated state immediately
        const currentState = useStore.getState().anilistMediaList;
        migrateAniListData(currentState);
        calculateAndSetStats();
        toast.success(`Synced ${allEntries.length} anime from AniList! Data migrated successfully.`);
      } else {
        const errorText = await response.text();
        console.error("AniList API error:", errorText);
        toast.error("Failed to sync AniList data. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching AniList data:", error);
      toast.error("Failed to sync AniList data. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [anilistUser?.id, syncAniListData, migrateAniListData, calculateAndSetStats]);

  // Handle OAuth callback from URL hash
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get("auth");

    if (authStatus === "success") {
      // Check URL hash for auth data (passed by callback route)
      let tokenFromHash = null;
      let userFromHash = null;

      try {
        const hashData = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
        if (hashData.token && hashData.user) {
          tokenFromHash = hashData.token;
          userFromHash = hashData.user;
          // Store in Zustand
          setAniListAuth(hashData.user, hashData.token);
          toast.success(`Welcome back, ${hashData.user.name}!`);
          fetchAniListData(hashData.token);
        }
      } catch (e) {
        // Hash parse failed, try Zustand state
      }

      // Clean URL hash
      window.history.replaceState({}, "", "/settings");

      // If no hash data, check Zustand state
      if (!tokenFromHash) {
        setTimeout(() => {
          if (isAuthenticated && anilistUser) {
            toast.success(`Welcome back, ${anilistUser.name}!`);
            if (anilistToken) {
              fetchAniListData(anilistToken);
            }
          } else {
            // Fallback: try to get from localStorage directly
            try {
              const zustandData = localStorage.getItem("animeverse-stream-storage");
              if (zustandData) {
                const parsed = JSON.parse(zustandData);
                if (parsed.state?.anilistUser && parsed.state?.anilistToken) {
                  setAniListAuth(parsed.state.anilistUser, parsed.state.anilistToken);
                  toast.success(`Welcome back, ${parsed.state.anilistUser.name}!`);
                  fetchAniListData(parsed.state.anilistToken);
                }
              }
            } catch (e) {
              console.error("Error parsing Zustand state:", e);
            }
          }
        }, 100);
      }

      // Clean URL
      window.history.replaceState({}, "", "/settings");
    } else if (authStatus === "error") {
      const message = params.get("message");
      const debug = params.get("debug");

      let errorDetails = message || "Unknown error";

      // Provide helpful error messages
      if (message === "redirect_uri_mismatch" || message?.includes("redirect")) {
        const expectedRedirectUri = `${window.location.origin}/auth/anilist/callback`;
        errorDetails = "Redirect URL mismatch. Make sure your AniList app has this exact redirect URL:\n\n" + (debug || expectedRedirectUri);
      } else if (message === "token_exchange_failed") {
        errorDetails = "Failed to exchange authorization code for token. Please try again.";
      } else if (message === "no_code") {
        errorDetails = "No authorization code received. Please try the login flow again.";
      }

      toast.error(`Authentication failed: ${errorDetails}`, { duration: 8000 });
      window.history.replaceState({}, "", "/settings");
    }

    // Handle MAL OAuth callback
    const malAuthStatus = params.get("mal_auth");
    if (malAuthStatus === "success") {
      try {
        const hashData = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
        if (hashData.token && hashData.user) {
          setMALAuth(hashData.user, hashData.token, hashData.refresh_token ?? "", hashData.expires_at ?? 0);
          toast.success(`MAL connected: ${hashData.user.name}!`);
        }
      } catch {
        // ignore hash parse error
      }
      window.history.replaceState({}, "", "/settings");
    } else if (malAuthStatus === "error") {
      const message = params.get("message");
      toast.error(`MAL connection failed: ${message || "unknown error"}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [isAuthenticated, anilistUser, anilistToken, setAniListAuth, fetchAniListData, setMALAuth]);

  // Login with AniList using Authorization Code Grant
  // This is the proper OAuth 2.0 flow with client_secret
  const handleAniListLogin = () => {
    if (!clientId) {
      toast.error("AniList OAuth is not configured. Set NEXT_PUBLIC_ANILIST_CLIENT_ID in your environment.", { duration: 8000 });
      return;
    }
    const redirectUri = `${window.location.origin}/auth/anilist/callback`;
    const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

    toast(`Redirecting to AniList...\n\nMake sure your AniList app has this redirect URL:\n${redirectUri}`, {
      duration: 5000,
      icon: '🔗',
    });

    // Small delay to allow toast to show
    setTimeout(() => {
      window.location.href = authUrl;
    }, 100);
  };

  // Handle manual token submission (fallback)
  const handleTokenSubmit = async () => {
    if (!accessToken.trim()) {
      toast.error('Please enter your access token');
      return;
    }

    try {
      // Verify token by fetching user data
      const userResponse = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              Viewer {
                id
                name
                avatar { large medium }
                options { displayAdultContent }
                mediaListOptions { scoreFormat rowOrder }
              }
            }
          `,
        }),
      });

      if (!userResponse.ok) {
        throw new Error('Invalid access token');
      }

      const userResult = await userResponse.json();
      const userData = userResult.data?.Viewer;

      if (!userData) {
        throw new Error('Failed to fetch user data');
      }

      setAniListAuth(userData, accessToken.trim());
      toast.success(`Welcome back, ${userData.name}!`);
      setShowTokenInput(false);
      setAccessToken('');

      // Fetch and sync AniList data
      fetchAniListData(accessToken.trim());
    } catch (error) {
      console.error('Token verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to authenticate: ${errorMessage}`);
    }
  };

  // Logout from AniList
  const handleAniListLogout = () => {
    clearAniListAuth();
    toast.success("Logged out from AniList");
  };

  // Connect to MAL
  const handleMALLogin = () => {
    window.location.href = "/auth/mal";
  };

  // Disconnect from MAL
  const handleMALLogout = () => {
    clearMALAuth();
    toast.success("Disconnected from MyAnimeList");
  };

  // Sync watch history to MAL
  const handleSyncToMAL = async () => {
    if (!malToken) return;
    setIsSyncingMAL(true);
    try {
      const { updateMALEntry, anilistStatusToMAL } = await import("@/lib/mal-api");
      // Sync from AniList media list (which has MAL IDs)
      const entries = useStore.getState().anilistMediaList.filter((e) => e.media?.idMal);
      let synced = 0;
      for (const entry of entries) {
        if (!entry.media?.idMal) continue;
        try {
          await updateMALEntry(
            malToken,
            entry.media.idMal,
            anilistStatusToMAL(entry.status),
            entry.progress,
            entry.score
          );
          synced++;
        } catch {
          // skip individual failures
        }
      }
      toast.success(`Synced ${synced} entries to MAL`);
    } catch (err) {
      toast.error("MAL sync failed");
    } finally {
      setIsSyncingMAL(false);
    }
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
                    onClick={() => handleSavePreference("hideAdultContent", !preferences.hideAdultContent)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      preferences.hideAdultContent ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        preferences.hideAdultContent ? "translate-x-6" : ""
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
                    onClick={() => handleSavePreference("showFillerEpisodes", !preferences.showFillerEpisodes)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      preferences.showFillerEpisodes ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                        preferences.showFillerEpisodes ? "translate-x-6" : ""
                      )}
                    />
                  </button>
                </div>

                {/* Streaming Method */}
                <div className="py-3">
                  <div className="mb-3">
                    <p className="font-medium">Streaming Method</p>
                    <p className="text-sm text-muted-foreground">
                      Choose how video sources are loaded. See Streaming Settings below for more details.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { value: "direct", label: "HLS (Direct)", available: true },
                      { value: "hybrid", label: "Hybrid", available: true },
                      { value: "webtorrent", label: "P2P/Torrent", available: true },
                    ].map((method) => (
                      <button
                        key={method.value}
                        onClick={() => method.available && handleSavePreference("streamingMethod", method.value)}
                        disabled={!method.available}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg border transition-colors text-sm",
                          !method.available && "opacity-40 cursor-not-allowed",
                          method.available && preferences.streamingMethod === method.value
                            ? "bg-primary border-primary"
                            : method.available
                            ? "bg-white/5 border-white/10 hover:bg-white/10"
                            : "bg-white/5 border-white/10"
                        )}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Subtitle Settings */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Subtitle Appearance
              </h2>
              <SubtitleSettings />
            </GlassCard>

            {/* Streaming Settings */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Streaming Method
              </h2>
              <StreamingSettings />
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
                      onClick={() => anilistToken && fetchAniListData(anilistToken)}
                      disabled={!anilistToken || isSyncing}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
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

                  {/* AniList Media List */}
                  {anilistMediaList.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Your AniList ({anilistMediaList.length})</h3>
                        <select
                          value={anilistFilter}
                          onChange={(e) => setAnilistFilter(e.target.value as 'all' | 'watching' | 'completed' | 'planning' | 'paused' | 'dropped')}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="all">All</option>
                          <option value="watching">Watching</option>
                          <option value="completed">Completed</option>
                          <option value="planning">Plan to Watch</option>
                          <option value="paused">Paused</option>
                          <option value="dropped">Dropped</option>
                        </select>
                      </div>
                      <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                        {anilistMediaList
                          .filter((entry) => {
                            if (anilistFilter === 'all') return true;
                            if (anilistFilter === 'watching') return entry.status === 'CURRENT';
                            if (anilistFilter === 'completed') return entry.status === 'COMPLETED';
                            if (anilistFilter === 'planning') return entry.status === 'PLANNING';
                            if (anilistFilter === 'paused') return entry.status === 'PAUSED';
                            if (anilistFilter === 'dropped') return entry.status === 'DROPPED';
                            return true;
                          })
                          .slice(0, 20)
                          .map((entry) => (
                            <Link
                              key={entry.mediaId}
                              href={`/anime/${entry.mediaId}`}
                              className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              {entry.media?.coverImage?.large && (
                                <img
                                  src={entry.media.coverImage.large}
                                  alt={entry.media.title?.romaji || ''}
                                  className="w-12 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">
                                  {entry.media?.title?.romaji || entry.media?.title?.english || `Anime ${entry.mediaId}`}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    entry.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                    entry.status === 'CURRENT' ? 'bg-blue-500/20 text-blue-400' :
                                    entry.status === 'PLANNING' ? 'bg-purple-500/20 text-purple-400' :
                                    entry.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-400' :
                                    entry.status === 'DROPPED' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {entry.status === 'CURRENT' ? 'Watching' :
                                     entry.status === 'COMPLETED' ? 'Completed' :
                                     entry.status === 'PLANNING' ? 'Plan to Watch' :
                                     entry.status === 'PAUSED' ? 'Paused' :
                                     entry.status === 'DROPPED' ? 'Dropped' : entry.status}
                                  </span>
                                  {entry.progress > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      Ep {entry.progress}/{entry.media?.episodes || '?'}
                                    </span>
                                  )}
                                  {entry.score > 0 && (
                                    <span className="text-xs text-yellow-400">
                                      ★ {entry.score}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))}
                        {anilistMediaList.filter((entry) => {
                          if (anilistFilter === 'all') return true;
                          if (anilistFilter === 'watching') return entry.status === 'CURRENT';
                          if (anilistFilter === 'completed') return entry.status === 'COMPLETED';
                          if (anilistFilter === 'planning') return entry.status === 'PLANNING';
                          if (anilistFilter === 'paused') return entry.status === 'PAUSED';
                          if (anilistFilter === 'dropped') return entry.status === 'DROPPED';
                          return true;
                        }).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No anime in this category</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium mb-1">Connect to AniList</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sync your anime list, favorites, and watch history with AniList
                    </p>

                    {!showTokenInput ? (
                      <div className="space-y-4">
                        {/* Configuration Help */}
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-left">
                          <p className="text-xs font-medium text-yellow-400 mb-2">⚠️ Required Configuration</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Make sure your AniList app has this exact <strong>Redirect URL</strong>:
                          </p>
                          <code className="block w-full px-2 py-1.5 bg-black/30 rounded text-xs font-mono text-green-400 break-all">
                            {typeof window !== 'undefined' ? `${window.location.origin}/auth/anilist/callback` : 'http://localhost:3000/auth/anilist/callback'}
                          </code>
                          <a
                            href="https://anilist.co/settings/developer"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-2 inline-block"
                          >
                            Open AniList Developer Settings →
                          </a>
                        </div>

                        <button
                          onClick={handleAniListLogin}
                          className="w-full px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <LogIn className="w-4 h-4" />
                          Login with AniList
                        </button>
                        <p className="text-xs text-muted-foreground">
                          You&apos;ll be redirected to AniList to authorize
                        </p>
                        <button
                          onClick={() => setShowTokenInput(true)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Or enter access token manually
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 text-left">
                        <p className="text-sm text-muted-foreground">
                          <strong className="text-white">Manual Token Entry:</strong><br />
                          Paste your AniList access token below. You can get one from the
                          <a href="https://anilist.co/settings/developer" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mx-1">AniList Developer Settings</a>
                        </p>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Access Token:</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={accessToken}
                              onChange={(e) => setAccessToken(e.target.value)}
                              placeholder="Paste your AniList access token"
                              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono text-xs"
                            />
                            <button
                              onClick={handleTokenSubmit}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                            >
                              Connect
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowTokenInput(false);
                            setAccessToken('');
                          }}
                          className="text-sm text-muted-foreground hover:text-foreground underline"
                        >
                          Back to OAuth Login
                        </button>
                      </div>
                    )}
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

            {/* MyAnimeList Integration */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-blue-400" />
                MyAnimeList Integration
              </h2>

              {malToken && malUser ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
                    {malUser.picture && (
                      <img
                        src={malUser.picture}
                        alt={malUser.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{malUser.name}</p>
                      <p className="text-sm text-muted-foreground">Connected to MyAnimeList</p>
                    </div>
                    <button
                      onClick={handleMALLogout}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSyncToMAL}
                      disabled={isSyncingMAL}
                      className="px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-2 transition-colors text-sm text-blue-400"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingMAL ? "animate-spin" : ""}`} />
                      {isSyncingMAL ? "Syncing..." : "Push to MAL"}
                    </button>
                    <button
                      onClick={handleMALLogout}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Push your AniList watch progress to MAL with one click. Progress syncs bidirectionally as you watch.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium mb-1">Connect to MyAnimeList</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Keep your MAL list in sync automatically as you watch
                    </p>
                    <button
                      onClick={handleMALLogin}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      Login with MyAnimeList
                    </button>
                    <p className="text-xs text-muted-foreground mt-3">
                      Requires{" "}
                      <code className="text-xs bg-white/10 px-1 py-0.5 rounded">NEXT_PUBLIC_MAL_CLIENT_ID</code>{" "}
                      to be configured
                    </p>
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

            {/* Keyboard Shortcuts Reference */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Keyboard className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Use these shortcuts anywhere in the app. Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono">?</kbd> to show this panel.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(DEFAULT_SHORTCUTS).map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono ml-3 flex-shrink-0">
                      {shortcut.key.toUpperCase()}
                    </kbd>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-sm">Play / Pause</span>
                  <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono ml-3 flex-shrink-0">Space</kbd>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-sm">Seek ±10 seconds</span>
                  <div className="flex gap-1 ml-3 flex-shrink-0">
                    <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono">←</kbd>
                    <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono">→</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-sm">Volume</span>
                  <div className="flex gap-1 ml-3 flex-shrink-0">
                    <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono">↑</kbd>
                    <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono">↓</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-sm">Fullscreen</span>
                  <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono ml-3 flex-shrink-0">F</kbd>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-sm">Mute / Unmute</span>
                  <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono ml-3 flex-shrink-0">M</kbd>
                </div>
              </div>
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
