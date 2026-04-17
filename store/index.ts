/**
 * Zustand Store
 * Global state management with localStorage persistence
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useMemo } from "react";

import type { Media } from "@/types/anilist";
import { STORAGE_KEYS, DEFAULT_PREFERENCES } from "@/lib/constants";
import { ACHIEVEMENTS, getAchievementRequirement } from "@/lib/achievements";

// Re-export achievements list for use in components
export const ACHIEVEMENTS_LIST = ACHIEVEMENTS;

// Memoization cache for getContinueWatching
let _continueWatchingCache: { watchHistoryRef: WatchHistoryItem[]; limit: number; result: WatchHistoryItem[] } | null = null;

// Clear cache in development HMR
if (process.env.NODE_ENV === 'development' && typeof (module as any).hot !== 'undefined') {
  (module as any).hot?.dispose(() => { _continueWatchingCache = null; });
}

// ===================================
// Types
// ===================================

export interface WatchHistoryItem {
  mediaId: number;
  episodeNumber: number;
  timestamp: number;
  progress: number; // seconds
  completed: boolean;
}

export interface AniListUser {
  id: number;
  name: string;
  avatar: { large: string; medium: string };
  options: { displayAdultContent: boolean };
  mediaListOptions: {
    scoreFormat: string;
    rowOrder: string;
  };
}

// AniList media list entry status
export type AniListStatus =
  | "CURRENT"   // Currently watching
  | "PLANNING"   // Plan to watch
  | "COMPLETED"  // Completed
  | "DROPPED"    // Dropped
  | "PAUSED"     // On hold
  | "REPEATING"; // Re-watching

export interface AniListMediaEntry {
  mediaId: number;
  status: AniListStatus;
  progress: number; // episodes watched
  score: number;
  startDate?: number;
  completedAt?: number;
  media?: {
    id: number;
    idMal?: number;
    title?: { romaji?: string; english?: string };
    coverImage?: { large?: string; extraLarge?: string };
    status?: string;
    episodes?: number;
    genres?: string[];
    averageScore?: number;
    format?: string;
    duration?: number; // in minutes
    description?: string;
    studios?: { nodes: { name: string }[] };
  };
}

export interface SubtitleStyle {
  fontSize: number; // 16-32px
  fontFamily: string; // Arial, Roboto, etc.
  fontColor: string; // hex color
  backgroundColor: string; // hex color with opacity
  backgroundOpacity: number; // 0-100
  position: "top" | "middle" | "bottom";
  edgeStyle: "none" | "raised" | "depressed" | "uniform" | "drop-shadow";
  textShadow: boolean;
  windowColor: string;
  windowOpacity: number; // 0-100
}

export interface PreloadConfig {
  enabled: boolean;
  preloadThreshold: number; // seconds remaining to trigger preload
  targetBytes: number; // bytes to preload (default: 100MB)
  wifiOnly: boolean; // only preload when on WiFi
}

export interface BandwidthConfig {
  uploadLimit: number; // bytes per second, 0 = unlimited
  downloadLimit: number; // bytes per second, 0 = unlimited
  mode: "unlimited" | "custom" | "adaptive";
  adaptiveEnabled: boolean;
  wifiOnly: boolean; // only limit when on WiFi
}

export interface DHTConfig {
  enablePreconnect: boolean;
  preferTrackers: boolean; // use trackers before DHT
}

export interface MALUser {
  id: number;
  name: string;
  picture: string;
}

export interface UserPreferences {
  defaultQuality: "360p" | "480p" | "720p" | "1080p" | "auto";
  autoplay: boolean;
  autoNext: boolean;
  streamingMethod: "webtorrent" | "direct" | "hybrid";
  subtitles: boolean;
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  hideAdultContent: boolean; // NSFW filter
  showFillerEpisodes: boolean; // Filler episode visibility
  subtitleStyle: SubtitleStyle;
  subtitleLanguage: string; // Default subtitle language code
  preferDubs: boolean; // Prefer dubbed versions for P2P streaming

  // Phase 6: Performance & Optimization
  preloadConfig: PreloadConfig;
  bandwidthConfig: BandwidthConfig;
  dhtConfig: DHTConfig;
}

export interface StoreState {
  // Favorites
  favorites: number[];
  addFavorite: (id: number) => void;
  removeFavorite: (id: number) => void;
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
  clearFavorites: () => void;

  // Watchlist
  watchlist: number[];
  addWatchlist: (id: number) => void;
  removeWatchlist: (id: number) => void;
  toggleWatchlist: (id: number) => void;
  isInWatchlist: (id: number) => boolean;
  clearWatchlist: () => void;

  // Watch History
  watchHistory: WatchHistoryItem[];
  addToWatchHistory: (item: Omit<WatchHistoryItem, "timestamp">) => void;
  getWatchHistoryItem: (mediaId: number) => WatchHistoryItem | undefined;
  getContinueWatching: (limit?: number) => WatchHistoryItem[];
  clearWatchHistory: () => void;
  clearMediaHistory: (mediaId: number) => void;

  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  resetPreferences: () => void;

  // Media Cache (for offline capability)
  mediaCache: Record<number, Media>;
  setMediaCache: (media: Media) => void;
  getMediaCache: (id: number) => Media | undefined;
  clearMediaCache: () => void;

  // AniList Authentication
  anilistUser: AniListUser | null;
  anilistToken: string | null;
  isAuthenticated: boolean;
  anilistMediaList: AniListMediaEntry[]; // Full AniList media list with status
  setAniListAuth: (user: AniListUser, token: string) => void;
  clearAniListAuth: () => void;
  syncAniListData: (mediaList: unknown[]) => void;
  migrateAniListData: (mediaList: AniListMediaEntry[]) => void;
  getAniListEntry: (mediaId: number) => AniListMediaEntry | undefined;
  updateAniListEntryLocally: (mediaId: number, progress: number, status: AniListStatus) => void;

  // MAL Authentication
  malToken: string | null;
  malRefreshToken: string | null;
  malTokenExpiresAt: number | null;
  malUser: MALUser | null;
  setMALAuth: (user: MALUser, token: string, refreshToken: string, expiresAt: number) => void;
  clearMALAuth: () => void;

  // Achievements
  achievements: { [key: string]: number }; // achievementId -> progress
  unlockedAchievements: string[]; // achievementIds
  unlockAchievement: (achievementId: string) => void;
  updateAchievementProgress: (achievementId: string, progress: number) => void;
  checkAndUnlockAchievements: () => void;

  // Per-anime language, server, and streaming method preferences
  perAnimePrefs: Record<number, { language?: "sub" | "dub"; server?: string; streamingMethod?: "webtorrent" | "direct" | "hybrid" }>;
  setPerAnimePref: (animeId: number, pref: { language?: "sub" | "dub"; server?: string; streamingMethod?: "webtorrent" | "direct" | "hybrid" }) => void;
  getPerAnimePref: (animeId: number) => { language?: "sub" | "dub"; server?: string; streamingMethod?: "webtorrent" | "direct" | "hybrid" } | undefined;

  // Mini player state (persists while browsing)
  miniPlayer: {
    animeId: number;
    animeTitle: string;
    episode: number;
    coverImage?: string;
  } | null;
  setMiniPlayer: (state: StoreState["miniPlayer"]) => void;
  clearMiniPlayer: () => void;
}

type PersistedStoreState = Partial<
  Pick<
    StoreState,
    | "favorites"
    | "watchlist"
    | "watchHistory"
    | "preferences"
    | "mediaCache"
    | "anilistUser"
    | "anilistToken"
    | "isAuthenticated"
    | "anilistMediaList"
    | "malToken"
    | "malRefreshToken"
    | "malTokenExpiresAt"
    | "malUser"
    | "achievements"
    | "unlockedAchievements"
    | "perAnimePrefs"
  >
>;

// ===================================
// Store Creation
// ===================================

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // ===================================
      // Initial State
      // ===================================

      favorites: [],
      watchlist: [],
      watchHistory: [],
      preferences: DEFAULT_PREFERENCES,
      mediaCache: {},

      // AniList Auth State
      anilistUser: null,
      anilistToken: null,
      isAuthenticated: false,
      anilistMediaList: [],

      // MAL Auth State
      malToken: null,
      malRefreshToken: null,
      malTokenExpiresAt: null,
      malUser: null,

      // ===================================
      // Favorites Actions
      // ===================================

      addFavorite: (id: number) =>
        set((state) => ({
          favorites: [...new Set([...state.favorites, id])],
        })),

      removeFavorite: (id: number) =>
        set((state) => ({
          favorites: state.favorites.filter((favId) => favId !== id),
        })),

      toggleFavorite: (id: number) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((favId) => favId !== id)
            : [...new Set([...state.favorites, id])],
        })),

      isFavorite: (id: number) => {
        return get().favorites.includes(id);
      },

      clearFavorites: () => set({ favorites: [] }),

      // ===================================
      // Watchlist Actions
      // ===================================

      addWatchlist: (id: number) =>
        set((state) => ({
          watchlist: [...new Set([...state.watchlist, id])],
        })),

      removeWatchlist: (id: number) =>
        set((state) => ({
          watchlist: state.watchlist.filter((watchId) => watchId !== id),
        })),

      toggleWatchlist: (id: number) =>
        set((state) => ({
          watchlist: state.watchlist.includes(id)
            ? state.watchlist.filter((watchId) => watchId !== id)
            : [...new Set([...state.watchlist, id])],
        })),

      isInWatchlist: (id: number) => {
        return get().watchlist.includes(id);
      },

      clearWatchlist: () => set({ watchlist: [] }),

      // ===================================
      // Watch History Actions
      // ===================================

      addToWatchHistory: (item) =>
        set((state) => {
          // Remove existing entry for this media/episode if any
          const filtered = state.watchHistory.filter(
            (h) => !(h.mediaId === item.mediaId && h.episodeNumber === item.episodeNumber)
          );

          const updated = [
              {
                ...item,
                timestamp: Date.now(),
              },
              ...filtered,
            ];

          // Cap at 200 entries to prevent unbounded growth
          while (updated.length > 200) {
            updated.shift();
          }

          return {
            watchHistory: updated,
          };
        }),

      getWatchHistoryItem: (mediaId: number) => {
        return get().watchHistory.find((item) => item.mediaId === mediaId);
      },

      getContinueWatching: (limit = 10) => {
        const history = get().watchHistory;

        // Return cached result if watchHistory hasn't changed and limit matches
        if (
          _continueWatchingCache &&
          _continueWatchingCache.watchHistoryRef === history &&
          _continueWatchingCache.limit === limit
        ) {
          return _continueWatchingCache.result;
        }

        // Group by media and get most recent episode
        const mediaMap = new Map<number, WatchHistoryItem>();

        for (const item of history) {
          const existing = mediaMap.get(item.mediaId);
          if (!existing || item.timestamp > existing.timestamp) {
            mediaMap.set(item.mediaId, item);
          }
        }

        const result = Array.from(mediaMap.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .filter((item) => !item.completed)
          .slice(0, limit);

        // Cache the result (reference check invalidates on any watchHistory change)
        _continueWatchingCache = { watchHistoryRef: history, limit, result };

        return result;
      },

      clearWatchHistory: () => set({ watchHistory: [] }),

      clearMediaHistory: (mediaId: number) =>
        set((state) => ({
          watchHistory: state.watchHistory.filter((item) => item.mediaId !== mediaId),
        })),

      // ===================================
      // Preferences Actions
      // ===================================

      updatePreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),

      // ===================================
      // Media Cache Actions
      // ===================================

      setMediaCache: (media: Media) =>
        set((state) => {
          const now = Date.now();
          const newCache = { ...state.mediaCache, [media.id]: { ...media, _lastAccessed: now } } as any;
          const keys = Object.keys(newCache);

          // Evict least-recently-accessed entries if cache exceeds 500 items
          if (keys.length > 500) {
            const excess = keys.length - 500;
            // Sort keys by lastAccessed timestamp ascending (oldest first)
            const sortedKeys = keys.sort((a, b) => (newCache[a]._lastAccessed || 0) - (newCache[b]._lastAccessed || 0));
            const keysToRemove = sortedKeys.slice(0, excess);
            for (const key of keysToRemove) {
              delete newCache[Number(key)];
            }
          }

          return { mediaCache: newCache };
        }),

      getMediaCache: (id: number) => {
        return get().mediaCache[id] || null;
      },

      clearMediaCache: () => set({ mediaCache: {} }),

      // ===================================
      // AniList Auth Actions
      // ===================================

      setAniListAuth: (user: AniListUser, token: string) =>
        set({
          anilistUser: user,
          anilistToken: token,
          isAuthenticated: true,
        }),

      clearAniListAuth: () =>
        set({
          anilistUser: null,
          anilistToken: null,
          isAuthenticated: false,
        }),

      // ===================================
      // MAL Auth Actions
      // ===================================

      setMALAuth: (user, token, refreshToken, expiresAt) =>
        set({
          malUser: user,
          malToken: token,
          malRefreshToken: refreshToken,
          malTokenExpiresAt: expiresAt,
        }),

      clearMALAuth: () =>
        set({
          malUser: null,
          malToken: null,
          malRefreshToken: null,
          malTokenExpiresAt: null,
        }),

      syncAniListData: (mediaList: unknown[]) =>
        set((state) => {
          // Process AniList media list - preserve full status data
          const entries: AniListMediaEntry[] = [];
          const watchlistIds: number[] = [];

          // Process AniList media list
          for (const item of mediaList as Array<{
            mediaId?: number;
            status: string;
            progress?: number;
            score?: number;
            startedAt?: { year?: number; month?: number; day?: number };
            completedAt?: { year?: number; month?: number; day?: number };
            media?: {
              id: number;
              idMal?: number;
              title?: { romaji?: string; english?: string };
              coverImage?: { large?: string; extraLarge?: string };
              status?: string;
              episodes?: number;
              genres?: string[];
              averageScore?: number;
              format?: string;
              duration?: number;
              description?: string;
              studios?: { nodes: { name: string }[] };
            };
          }>) {
            if (!item.media) continue;

            const mediaId = item.mediaId ?? item.media.id;
            const entry: AniListMediaEntry = {
              mediaId,
              status: item.status as AniListStatus,
              progress: item.progress ?? 0,
              score: item.score ?? 0,
              startDate: item.startedAt ? Date.parse(`${item.startedAt.year}-${item.startedAt.month || 1}-${item.startedAt.day || 1}`) : undefined,
              completedAt: item.completedAt ? Date.parse(`${item.completedAt.year}-${item.completedAt.month || 1}-${item.completedAt.day || 1}`) : undefined,
              media: item.media,
            };

            entries.push(entry);

            // Only sync PLANNING status to watchlist (plan-to-watch)
            // Do NOT conflate AniList status with local favorites
            switch (item.status) {
              case "PLANNING":
                watchlistIds.push(mediaId);
                break;
              // COMPLETED, CURRENT, REPEATING, PAUSED, DROPPED: only stored in anilistMediaList
              // Users manage favorites/watchlist locally via explicit actions
            }
          }

          return {
            // Store full AniList media list with proper status
            anilistMediaList: entries,
            // Only sync watchlist for PLANNING entries
            watchlist: [...new Set([...state.watchlist, ...watchlistIds])],
          };
        }),

      /**
       * Migrate AniList data to app's data structures
       * - Generates watch history entries from completed/current anime
       * - Populates mediaCache with anime details
       * - Calculates and updates user stats
       */
      migrateAniListData: (mediaList: AniListMediaEntry[]) =>
        set((state) => {
          const newWatchHistory: WatchHistoryItem[] = [...state.watchHistory];
          const newMediaCache: Record<number, Media> = { ...state.mediaCache };

          // Track existing history keys to avoid duplicates
          const existingHistoryKeys = new Set(state.watchHistory.map((item) => `${item.mediaId}-${item.episodeNumber}`));

          // Stats tracking
          let totalEpisodesWatched = 0;
          let totalMinutesWatched = 0;
          const genreCounts: Record<string, number> = {};
          const completedCount = { CURRENT: 0, COMPLETED: 0, REPEATING: 0 };
          const uniqueAnimeWatched = new Set<number>();

          // Process each AniList entry
          for (const entry of mediaList) {
            if (!entry.media) continue;

            const mediaId = entry.mediaId;
            uniqueAnimeWatched.add(mediaId);

            // Populate mediaCache with full anime data
            newMediaCache[mediaId] = {
              id: entry.media.id,
              idMal: entry.media.idMal || null,
              title: entry.media.title || { romaji: "", english: null, native: null, userPreferred: null },
              format: entry.media.format || null,
              type: "ANIME" as const,
              status: (entry.media.status === "RELEASING" ? "RELEASING" : entry.media.status === "FINISHED" ? "FINISHED" : entry.media.status === "NOT_YET_RELEASED" ? "NOT_YET_RELEASED" : entry.media.status === "CANCELLED" ? "CANCELLED" : "UNKNOWN"),
              description: entry.media.description || null,
              synonyms: null,
              isLicensed: null,
              source: null,
              countryOfOrigin: "JP",
              isAdult: false,
              genres: entry.media.genres || null,
              tags: null,
              studios: entry.media.studios || null,
              startDate: { year: null, month: null, day: null },
              endDate: null,
              season: null,
              seasonYear: null,
              seasonInt: null,
              averageScore: entry.media.averageScore || null,
              meanScore: null,
              popularity: 0,
              favourites: 0,
              trending: 0,
              episodes: entry.media.episodes || null,
              duration: entry.media.duration || null,
              chapters: null,
              volumes: null,
              coverImage: {
                large: entry.media.coverImage?.large || entry.media.coverImage?.extraLarge || "",
                medium: entry.media.coverImage?.large || entry.media.coverImage?.extraLarge || ""
              },
              bannerImage: null,
              trailer: null,
              relations: null,
              characters: null,
              staff: null,
              externalLinks: null,
              streamingEpisodes: null,
              nextAiringEpisode: null,
              airingSchedule: null,
            } as Media;

            // Count genres for stats
            if (entry.media.genres) {
              for (const genre of entry.media.genres) {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
              }
            }

            // Update status-based counts
            if (entry.status === "CURRENT") completedCount.CURRENT++;
            if (entry.status === "COMPLETED") completedCount.COMPLETED++;
            if (entry.status === "REPEATING") completedCount.REPEATING++;

            // Generate watch history entries for anime with progress
            const episodesWatched = entry.progress || 0;

            if (episodesWatched > 0) {
              const totalEpisodes = entry.media.episodes || entry.progress || 12;
              const duration = entry.media.duration || 24; // minutes per episode

              // Create entries for watched episodes
              // For completed anime, create entry for all episodes
              // For in-progress, create entry for current progress
              const episodesToCreate = Math.min(
                entry.status === "COMPLETED" || entry.status === "REPEATING"
                  ? totalEpisodes
                  : episodesWatched,
                50 // Cap at 50 entries per anime to prevent unbounded history
              );

              for (let ep = 1; ep <= episodesToCreate; ep++) {
                const historyKey = `${mediaId}-${ep}`;

                // Skip if already exists in watch history
                if (existingHistoryKeys.has(historyKey)) continue;

                const isCompleted = entry.status === "COMPLETED" || entry.status === "REPEATING" || ep < episodesWatched;

                newWatchHistory.push({
                  mediaId,
                  episodeNumber: ep,
                  timestamp: entry.completedAt || entry.startDate || Date.now(),
                  progress: isCompleted ? duration * 60 : duration * 30, // Estimate progress (seconds)
                  completed: isCompleted,
                });

                totalEpisodesWatched++;
                totalMinutesWatched += duration;
              }
            }
          }

          // Calculate final stats
          const totalHoursWatched = Math.floor(totalMinutesWatched / 60);
          const totalDaysWatched = Math.floor(totalHoursWatched / 24);

          // Sort genres by count
          const topGenres = Object.entries(genreCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([genre, count]) => ({ genre, count }));

          // Update localStorage stats
          if (typeof window !== "undefined") {
            try {
              const statsData = {
                totalEpisodesWatched: totalEpisodesWatched + (state.watchHistory.length),
                totalMinutesWatched: totalMinutesWatched,
                totalHoursWatched,
                totalDaysWatched,
                topGenres,
                completedAnime: completedCount.COMPLETED + completedCount.REPEATING,
                uniqueAnimeWatched: uniqueAnimeWatched.size,
                currentStreak: 0, // Would need more complex calculation
                longestStreak: 0, // Would need more complex calculation
              };
              localStorage.setItem("animeverse_stats", JSON.stringify(statsData));
            } catch (error) {
              console.error("Failed to save stats:", error);
            }
          }

          return {
            watchHistory: newWatchHistory.sort((a, b) => b.timestamp - a.timestamp),
            mediaCache: newMediaCache,
          };
        }),

      getAniListEntry: (mediaId: number) => {
        return get().anilistMediaList.find((entry) => entry.mediaId === mediaId);
      },

      updateAniListEntryLocally: (mediaId: number, progress: number, status: AniListStatus) =>
        set((state) => {
          const existing = state.anilistMediaList.find((e) => e.mediaId === mediaId);
          if (existing) {
            return {
              anilistMediaList: state.anilistMediaList.map((e) =>
                e.mediaId === mediaId ? { ...e, progress, status } : e
              ),
            };
          }
          return {
            anilistMediaList: [
              ...state.anilistMediaList,
              { mediaId, status, progress, score: 0 },
            ],
          };
        }),

      // ===================================
      // Achievements
      // ===================================

      achievements: {},
      unlockedAchievements: [],

      // Per-anime language & server preferences
      perAnimePrefs: {},

      // Mini player
      miniPlayer: null,
      setMiniPlayer: (miniPlayerState) => set({ miniPlayer: miniPlayerState }),
      clearMiniPlayer: () => set({ miniPlayer: null }),

      setPerAnimePref: (animeId, pref) =>
        set((state) => ({
          perAnimePrefs: {
            ...state.perAnimePrefs,
            [animeId]: { ...state.perAnimePrefs[animeId], ...pref },
          },
        })),

      getPerAnimePref: (animeId) => get().perAnimePrefs[animeId],

      unlockAchievement: (achievementId: string) =>
        set((state) => {
          if (state.unlockedAchievements.includes(achievementId)) return state;

          // Persistence is handled by Zustand persist middleware
          return {
            achievements: {
              ...state.achievements,
              [achievementId]: (state.achievements[achievementId] || 0) + 1,
            },
            unlockedAchievements: [...state.unlockedAchievements, achievementId],
          };
        }),

      updateAchievementProgress: (achievementId: string, progress: number) =>
        set((state) => {
          const currentProgress = state.achievements[achievementId] || 0;
          const newAchievements = {
            ...state.achievements,
            [achievementId]: progress,
          };

          // If progress crossed the threshold, unlock in the same set() call
          if (currentProgress < progress && progress >= getAchievementRequirement(achievementId)) {
            if (!state.unlockedAchievements.includes(achievementId)) {
              return {
                achievements: {
                  ...newAchievements,
                  [achievementId]: (state.achievements[achievementId] || 0) + 1,
                },
                unlockedAchievements: [...state.unlockedAchievements, achievementId],
              };
            }
          }

          return {
            achievements: newAchievements,
          };
        }),

      checkAndUnlockAchievements: () =>
        set((state) => {
          const newAchievements = { ...state.achievements };
          const newUnlocked: string[] = [...state.unlockedAchievements];

          // Calculate stats for achievement checking
          const totalEpisodes = state.watchHistory.length;
          const uniqueAnime = new Set(state.watchHistory.map((item) => item.mediaId));
          const completedAnime = state.watchHistory.filter((item) => item.completed).length;
          const favoritesCount = state.favorites.length;

          // Check each achievement
          for (const achievement of ACHIEVEMENTS_LIST) {
            if (newUnlocked.includes(achievement.id)) continue;

            let shouldUnlock = false;
            let currentProgress = newAchievements[achievement.id] || 0;

            switch (achievement.id) {
              case "first-anime":
                shouldUnlock = totalEpisodes >= 1;
                currentProgress = totalEpisodes;
                break;
              case "episode-10":
                shouldUnlock = totalEpisodes >= 10;
                currentProgress = totalEpisodes;
                break;
              case "episode-50":
                shouldUnlock = totalEpisodes >= 50;
                currentProgress = totalEpisodes;
                break;
              case "episode-100":
                shouldUnlock = totalEpisodes >= 100;
                currentProgress = totalEpisodes;
                break;
              case "episode-500":
                shouldUnlock = totalEpisodes >= 500;
                currentProgress = totalEpisodes;
                break;
              case "anime-10":
                shouldUnlock = uniqueAnime.size >= 10;
                currentProgress = uniqueAnime.size;
                break;
              case "anime-50":
                shouldUnlock = uniqueAnime.size >= 50;
                currentProgress = uniqueAnime.size;
                break;
              case "completed-5":
                shouldUnlock = completedAnime >= 5;
                currentProgress = completedAnime;
                break;
              case "completed-25":
                shouldUnlock = completedAnime >= 25;
                currentProgress = completedAnime;
                break;
              case "favorites-10":
                shouldUnlock = favoritesCount >= 10;
                currentProgress = favoritesCount;
                break;
              case "favorites-50":
                shouldUnlock = favoritesCount >= 50;
                currentProgress = favoritesCount;
                break;
              case "list-creator":
                // This is handled elsewhere when creating a list
                continue;
              default:
                // Genre-specific achievements would need genre tracking
                continue;
            }

            newAchievements[achievement.id] = currentProgress;

            if (shouldUnlock) {
              newUnlocked.push(achievement.id);
            }
          }

          // Persistence is handled by Zustand persist middleware

          return {
            achievements: newAchievements,
            unlockedAchievements: newUnlocked,
          };
        }),
    }),
    {
      name: "animeverse-stream-storage",
      version: 4,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            if (typeof window === "undefined") return null;
            const item = localStorage.getItem(name);
            return item ? JSON.parse(item) : null;
          } catch (error) {
            console.warn(`Failed to get ${name} from localStorage:`, error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            if (typeof window === "undefined") return;
            localStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            if (error instanceof DOMException && error.name === "QuotaExceededError") {
              // Evict old mediaCache entries to free space, then retry
              try {
                const parsed = typeof value === "string" ? JSON.parse(value) : value;
                if (parsed?.state?.mediaCache) {
                  const entries = Object.entries(parsed.state.mediaCache) as [string, any][];
                  if (entries.length > 100) {
                    // Sort by _lastAccessed ascending (oldest first) so we evict least-recently-used
                    entries.sort((a, b) => (a[1]._lastAccessed || 0) - (b[1]._lastAccessed || 0));
                    // Keep only the 100 most recently accessed entries
                    const toRemove = entries.slice(0, entries.length - 100);
                    for (const [key] of toRemove) {
                      delete parsed.state.mediaCache[key];
                    }
                    localStorage.setItem(name, JSON.stringify(parsed));
                  }
                }
              } catch (retryError) {
                console.warn(`Failed to save ${name} even after eviction:`, retryError);
              }
            } else {
              console.warn(`Failed to set ${name} in localStorage:`, error);
            }
          }
        },
        removeItem: (name) => {
          try {
            if (typeof window === "undefined") return;
            localStorage.removeItem(name);
          } catch (error) {
            console.warn(`Failed to remove ${name} from localStorage:`, error);
          }
        },
      })),
      // Migration: Ensure subtitleStyle exists for existing users
      migrate: (persistedState: unknown, version: number) => {
        const state =
          persistedState && typeof persistedState === "object"
            ? (persistedState as PersistedStoreState)
            : {};

        if (version === 0 || version === 1) {
          // Initial migration - ensure preferences has subtitleStyle
          if (state.preferences && !state.preferences.subtitleStyle) {
            state.preferences.subtitleStyle = {
              fontSize: 20,
              fontFamily: "Arial, sans-serif",
              fontColor: "#FFFFFF",
              backgroundColor: "#000000",
              backgroundOpacity: 50,
              position: "bottom" as const,
              edgeStyle: "drop-shadow" as const,
              textShadow: true,
              windowColor: "#000000",
              windowOpacity: 0,
            };
          }
        }

        if (version < 2) {
          // Ensure streamingMethod is set to direct for older versions
          if (state.preferences && state.preferences.streamingMethod !== "direct") {
            state.preferences.streamingMethod = "direct";
          }
        }

        if (version < 3) {
          // Add preferDubs for existing users
          if (state.preferences && state.preferences.preferDubs === undefined) {
            state.preferences.preferDubs = false;
          }
        }

        if (version < 4) {
          // Add Phase 6: Performance & Optimization settings
          if (state.preferences) {
            if (!state.preferences.preloadConfig) {
              state.preferences.preloadConfig = {
                enabled: true,
                preloadThreshold: 120,
                targetBytes: 100 * 1024 * 1024, // 100MB
                wifiOnly: true,
              };
            }
            if (!state.preferences.bandwidthConfig) {
              state.preferences.bandwidthConfig = {
                uploadLimit: 0,
                downloadLimit: 0,
                mode: "unlimited",
                adaptiveEnabled: false,
                wifiOnly: false,
              };
            }
            if (!state.preferences.dhtConfig) {
              state.preferences.dhtConfig = {
                enablePreconnect: true,
                preferTrackers: true,
              };
            }
          }
        }

        return state;
      },
        // Only persist certain fields
        // Fix H14: Remove OAuth tokens from localStorage — they are now in httpOnly cookies.
        // Keep boolean flags for connection status instead of actual tokens.
        partialize: (state) => ({
          favorites: state.favorites,
          watchlist: state.watchlist,
          watchHistory: state.watchHistory,
          preferences: state.preferences,
          mediaCache: state.mediaCache,
          anilistUser: state.anilistUser,
          isAuthenticated: state.isAuthenticated,
          anilistMediaList: state.anilistMediaList,
          malUser: state.malUser,
          achievements: state.achievements,
          unlockedAchievements: state.unlockedAchievements,
          perAnimePrefs: state.perAnimePrefs,
        }),
    }
  )
);

