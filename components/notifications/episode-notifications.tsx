/**
 * Push Notifications for New Episodes
 * Browser notifications for airing anime
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { useWatchlist, useFavorites } from "@/store";
import {
  getAnimeNotificationPreferences,
  setAnimeNotificationEnabled,
} from "@/lib/notifications";

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for production push notifications
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
      });
      // In production, send subscription to server
      // Push subscription created successfully
    } catch {
      // Push not supported or user declined - silently ignore
    }
  }

  private loadPreferences() {
    const prefs = getAnimeNotificationPreferences();
    this.prefs = new Map(prefs.map((p) => [p.mediaId, p]));
  }

  private savePreferences() {
    const prefs = Array.from(this.prefs.values());
    for (const pref of prefs) {
      setAnimeNotificationEnabled(pref.mediaId, pref.title, pref.enabled, pref.episodeOffset);
    }
  }

  enableNotification(mediaId: number, title: string, currentEpisode: number = 0) {
    const preference = {
      mediaId,
      enabled: true,
      title,
      episodeOffset: currentEpisode,
    };
    this.prefs.set(mediaId, preference);
    setAnimeNotificationEnabled(mediaId, title, true, currentEpisode);
  }

  disableNotification(mediaId: number) {
    this.prefs.delete(mediaId);
    setAnimeNotificationEnabled(mediaId, "", false);
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
  const [animeTitles, setAnimeTitles] = useState<Map<number, string>>(new Map());

  // Fetch anime titles for tracked anime
  useEffect(() => {
    async function fetchAnimeTitles() {
      const trackedAnime = [...new Set([...watchlist, ...favorites])];
      if (trackedAnime.length === 0) return;

      try {
        const { anilist } = await import("@/lib/anilist");
        const result = await anilist.getByIds(trackedAnime);

        if (result.data?.Page?.media) {
          const titleMap = new Map<number, string>();
          result.data.Page.media.forEach((media) => {
            const title = media.title?.userPreferred || media.title?.english || media.title?.romaji || "Unknown";
            titleMap.set(media.id, title);
          });
          setAnimeTitles(titleMap);
        }
      } catch {
        // Silently fail - titles will show as ID fallback
      }
    }

    fetchAnimeTitles();
  }, [watchlist, favorites]);

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

  // Disable notifications for an anime
  const disableForAnime = useCallback((mediaId: number) => {
    notificationManager.disableNotification(mediaId);
    setPrefs(notificationManager.getPreferences());
    setEnabledCount((prev) => prev - 1);
  }, []);

  // Use ref for prefs so the interval callback always reads the latest value
  // without depending on the prefs state variable (which would recreate the interval)
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Deduplication set: prevents both useEffects from notifying for the same episode (Fix H9)
  const notifiedEpisodesRef = useRef<Set<string>>(new Set());

  // Check for new episodes and send notifications
  useEffect(() => {
    if (permission !== "granted" || airingSchedule.length === 0) return;

    const checkInterval = setInterval(() => {
      if (document.hidden) return;
      airingSchedule.forEach((item) => {
        const pref = prefsRef.current.find((p) => p.mediaId === item.mediaId);
        if (pref?.enabled && item.nextEpisode > pref.episodeOffset) {
          // Fix H9: guard against duplicate notifications
          const dupKey = `${item.mediaId}-${item.nextEpisode}`;
          if (notifiedEpisodesRef.current.has(dupKey)) return;
          notifiedEpisodesRef.current.add(dupKey);

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
  }, [permission, airingSchedule]);

  // Auto-check for upcoming episodes in user's watchlist
  useEffect(() => {
    if (permission !== 'granted') return;

    const checkUpcomingEpisodes = async () => {
      try {
        const trackedIds = new Set([...watchlist, ...favorites]);
        if (trackedIds.size === 0) return;

        // Fetch current week schedule from AniList
        const now = Math.floor(Date.now() / 1000);
        const oneHourFromNow = now + 3600;

        const query = `{
          Page(page: 1, perPage: 50) {
            airingSchedules(airingAt_greater: ${now}, airingAt_lesser: ${oneHourFromNow}, sort: TIME) {
              airingAt
              episode
              media {
                id
                title { english romaji }
                coverImage { medium }
              }
            }
          }
        }`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        let response: Response;
        try {
          response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) return;
        const data = await response.json();
        const schedules = data?.data?.Page?.airingSchedules || [];

        // Filter to user's watchlist
        const notifiedKey = 'notified-episodes';
        let notified: string[];
        try {
          notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
        } catch {
          localStorage.removeItem(notifiedKey);
          notified = [];
        }

        for (const schedule of schedules) {
          if (!trackedIds.has(schedule.media?.id)) continue;
          const key = `${schedule.media.id}-ep${schedule.episode}`;
          if (notified.includes(key)) continue;

          // Fix H9: also check the in-memory dedup set to avoid duplicates from the other useEffect
          const dupKey = `${schedule.media.id}-${schedule.episode}`;
          if (notifiedEpisodesRef.current.has(dupKey)) continue;
          notifiedEpisodesRef.current.add(dupKey);

          const title = schedule.media.title?.english || schedule.media.title?.romaji || 'Unknown';
          const minutesUntil = Math.round((schedule.airingAt - now) / 60);

          new Notification(`${title} - Episode ${schedule.episode}`, {
            body: `Airing in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}!`,
            icon: schedule.media.coverImage?.medium || '/icons/icon.svg',
            tag: key,
          });

          notified.push(key);
        }

        // Keep only last 200 notified keys
        localStorage.setItem(notifiedKey, JSON.stringify(notified.slice(-200)));
      } catch {
        // Silently fail - notifications are non-critical
      }
    };

    checkUpcomingEpisodes();
    const interval = setInterval(checkUpcomingEpisodes, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [favorites, permission, watchlist]);

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
                        // Get title from fetched map first, then airing schedule, then fallback
                        const title = animeTitles.get(animeId) ||
                                     airingSchedule.find((a) => a.mediaId === animeId)?.title ||
                                     `Anime ${animeId}`;
                        const isEnabled = notificationManager.isEnabled(animeId);

                        return (
                          <div
                            key={animeId}
                            className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                          >
                            <span className="text-sm truncate flex-1">
                              {title}
                            </span>
                            <button
                              onClick={() => {
                                if (isEnabled) {
                                  disableForAnime(animeId);
                                } else {
                                  notificationManager.enableNotification(animeId, title, 0);
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
    // H6: Cancel flag to prevent setState after unmount
    let cancelled = false;

    async function fetchAiringSchedule() {
      try {
        const { anilist } = await import("@/lib/anilist");
        const result = await anilist.getAiring(1, 50);

        if (!cancelled && result.data?.Page?.airingSchedules) {
          const schedules: AiringAnime[] = result.data.Page.airingSchedules.map((item) => ({
            mediaId: item.media.id,
            title: item.media.title?.userPreferred || item.media.title?.english || item.media.title?.romaji || "Unknown",
            nextEpisode: item.episode,
            airingAt: item.airingAt,
          }));
          setSchedule(schedules);
        }
      } catch {
        // Silently fail - notifications just won't work
      }
    }

    fetchAiringSchedule();
    return () => { cancelled = true; };
  }, []);

  return schedule;
}

/**
 * Notification permission wrapper component
 */
export function NotificationPermissionRequest() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting initial permission state on mount
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (permission === "granted" || permission === "denied" || dismissed) {
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
                onClick={() => setDismissed(true)}
                variant="outline"
                size="sm"
              >
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
