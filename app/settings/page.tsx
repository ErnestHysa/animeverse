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
import { usePreferences, useWatchlist, useFavorites } from "@/store";
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
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { NotificationSettings } from "@/components/notifications/notification-settings";

export default function SettingsPage() {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { watchlist, clearWatchlist: clearList } = useWatchlist();
  const { favorites, clearFavorites } = useFavorites();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [historyCount, setHistoryCount] = useState(() => {
    // Initialize with 0 on server, actual count on client
    if (typeof window !== "undefined") {
      const history = JSON.parse(localStorage.getItem("yggdrasil_watch_history") || "[]");
      return history.length;
    }
    return 0;
  });

  useEffect(() => {
    // Re-sync history count when localStorage changes (e.g., after clearing)
    const handleStorageChange = () => {
      const history = JSON.parse(localStorage.getItem("yggdrasil_watch_history") || "[]");
      setHistoryCount(history.length);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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
    if (typeof window !== "undefined") {
      localStorage.removeItem("yggdrasil_watch_history");
      setHistoryCount(0);
      toast.success("Watch history cleared");
    }
  };

  const handleClearCache = async () => {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      toast.success("Cache cleared");
    }
  };

  const exportData = () => {
    const watchHistory = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("yggdrasil_watch_history") || "[]")
      : [];

    const data = {
      preferences,
      watchlist,
      favorites,
      watchHistory,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anime-stream-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
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
              <h2 className="text-xl font-semibold mb-4">Your Stats</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{favorites.length}</p>
                  <p className="text-xs text-muted-foreground">Favorites</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-secondary">{watchlist.length}</p>
                  <p className="text-xs text-muted-foreground">Watchlist</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold">{historyCount}</p>
                  <p className="text-xs text-muted-foreground">History</p>
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