// ===================================
// Selector Hooks
// ===================================

/**
 * Hook for favorites
 */
export const useFavorites = () => {
  const favorites = useStore(s => s.favorites);
  const addFavorite = useStore(s => s.addFavorite);
  const removeFavorite = useStore(s => s.removeFavorite);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const isFavorite = useStore(s => s.isFavorite);
  const clearFavorites = useStore(s => s.clearFavorites);

  return useMemo(
    () => ({
      favorites,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isFavorite,
      clearFavorites,
      count: favorites.length,
    }),
    [favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite, clearFavorites]
  );
};

/**
 * Hook for watchlist
 */
export const useWatchlist = () => {
  const watchlist = useStore(s => s.watchlist);
  const addWatchlist = useStore(s => s.addWatchlist);
  const removeWatchlist = useStore(s => s.removeWatchlist);
  const toggleWatchlist = useStore(s => s.toggleWatchlist);
  const isInWatchlist = useStore(s => s.isInWatchlist);
  const clearWatchlist = useStore(s => s.clearWatchlist);

  return useMemo(
    () => ({
      watchlist,
      addWatchlist,
      removeWatchlist,
      toggleWatchlist,
      isInWatchlist,
      clearWatchlist,
      count: watchlist.length,
    }),
    [watchlist, addWatchlist, removeWatchlist, toggleWatchlist, isInWatchlist, clearWatchlist]
  );
};

