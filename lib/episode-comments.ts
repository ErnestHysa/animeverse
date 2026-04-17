/**
 * Episode Comments System
 * Allows users to add comments to specific episodes with timestamps
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCookie } from "@/lib/storage";

export interface EpisodeComment {
  id: string;
  animeId: number;
  episodeNumber: number;
  userId: string; // "local" for local user, could be AniList user ID
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: number | null; // Video timestamp in seconds (null for general comment)
  createdAt: number;
  updatedAt: number;
  likes: number;
  likedBy: string[]; // Track which users liked this comment
  isSpoiler: boolean;
}

interface CommentsState {
  comments: EpisodeComment[];
  addComment: (comment: Omit<EpisodeComment, "id" | "createdAt" | "updatedAt" | "likes">) => void;
  updateComment: (id: string, content: string) => void;
  deleteComment: (id: string) => void;
  toggleLike: (id: string) => void;
  getCommentsForEpisode: (animeId: number, episodeNumber: number) => EpisodeComment[];
  getCommentsAtTimestamp: (animeId: number, episodeNumber: number, timestamp: number) => EpisodeComment[];
}

const getCurrentUser = () => {
  if (typeof window === "undefined") return { id: "local", name: "You", avatar: undefined };

  // Fix L2: Use secure getCookie helper from lib/storage instead of inline regex
  const displayCookie = getCookie("anilist_user_display");
  if (displayCookie) {
    try {
      const userData = JSON.parse(displayCookie);
      if (userData && userData.id && userData.name) {
        return {
          id: userData.id.toString(),
          name: userData.name,
          avatar: userData.avatar?.large || userData.avatar?.medium,
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Fallback: try Zustand localStorage (for legacy sessions)
  const storage = localStorage.getItem("animeverse-stream-storage");
  if (storage) {
    try {
      const parsed = JSON.parse(storage);
      if (parsed.state?.anilistUser) {
        return {
          id: parsed.state.anilistUser.id.toString(),
          name: parsed.state.anilistUser.name,
          avatar: parsed.state.anilistUser.avatar?.large || parsed.state.anilistUser.avatar?.medium,
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return { id: "local", name: "You", avatar: undefined };
};

export const useEpisodeComments = create<CommentsState>()(
  persist(
    (set, get) => ({
      comments: [],

      addComment: (comment) =>
        set((state) => {
          const user = getCurrentUser();
          const newComment: EpisodeComment = {
            ...comment,
            id: typeof crypto !== 'undefined' && crypto.randomUUID
              ? `comment_${crypto.randomUUID()}`
              : `comment_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            likes: 0,
            likedBy: [],
          };
          return { comments: [...state.comments, newComment] };
        }),

      updateComment: (id, content) =>
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === id ? { ...c, content, updatedAt: Date.now() } : c
          ),
        })),

      deleteComment: (id) =>
        set((state) => ({
          comments: state.comments.filter((c) => c.id !== id),
        })),

      toggleLike: (id) =>
        set((state) => {
          const user = getCurrentUser();
          return {
            comments: state.comments.map((c) => {
              if (c.id !== id) return c;
              const likedBy = c.likedBy || [];
              if (likedBy.includes(user.id)) {
                // Unlike: remove user and decrement
                return {
                  ...c,
                  likes: Math.max(0, c.likes - 1),
                  likedBy: likedBy.filter((uid) => uid !== user.id),
                };
              } else {
                // Like: add user and increment
                return {
                  ...c,
                  likes: c.likes + 1,
                  likedBy: [...likedBy, user.id],
                };
              }
            }),
          };
        }),

      getCommentsForEpisode: (animeId, episodeNumber) => {
        const state = get();
        return state.comments.filter(
          (c) => c.animeId === animeId && c.episodeNumber === episodeNumber
        ).sort((a, b) => b.createdAt - a.createdAt);
      },

      getCommentsAtTimestamp: (animeId, episodeNumber, timestamp) => {
        const state = get();
        return state.comments.filter(
          (c) =>
            c.animeId === animeId &&
            c.episodeNumber === episodeNumber &&
            c.timestamp !== null &&
            Math.abs(c.timestamp - timestamp) < 5 // Within 5 seconds
        );
      },
    }),
    {
      name: "animeverse-episode-comments",
      partialize: (state) => ({ comments: state.comments }),
    }
  )
);

// Helper function to format timestamp as MM:SS
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper function to parse timestamp string to seconds
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    return mins * 60 + secs;
  }
  return 0;
}
