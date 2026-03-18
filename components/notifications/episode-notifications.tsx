/**
 * Push Notifications for New Episodes
 * Browser notifications for airing anime
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Check, X, Settings } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { useWatchlist, useFavorites } from "@/store";
import type { Media } from "@/types/anilist";

// ===================================
// Types
// ===================================

interface NotificationPreference {
  mediaId: number;
  enabled: boolean;
  title: string;
  episodeOffset: number; // Notify when episode number > this
}

interface AiringAnime {
  mediaId: number;
  title: string;
  nextEpisode: number;
  airingAt: number;
}

// ===================================
// Notification Manager
// ===================================

const STORAGE_KEY = "animeverse-notifications";

class NotificationManager {
  private permission: NotificationPermission = "default";
  private prefs: Map<number, NotificationPreference> = new Map();
  private swRegistration: ServiceWorkerRegistration | null = null;

  async init() {
    // Request permission
    if ("Notification" in window) {
      this.permission = Notification.permission;
    }

    // Load preferences
    this.loadPreferences();

    // Get service worker registration
    if ("serviceWorker" in navigator) {
      this.swRegistration = await navigator.serviceWorker.getRegistration() ?? null;
    }

    return this.permission;
  }

  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return false;
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;

    if (permission === "granted") {
      toast.success("Notifications enabled!");
      // Subscribe to push notifications (would need VAPID keys in production)
      await this.subscribeToPush();
    } else {
      toast.error("Notifications blocked. Please enable in browser settings.");
    }

    return permission === "granted";
  }

  private async subscribeToPush() {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
      });
      // In production, send subscription to server
      console.log("Push subscription:", subscription);
    } catch (error) {
      console.log("Push not supported:", error);
    }
  }

  private loadPreferences() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const prefs: NotificationPreference[] = JSON.parse(stored);
      this.prefs = new Map(prefs.map((p) => [p.mediaId, p]));
    }
  }

  private savePreferences() {
    const prefs = Array.from(this.prefs.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }

  enableNotification(mediaId: number, title: string, currentEpisode: number = 0) {
    this.prefs.set(mediaId, {
      mediaId,
      enabled: true,
      title,
      episodeOffset: currentEpisode,
    });
    this.savePreferences();
  }

  disableNotification(mediaId: number) {
    this.prefs.delete(mediaId);
    this.savePreferences();
  }

  isEnabled(mediaId: number): boolean {
    return this.prefs.get(mediaId)?.enabled ?? false;
  }

  getPreferences(): NotificationPreference[] {
    return Array.from(this.prefs.values());
  }

  async sendNotification(title: string, body: string, url?: string) {
    if (this.permission !== "granted") return;

    // Check if service worker is active
    if (this.swRegistration && this.swRegistration.active) {
      // Use service worker for notification (works when tab is closed)
      await this.swRegistration.showNotification(title, {
        body,
        icon: "/manifest-icon-192.png",
        badge: "/manifest-icon-96.png",
        data: { url },
        tag: "anime-episode",
      });
    } else if ("Notification" in window) {
      // Fallback to regular notification
      new Notification(title, {
        body,
        icon: "/manifest-icon-192.png",
        badge: "/manifest-icon-96.png",
        data: { url },
      });
    }
  }
}

const notificationManager = new NotificationManager();

// ===================================
// Component
// ===================================

interface EpisodeNotificationsProps {
  airingSchedule?: AiringAnime[];
}

export function EpisodeNotifications({ airingSchedule = [] }: EpisodeNotificationsProps) {
  const { watchlist } = useWatchlist();
  const { favorites } = useFavorites();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [enabledCount, setEnabledCount] = useState(0);

  // Initialize notification manager
  useEffect(() => {
    async function init() {
      const perm = await notificationManager.init();
      setPermission(perm);

      // Load preferences and count enabled
      const allPrefs = notificationManager.getPreferences();
      setPrefs(allPrefs);
      setEnabledCount(allPrefs.filter((p) => p.enabled).length);
    }

    init();
  }, []);

  // Request permission
  const requestPermission = async () => {
    const granted = await notificationManager.requestPermission();
    setPermission(granted ? "granted" : "denied");
  };

  // Enable notifications for an anime
  const enableForAnime = useCallback((anime: Media, currentEpisode: number = 0) => {
    notificationManager.enableNotification(anime.id, anime.title.romaji || anime.title.english || "", currentEpisode);
    setPrefs(notificationManager.getPreferences());
    setEnabledCount((prev) => prev + 1);
    toast.success(`Notifications enabled for ${anime.title.romaji || anime.title.english}`);
  }, []);

  // Disable notifications for an anime
  const disableForAnime = useCallback((mediaId: number) => {
    notificationManager.disableNotification(mediaId);
    setPrefs(notificationManager.getPreferences());
    setEnabledCount((prev) => prev - 1);
  }, []);

  // Check for new episodes and send notifications
  useEffect(() => {
    if (permission !== "granted" || airingSchedule.length === 0) return;

    const checkInterval = setInterval(() => {
      airingSchedule.forEach((item) => {
        const pref = prefs.find((p) => p.mediaId === item.mediaId);
        if (pref?.enabled && item.nextEpisode > pref.episodeOffset) {
          // New episode detected!
          notificationManager.sendNotification(
            `${item.title} - Episode ${item.nextEpisode} is out!`,
            `Episode ${item.nextEpisode} of ${item.title} is now available.`,
            `/anime/${item.mediaId}`
          );

          // Update episode offset so we don't notify again
          notificationManager.enableNotification(item.mediaId, pref.title, item.nextEpisode);
          setPrefs(notificationManager.getPreferences());
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [permission, airingSchedule, prefs]);

  // Combine watchlist and favorites for notification settings
  const trackedAnime = [...new Set([...watchlist, ...favorites])];

  return (
    <div className="relative">
      {/* Notification Bell Icon */}
      <button
        onClick={() => {
          if (permission === "default") {
            requestPermission();
          } else {
            setShowSettings(!showSettings);
          }
        }}
        className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
        aria-label="Episode notifications"
      >
        {permission === "granted" && enabledCount > 0 ? (
          <>
            <Bell className="w-5 h-5 text-primary" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-xs flex items-center justify-center text-white font-medium">
              {enabledCount}
            </span>
          </>
        ) : permission === "granted" ? (
          <Bell className="w-5 h-5 text-muted-foreground" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Notification Settings Panel */}
      {showSettings && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  Episode Notifications
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {permission !== "granted" ? (
                <div className="text-center py-6">
                  <BellOff className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Enable notifications to get alerted when new episodes of your favorite anime air
                  </p>
                  <Button onClick={requestPermission} size="sm">
                    Enable Notifications
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select anime to receive notifications for new episodes
                  </p>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {trackedAnime.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        Add anime to your watchlist or favorites to enable notifications
                      </p>
                    ) : (
                      trackedAnime.map((animeId) => {
                        const anime = airingSchedule.find((a) => a.mediaId === animeId);
                        const isEnabled = notificationManager.isEnabled(animeId);

                        return (
                          <div
                            key={animeId}
                            className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                          >
                            <span className="text-sm truncate flex-1">
                              {anime?.title || `Anime ${animeId}`}
                            </span>
                            <button
                              onClick={() => {
                                if (isEnabled) {
                                  disableForAnime(animeId);
                                } else {
                                  // Would need full anime data here
                                  // For now, just toggle
                                  notificationManager.enableNotification(animeId, anime?.title || "", 0);
                                  setPrefs(notificationManager.getPreferences());
                                  setEnabledCount((prev) => prev + 1);
                                }
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                isEnabled
                                  ? "bg-primary text-white"
                                  : "bg-white/10 hover:bg-white/20"
                              }`}
                            >
                              {isEnabled ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Check airing schedule for watchlist/favorites
 */
export function useAiringSchedule() {
  const [schedule, setSchedule] = useState<AiringAnime[]>([]);

  useEffect(() => {
    // In production, fetch from API
    // For now, return empty
    setSchedule([]);
  }, []);

  return schedule;
}

/**
 * Notification permission wrapper component
 */
export function NotificationPermissionRequest() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (permission === "granted") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-auto md:w-96 z-50">
      <GlassCard className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Enable Notifications</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Get notified when new episodes of your favorite anime air
            </p>
            <div className="flex gap-2">
              <Button onClick={requestPermission} size="sm">
                Enable
              </Button>
              <Button
                onClick={() => setPermission("denied")}
                variant="outline"
                size="sm"
              >
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={() => setPermission("denied")}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