/**
 * Hook for watch history
 */
export const useWatchHistory = () => {
  const watchHistory = useStore(s => s.watchHistory);
  const addToWatchHistory = useStore(s => s.addToWatchHistory);
  const getWatchHistoryItem = useStore(s => s.getWatchHistoryItem);
  const getContinueWatching = useStore(s => s.getContinueWatching);
  const clearWatchHistory = useStore(s => s.clearWatchHistory);
  const clearMediaHistory = useStore(s => s.clearMediaHistory);

  return useMemo(
    () => ({
      watchHistory,
      addToWatchHistory,
      getWatchHistoryItem,
      getContinueWatching,
      clearWatchHistory,
      clearMediaHistory,
    }),
    [watchHistory, addToWatchHistory, getWatchHistoryItem, getContinueWatching, clearWatchHistory, clearMediaHistory]
  );
};

/**
 * Hook for user preferences
 */
export const usePreferences = () => {
  const preferences = useStore(s => s.preferences);
  const updatePreferences = useStore(s => s.updatePreferences);
  const resetPreferences = useStore(s => s.resetPreferences);

  return useMemo(
    () => ({
      preferences,
      updatePreferences,
      resetPreferences,
    }),
    [preferences, updatePreferences, resetPreferences]
  );
};

/**
 * Hook for media cache
 */
