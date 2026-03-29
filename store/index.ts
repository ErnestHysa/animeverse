/**
 * Zustand Store
 * Global state management with localStorage persistence
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Media } from "@/types/anilist";
import { STORAGE_KEYS, DEFAULT_PREFERENCES } from "@/lib/constants";
import { ACHIEVEMENTS, getAchievementRequirement } from "@/lib/achievements";

// Re-export achievements list for use in components
export const ACHIEVEMENTS_LIST = ACHIEVEMENTS;

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

  // Achievements
  achievements: { [key: string]: number }; // achievementId -> progress
  unlockedAchievements: string[]; // achievementIds
  unlockAchievement: (achievementId: string) => void;
  updateAchievementProgress: (achievementId: string, progress: number) => void;
  checkAndUnlockAchievements: () => void;
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
    | "achievements"
    | "unlockedAchievements"
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

          return {
            watchHistory: [
              {
                ...item,
                timestamp: Date.now(),
              },
              ...filtered,
            ].slice(0, 100), // Keep only last 100 entries
          };
        }),

      getWatchHistoryItem: (mediaId: number) => {
        return get().watchHistory.find((item) => item.mediaId === mediaId);
      },

      getContinueWatching: (limit = 10) => {
        const history = get().watchHistory;
        // Group by media and get most recent episode
        const mediaMap = new Map<number, WatchHistoryItem>();

        for (const item of history) {
          const existing = mediaMap.get(item.mediaId);
          if (!existing || item.timestamp > existing.timestamp) {
            mediaMap.set(item.mediaId, item);
          }
        }

        return Array.from(mediaMap.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .filter((item) => !item.completed)
          .slice(0, limit);
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
        set((state) => ({
          mediaCache: { ...state.mediaCache, [media.id]: media },
        })),

      getMediaCache: (id: number) => {
        return get().mediaCache[id];
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

      syncAniListData: (mediaList: unknown[]) =>
        set((state) => {
          // Process AniList media list - preserve full status data
          const entries: AniListMediaEntry[] = [];
          const favoriteIds: number[] = [];
          const watchlistIds: number[] = [];
          const watchingIds: number[] = [];
          const completedIds: number[] = [];

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

            // Also update legacy lists for backwards compatibility
            switch (item.status) {
              case "COMPLETED":
                completedIds.push(mediaId);
                favoriteIds.push(mediaId);
                break;
              case "CURRENT":
                watchingIds.push(mediaId);
                favoriteIds.push(mediaId);
                break;
              case "PLANNING":
                watchlistIds.push(mediaId);
                break;
              case "PAUSED":
                watchlistIds.push(mediaId);
                break;
              case "REPEATING":
                favoriteIds.push(mediaId);
                break;
            }
          }

          return {
            // Store full AniList media list with proper status
            anilistMediaList: entries,
            // Update legacy lists
            favorites: [...new Set([...state.favorites, ...favoriteIds])],
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
              const episodesToCreate = entry.status === "COMPLETED" || entry.status === "REPEATING"
                ? totalEpisodes
                : episodesWatched;

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

      unlockAchievement: (achievementId: string) =>
        set((state) => {
          if (state.unlockedAchievements.includes(achievementId)) return state;

          // Save to localStorage
          if (typeof window !== "undefined") {
            try {
              const allAchievements = {
                ...state.achievements,
                [achievementId]: (state.achievements[achievementId] || 0) + 1,
              };
              localStorage.setItem("animeverse_achievements", JSON.stringify({
                achievements: allAchievements,
                unlocked: [...state.unlockedAchievements, achievementId],
              }));
            } catch (error) {
              console.error("Failed to save achievement:", error);
            }
          }

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

          // Check if achievement should be unlocked
          if (currentProgress < progress && progress >= getAchievementRequirement(achievementId)) {
            // Trigger unlock
            const action = get().unlockAchievement;
            action(achievementId);
            return state;
          }

          return {
            achievements: {
              ...state.achievements,
              [achievementId]: progress,
            },
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

          // Save to localStorage
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("animeverse_achievements", JSON.stringify({
                achievements: newAchievements,
                unlocked: newUnlocked,
              }));
            } catch (error) {
              console.error("Failed to save achievements:", error);
            }
          }

          return {
            achievements: newAchievements,
            unlockedAchievements: newUnlocked,
          };
        }),
    }),
    {
      name: "animeverse-stream-storage",
      version: 2,
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
            console.warn(`Failed to set ${name} in localStorage:`, error);
            // Silently fail - app will work without persistence
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
              position: "bottom",
              edgeStyle: "drop-shadow",
              textShadow: true,
              windowColor: "#000000",
              windowOpacity: 0,
            };
          }
        }

        if (state.preferences && state.preferences.streamingMethod !== "direct") {
          state.preferences.streamingMethod = "direct";
        }

        return state;
      },
      // Only persist certain fields
        partialize: (state) => ({
          favorites: state.favorites,
          watchlist: state.watchlist,
          watchHistory: state.watchHistory,
          preferences: state.preferences,
          mediaCache: state.mediaCache,
          anilistUser: state.anilistUser,
          anilistToken: state.anilistToken,
          isAuthenticated: state.isAuthenticated,
          anilistMediaList: state.anilistMediaList,
          achievements: state.achievements,
          unlockedAchievements: state.unlockedAchievements,
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
  const favorites = useStore((state) => state.favorites);
  const addFavorite = useStore((state) => state.addFavorite);
  const removeFavorite = useStore((state) => state.removeFavorite);
  const toggleFavorite = useStore((state) => state.toggleFavorite);
  const isFavorite = useStore((state) => state.isFavorite);
  const clearFavorites = useStore((state) => state.clearFavorites);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    count: favorites.length,
  };
};

/**
 * Hook for watchlist
 */
