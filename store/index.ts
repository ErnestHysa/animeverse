/**
 * Zustand Store
 * Global state management with localStorage persistence
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Media } from "@/types/anilist";
import { STORAGE_KEYS, DEFAULT_PREFERENCES } from "@/lib/constants";

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

export interface UserPreferences {
  defaultQuality: "360p" | "480p" | "720p" | "1080p" | "auto";
  autoplay: boolean;
  autoNext: boolean;
  streamingMethod: "webtorrent" | "direct" | "hybrid";
  subtitles: boolean;
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
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
}

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
    }),
    {
      name: "animeverse-stream-storage",
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
      // Only persist certain fields
      partialize: (state) => ({
        favorites: state.favorites,
        watchlist: state.watchlist,
        watchHistory: state.watchHistory,
        preferences: state.preferences,
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