export const useMediaCache = () => {
  const mediaCache = useStore(s => s.mediaCache);
  const setMediaCache = useStore(s => s.setMediaCache);
  const getMediaCache = useStore(s => s.getMediaCache);
  const clearMediaCache = useStore(s => s.clearMediaCache);

  return useMemo(
    () => ({
      mediaCache,
      setMediaCache,
      getMediaCache,
      clearMediaCache,
    }),
    [mediaCache, setMediaCache, getMediaCache, clearMediaCache]
  );
};

/**
 * Hook for AniList authentication
 */
export const useAniListAuth = () => {
  const anilistUser = useStore(s => s.anilistUser);
  const anilistToken = useStore(s => s.anilistToken);
  const anilistMediaList = useStore(s => s.anilistMediaList);
  const isAuthenticated = useStore(s => s.isAuthenticated);
  const setAniListAuth = useStore(s => s.setAniListAuth);
  const clearAniListAuth = useStore(s => s.clearAniListAuth);
  const syncAniListData = useStore(s => s.syncAniListData);
  const migrateAniListData = useStore(s => s.migrateAniListData);

  return useMemo(
    () => ({
      anilistUser,
      anilistToken,
      anilistMediaList,
      isAuthenticated,
      setAniListAuth,
      clearAniListAuth,
      syncAniListData,
      migrateAniListData,
    }),
    [anilistUser, anilistToken, anilistMediaList, isAuthenticated, setAniListAuth, clearAniListAuth, syncAniListData, migrateAniListData]
  );
};

