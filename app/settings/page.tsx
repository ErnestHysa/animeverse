/**
 * Settings Page
 * User preferences for video quality, autoplay, subtitles, theme, streaming method
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { usePreferences, useWatchlist, useFavorites, useAniListAuth, type AniListUser } from "@/store";
import { useTheme } from "@/components/providers/theme-provider";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger('settings');
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
import { PerformanceSettings } from "@/components/settings/performance-settings";
import { SeedTrackingSettings } from "@/components/settings/seed-tracking-settings";
import { AnalyticsSettings } from "@/components/settings/analytics-settings";
import {
  calculateStats,
  formatWatchTime,
  getGenreColor,
  saveStats,
  type UserStats,
} from "@/lib/stats";
import { useStore, type AniListMediaEntry } from "@/store";
import { Clock, Flame, TrendingUp, BarChart3, Award, Keyboard } from "lucide-react";
import { DEFAULT_SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { safeGetItem, safeRemoveItem, getCookie } from "@/lib/storage";

// FIX 1: Extracted reusable toggle setting component
function ToggleSetting({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10">
      <div>
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-12 h-6 rounded-full transition-colors relative",
          checked ? "bg-primary" : "bg-white/10"
        )}
      >
        <div
          className={cn(
            "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : ""
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { watchlist, clearWatchlist: clearList } = useWatchlist();
  const { favorites, clearFavorites } = useFavorites();
  const { theme, setTheme, resolvedTheme } = useTheme();
  // FIX 2: Use specific selectors instead of bare useStore()
  const mediaCache = useStore((s) => s.mediaCache);
  const watchHistory = useStore((s) => s.watchHistory);
  const clearWatchHistory = useStore((s) => s.clearWatchHistory);
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

  // FIX H2: Track AniList connection status from server-side cookie
  const [anilistConnected, setAnilistConnected] = useState(false);

  // FIX 4: State-based confirmation dialog instead of window.confirm
  const [pendingConfirm, setPendingConfirm] = useState<null | (() => void)>(null);

  // FIX: OAuth callback ref guard to prevent re-processing
  const oauthProcessedRef = useRef(false);

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

  // FIX H2: On mount, check if AniList token exists in httpOnly cookie via API
  // This restores connection status after page refresh when Zustand store is empty
  useEffect(() => {
    fetch('/api/anilist/status')
      .then(r => r.json())
      .then(data => {
        if (data.connected) {
          setAnilistConnected(true);
          // Restore user data in Zustand from the server-provided user info
          if (data.user && data.user.id && data.user.name && !anilistUser) {
            setAniListAuth(data.user as AniListUser, "");
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSavePreference = async (key: string, value: unknown) => {
    updatePreferences({ [key]: value });
    toast.success("Settings saved");
  };

  const handleResetAll = async () => {
    setPendingConfirm(() => () => {
      resetPreferences();
      toast.success("Settings reset to default");
    });
  };

  const handleClearHistory = () => {
    clearWatchHistory();
    // Also clear the stats from localStorage (FIX 3: safe storage access)
    safeRemoveItem("animeverse_stats");
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
    // FIX 3: Use safe storage utility instead of direct localStorage access
    const statsResult = safeGetItem<object | null>("animeverse_stats");
    const statsData = statsResult.success ? statsResult.data ?? null : null;

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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Data exported");
  };

  // ===================================
  // AniList OAuth Handlers
  // ===================================

  // Fetch user's AniList data and sync with local state
  // Fix C3: Routes through server-side /api/anilist/sync to avoid exposing token client-side
  const fetchAniListData = useCallback(async (_token?: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/anilist/sync", { method: "POST" });

      if (response.ok) {
        const data = await response.json();
        const allEntries = data.entries || [];

        // First sync the AniList data (synchronous Zustand set)
        syncAniListData(allEntries);

        // Zustand set() is synchronous — read the updated state immediately
        const currentState = useStore.getState().anilistMediaList;
        migrateAniListData(currentState);
        calculateAndSetStats();
        toast.success(`Synced ${allEntries.length} anime from AniList! Data migrated successfully.`);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Sync failed" }));
        logger.error("AniList sync error:", errorData);
        toast.error("Failed to sync AniList data. Please try again.");
      }
    } catch (error) {
      logger.error("Error fetching AniList data:", error);
      toast.error("Failed to sync AniList data. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [syncAniListData, migrateAniListData, calculateAndSetStats]);

  // FIX H2: Server-side AniList sync using httpOnly cookie token
  // Falls back to client-side sync if server route is unavailable
  const handleServerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/anilist/sync', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Sync failed' }));
        throw new Error(errorData.error || 'Sync failed');
      }
      const data = await response.json();
      const allEntries = data.entries || [];

      // Sync the AniList data (synchronous Zustand set)
      syncAniListData(allEntries);

      // Read updated state and migrate
      const currentState = useStore.getState().anilistMediaList;
      migrateAniListData(currentState);
      calculateAndSetStats();
      toast.success(`Synced ${allEntries.length} anime from AniList! Data migrated successfully.`);
    } catch (error) {
      logger.error('AniList server sync error:', error);
      toast.error('Failed to sync AniList data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [syncAniListData, migrateAniListData, calculateAndSetStats]);

  // Handle OAuth callback from URL hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (oauthProcessedRef.current) return;
    oauthProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get("auth");

    if (authStatus === "success") {
      // Fix L5/H13: AniList tokens are now in httpOnly cookies, not URL hash.
      // Read display user data from anilist_user_display cookie for UI purposes.
      let tokenFromHash = null;
      let userFromHash = null;

      // Try to read display data from the non-httpOnly cookie
      try {
        // Fix L2: Use secure getCookie helper from lib/storage instead of inline regex
        const displayCookie = getCookie("anilist_user_display");
        if (displayCookie) {
          const displayData = JSON.parse(displayCookie);
          if (displayData && displayData.id && displayData.name) {
            userFromHash = displayData;
            // Note: token is only in httpOnly cookie, not accessible from client
            // Store display user data in Zustand for UI
            setAniListAuth(displayData as AniListUser, "");
            setAnilistConnected(true); // FIX H2: Mark connected when OAuth succeeds
            tokenFromHash = "cookie-based"; // flag that we got data from cookies
            toast.success(`Welcome back, ${displayData.name}!`);
          }
        }
      } catch (error) {
        console.error('Failed to parse user data from cookie:', error);
      }

      // Clean URL
      window.history.replaceState({}, "", "/settings");

      // If no cookie data, check Zustand state (for existing sessions)
      if (!tokenFromHash) {
        setTimeout(() => {
          if (isAuthenticated && anilistUser) {
            toast.success(`Welcome back, ${anilistUser.name}!`);
          }
          // Note: We no longer read tokens from localStorage — they are in httpOnly cookies
        }, 100);
      }

      // Clean URL (duplicate guard)
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
      // Fix C3: MAL tokens are now in httpOnly cookies, not URL hash.
      // Read display user data from mal_user cookie for UI purposes only.
      try {
        // Fix L2: Use secure getCookie helper from lib/storage instead of inline regex
        const malUserCookie = getCookie("mal_user");
        if (malUserCookie) {
          const malUserData = JSON.parse(malUserCookie);
          if (malUserData && malUserData.name) {
            // Store display-only user data in Zustand (no tokens — those are in httpOnly cookies)
            setMALAuth(malUserData, "", "", 0);
            toast.success(`MAL connected: ${malUserData.name}!`);
          }
        } else {
          toast.success("MAL connected successfully!");
        }
      } catch (error) {
        console.error('Failed to parse MAL user data from cookie:', error);
        toast.success("MAL connected successfully!");
      }
      window.history.replaceState({}, "", "/settings");
    } else if (malAuthStatus === "error") {
      const message = params.get("message");
      toast.error(`MAL connection failed: ${message || "unknown error"}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [isAuthenticated, anilistUser, anilistToken, setAniListAuth, fetchAniListData, setMALAuth]);

  // Login with AniList via server-side initiation route
  // Fix H8: The server route generates a CSRF state parameter and stores it in a cookie
  // before redirecting to AniList, which the callback validates.
  const handleAniListLogin = () => {
    toast('Redirecting to AniList...', {
      duration: 3000,
      icon: '🔗',
    });

    // Small delay to allow toast to show
    setTimeout(() => {
      window.location.href = '/auth/anilist';
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
      setAnilistConnected(true); // FIX H2: Mark connected when manual token works
      toast.success(`Welcome back, ${userData.name}!`);
      setShowTokenInput(false);
      setAccessToken('');

      // Fetch and sync AniList data
      fetchAniListData(accessToken.trim());
    } catch (error) {
      logger.error('Token verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to authenticate: ${errorMessage}`);
    }
  };

  // Logout from AniList
  const handleAniListLogout = async () => {
    try {
      await fetch('/api/anilist/status', { method: 'DELETE' });
    } catch {
      // Cookie clearing best-effort
    }
    clearAniListAuth();
    setAnilistConnected(false); // FIX H2: Clear connection state on logout
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

  // FIX 6: Sync watch history to MAL with batched concurrency (5 at a time)
  const handleSyncToMAL = async () => {
    if (!malToken) return;
    setIsSyncingMAL(true);
    try {
      const { updateMALEntry, anilistStatusToMAL } = await import("@/lib/mal-api");
      // Sync from AniList media list (which has MAL IDs)
      const entries = useStore.getState().anilistMediaList.filter((e) => e.media?.idMal);
      let synced = 0;
      // Process in chunks of 5 for parallel execution
      const CHUNK_SIZE = 5;
      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map((entry) => {
            if (!entry.media?.idMal) return Promise.resolve();
            return updateMALEntry(
              malToken,
              entry.media.idMal,
              anilistStatusToMAL(entry.status),
              entry.progress,
              entry.score
            );
          })
        );
        // Count successful syncs from this chunk
        results.forEach((r) => {
          if (r.status === 'fulfilled') synced++;
        });
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
      {/* FIX 5: Error boundary wrapper */}
      <ErrorBoundary>
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
                <ToggleSetting
                  label="Autoplay"
                  description="Automatically play videos when loaded"
                  checked={preferences.autoplay}
                  onChange={(val) => handleSavePreference("autoplay", val)}
                />

                {/* Auto Next Episode */}
                <ToggleSetting
                  label="Auto-play Next Episode"
                  description="Automatically play the next episode when current ends"
                  checked={preferences.autoNext}
                  onChange={(val) => handleSavePreference("autoNext", val)}
                />

                {/* Auto Skip Intro */}
                <ToggleSetting
                  label="Auto Skip Intro"
                  description="Automatically skip opening themes (when available)"
                  checked={preferences.autoSkipIntro}
                  onChange={(val) => handleSavePreference("autoSkipIntro", val)}
                />

                {/* Auto Skip Outro */}
                <ToggleSetting
                  label="Auto Skip Outro"
                  description="Automatically skip ending themes (when available)"
                  checked={preferences.autoSkipOutro}
                  onChange={(val) => handleSavePreference("autoSkipOutro", val)}
                />

                {/* Hide Adult Content */}
                <ToggleSetting
                  label="Hide Adult Content"
                  description="Filter out mature and NSFW anime from browsing"
                  checked={preferences.hideAdultContent}
                  onChange={(val) => handleSavePreference("hideAdultContent", val)}
                />

                {/* Show Filler Episodes */}
                <ToggleSetting
                  label="Show Filler Episodes"
                  description="Display filler episodes in episode lists"
                  checked={preferences.showFillerEpisodes}
                  onChange={(val) => handleSavePreference("showFillerEpisodes", val)}
                />

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

            {/* Performance Settings (Phase 6) */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Performance & Optimization
              </h2>
              <PerformanceSettings />
            </GlassCard>

            {/* Seed Tracking Settings (Phase 7) */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Seed Statistics & Achievements
              </h2>
              <SeedTrackingSettings />
            </GlassCard>

            {/* Analytics & Diagnostics */}
            <GlassCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Analytics & Diagnostics
              </h2>
              <AnalyticsSettings />
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
                      <Image
                        src={anilistUser.avatar.large || anilistUser.avatar.medium}
                        alt={anilistUser.name}
                        width={64}
                        height={64}
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
                      onClick={handleServerSync}
                      disabled={!anilistConnected || isSyncing}
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
      </ErrorBoundary>
      <Footer />
      {/* FIX 4: Confirmation dialog replacing window.confirm */}
      <Dialog
        isOpen={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        title="Confirm Action"
        size="sm"
      >
        <p className="text-muted-foreground mb-6">Are you sure you want to reset all settings? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setPendingConfirm(null)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (pendingConfirm) {
                pendingConfirm();
                setPendingConfirm(null);
              }
            }}
            className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Confirm
          </button>
        </div>
      </Dialog>
    </>
  );
}