export const useWatchlist = () => {
  const watchlist = useStore((state) => state.watchlist);
  const addWatchlist = useStore((state) => state.addWatchlist);
  const removeWatchlist = useStore((state) => state.removeWatchlist);
  const toggleWatchlist = useStore((state) => state.toggleWatchlist);
  const isInWatchlist = useStore((state) => state.isInWatchlist);
  const clearWatchlist = useStore((state) => state.clearWatchlist);

  return {
    watchlist,
    addWatchlist,
    removeWatchlist,
    toggleWatchlist,
    isInWatchlist,
    clearWatchlist,
    count: watchlist.length,
  };
};

/**
 * Hook for watch history
 */
export const useWatchHistory = () => {
  const watchHistory = useStore((state) => state.watchHistory);
  const addToWatchHistory = useStore((state) => state.addToWatchHistory);
  const getWatchHistoryItem = useStore((state) => state.getWatchHistoryItem);
  const getContinueWatching = useStore((state) => state.getContinueWatching);
  const clearWatchHistory = useStore((state) => state.clearWatchHistory);
  const clearMediaHistory = useStore((state) => state.clearMediaHistory);

  return {
    watchHistory,
    addToWatchHistory,
    getWatchHistoryItem,
    getContinueWatching,
    clearWatchHistory,
    clearMediaHistory,
  };
};

/**
 * Hook for user preferences
 */
export const usePreferences = () => {
  const preferences = useStore((state) => state.preferences);
  const updatePreferences = useStore((state) => state.updatePreferences);
  const resetPreferences = useStore((state) => state.resetPreferences);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
};

/**
 * Hook for media cache
 */
export const useMediaCache = () => {
  const mediaCache = useStore((state) => state.mediaCache);
  const setMediaCache = useStore((state) => state.setMediaCache);
  const getMediaCache = useStore((state) => state.getMediaCache);
  const clearMediaCache = useStore((state) => state.clearMediaCache);

  return {
    mediaCache,
    setMediaCache,
    getMediaCache,
    clearMediaCache,
  };
};

/**
 * Hook for AniList authentication
 */
export const useAniListAuth = () => {
  const anilistUser = useStore((state) => state.anilistUser);
  const anilistToken = useStore((state) => state.anilistToken);
  const anilistMediaList = useStore((state) => state.anilistMediaList);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const setAniListAuth = useStore((state) => state.setAniListAuth);
  const clearAniListAuth = useStore((state) => state.clearAniListAuth);
  const syncAniListData = useStore((state) => state.syncAniListData);
  const migrateAniListData = useStore((state) => state.migrateAniListData);

  return {
    anilistUser,
    anilistToken,
    anilistMediaList,
    isAuthenticated,
    setAniListAuth,
    clearAniListAuth,
    syncAniListData,
    migrateAniListData,
  };
};

/**
 * Hook for Achievements
 */
export const useAchievements = () => {
  const achievements = useStore((state) => state.achievements);
  const unlockedAchievements = useStore((state) => state.unlockedAchievements);
  const unlockAchievement = useStore((state) => state.unlockAchievement);
  const updateAchievementProgress = useStore((state) => state.updateAchievementProgress);
  const checkAndUnlockAchievements = useStore((state) => state.checkAndUnlockAchievements);

  return {
    achievements,
    unlockedAchievements,
    unlockAchievement,
    updateAchievementProgress,
    checkAndUnlockAchievements,
  };
};