/**
 * Hook for Achievements
 */
export const useAchievements = () => {
  const achievements = useStore(s => s.achievements);
  const unlockedAchievements = useStore(s => s.unlockedAchievements);
  const unlockAchievement = useStore(s => s.unlockAchievement);
  const updateAchievementProgress = useStore(s => s.updateAchievementProgress);
  const checkAndUnlockAchievements = useStore(s => s.checkAndUnlockAchievements);

  return useMemo(
    () => ({
      achievements,
      unlockedAchievements,
      unlockAchievement,
      updateAchievementProgress,
      checkAndUnlockAchievements,
    }),
    [achievements, unlockedAchievements, unlockAchievement, updateAchievementProgress, checkAndUnlockAchievements]
  );
};

/**
 * Hook for MAL authentication
 */
export const useMALAuth = () => {
  const malUser = useStore(s => s.malUser);
  const malToken = useStore(s => s.malToken);
  const malRefreshToken = useStore(s => s.malRefreshToken);
  const malTokenExpiresAt = useStore(s => s.malTokenExpiresAt);
  const setMALAuth = useStore(s => s.setMALAuth);
  const clearMALAuth = useStore(s => s.clearMALAuth);

  return useMemo(
    () => ({
      malUser,
      malToken,
      malRefreshToken,
      malTokenExpiresAt,
      setMALAuth,
      clearMALAuth,
      isMALAuthenticated: !!malToken,
    }),
    [malUser, malToken, malRefreshToken, malTokenExpiresAt, setMALAuth, clearMALAuth]
  );
};

/**
 * Hook for mini player state
 */
export const useMiniPlayer = () => {
  const miniPlayer = useStore(s => s.miniPlayer);
  const setMiniPlayer = useStore(s => s.setMiniPlayer);
  const clearMiniPlayer = useStore(s => s.clearMiniPlayer);

  return useMemo(
    () => ({
      miniPlayerAnime: miniPlayer,
      setMiniPlayer,
      clearMiniPlayer,
      isMiniPlayerActive: !!miniPlayer,
    }),
    [miniPlayer, setMiniPlayer, clearMiniPlayer]
  );
};

/**
 * Hook for per-anime preferences
 */
export const usePerAnimePrefs = () => {
  const perAnimePrefs = useStore(s => s.perAnimePrefs);
  const setPerAnimePref = useStore(s => s.setPerAnimePref);
  const getPerAnimePref = useStore(s => s.getPerAnimePref);

  return useMemo(
    () => ({
      perAnimePrefs,
      setPerAnimePref,
      getPerAnimePref,
    }),
    [perAnimePrefs, setPerAnimePref, getPerAnimePref]
  );
};
