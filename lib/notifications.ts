/**
 * Browser Notifications System
 * Handles notification permissions and delivery
 */

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

export interface AnimeNotificationPreference {
  mediaId: number;
  enabled: boolean;
  title: string;
  episodeOffset: number;
}

export interface NotificationTopicSettings {
  newEpisodes: boolean;
  airingReminders: boolean;
  recommendations: boolean;
}

const ANIME_NOTIFICATION_STORAGE_KEY = "animeverse-notifications";
const NOTIFICATION_TOPIC_STORAGE_KEY = "animeverse-notification-topics";

const DEFAULT_TOPIC_SETTINGS: NotificationTopicSettings = {
  newEpisodes: true,
  airingReminders: false,
  recommendations: false,
};

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
  }
}

export function getAnimeNotificationPreferences(): AnimeNotificationPreference[] {
  return readJsonStorage<AnimeNotificationPreference[]>(ANIME_NOTIFICATION_STORAGE_KEY, []);
}

export function saveAnimeNotificationPreferences(preferences: AnimeNotificationPreference[]): void {
  writeJsonStorage(ANIME_NOTIFICATION_STORAGE_KEY, preferences);
}

export function setAnimeNotificationEnabled(
  mediaId: number,
  title: string,
  enabled: boolean,
  episodeOffset = 0
): AnimeNotificationPreference[] {
  const next = getAnimeNotificationPreferences().filter((item) => item.mediaId !== mediaId);

  if (enabled) {
    next.push({
      mediaId,
      enabled: true,
      title,
      episodeOffset,
    });
  }

  saveAnimeNotificationPreferences(next);
  return next;
}

export function getNotificationTopicSettings(): NotificationTopicSettings {
  return {
    ...DEFAULT_TOPIC_SETTINGS,
    ...readJsonStorage<Partial<NotificationTopicSettings>>(NOTIFICATION_TOPIC_STORAGE_KEY, {}),
  };
}

export function saveNotificationTopicSettings(settings: NotificationTopicSettings): void {
  writeJsonStorage(NOTIFICATION_TOPIC_STORAGE_KEY, settings);
}

/**
 * Check if notifications are supported
 */
export function areNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!areNotificationsSupported()) return "denied";
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!areNotificationsSupported()) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return "denied";
}

/**
 * Show a notification
 */
export function showNotification(options: NotificationOptions): boolean {
  if (!areNotificationsSupported() || Notification.permission !== "granted") {
    return false;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || "/icon-192x192.png",
      badge: options.badge || "/badge-72x72.png",
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction || false,
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    return true;
  } catch (error) {
    console.error("Failed to show notification:", error);
    return false;
  }
}

/**
 * Schedule a notification for a specific time
 * Note: This only works while the page is open
 */
export function scheduleNotification(
  options: NotificationOptions,
  timestamp: number
): { cancel: () => void } | null {
  if (!areNotificationsSupported() || Notification.permission !== "granted") {
    return null;
  }

  const now = Date.now();
  const delay = timestamp - now;

  if (delay <= 0) {
    showNotification(options);
    return { cancel: () => {} };
  }

  // Cap delay at MAX_SAFE_DELAY to avoid setTimeout overflow (2^31-1 ms ≈ 24.8 days)
  const MAX_SAFE_DELAY = 2147483647;

  function scheduleWithMaxDelay(remaining: number): NodeJS.Timeout {
    if (remaining <= MAX_SAFE_DELAY) {
      return setTimeout(() => showNotification(options), remaining);
    }
    return setTimeout(() => scheduleWithMaxDelay(remaining - MAX_SAFE_DELAY), MAX_SAFE_DELAY);
  }

  const timeoutId = scheduleWithMaxDelay(delay);

  return {
    cancel: () => clearTimeout(timeoutId),
  };
}

/**
 * Notification types for anime streaming
 */
export const NOTIFICATION_TYPES = {
  NEW_EPISODE: "new_episode",
  AIRING_REMINDER: "airing_reminder",
  STREAM_STARTING: "stream_starting",
  RECOMMENDATION: "recommendation",
} as const;

/**
 * Show new episode notification
 */
export function notifyNewEpisode(animeTitle: string, episodeNumber: number, animeCover?: string): boolean {
  return showNotification({
    title: `New Episode Available!`,
    body: `${animeTitle} - Episode ${episodeNumber} is now available to watch.`,
    icon: animeCover || "/icon-192x192.png",
    tag: `new-episode-${animeTitle}-${episodeNumber}`,
    data: { type: NOTIFICATION_TYPES.NEW_EPISODE, animeTitle, episodeNumber },
  });
}

/**
 * Show airing reminder notification
 */
export function notifyAiringReminder(animeTitle: string, timeUntil: string): boolean {
  return showNotification({
    title: `${animeTitle} is airing soon!`,
    body: `New episode airs in ${timeUntil}. Don't miss it!`,
    tag: `airing-${animeTitle}`,
    data: { type: NOTIFICATION_TYPES.AIRING_REMINDER, animeTitle },
  });
}
