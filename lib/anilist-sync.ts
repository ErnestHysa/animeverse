/**
 * AniList Two-Way Progress Sync
 * Utility hook + function to push watch progress back to a user's AniList account.
 * Used by mark-all-watched and other out-of-player triggers.
 * (The video player itself uses video-source-loader.tsx → anilist.saveMediaListEntry directly.)
 */

"use client";

import { useStore } from "@/store";
import { anilist } from "@/lib/anilist";
import { useCallback } from "react";

/**
 * React hook that returns a memoized callback to sync episode progress to AniList.
 * Safe to call from any component — only fires API call when authenticated.
 */
export function useAniListProgressSync() {
  const anilistToken = useStore((s) => s.anilistToken);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const updateAniListEntryLocally = useStore((s) => s.updateAniListEntryLocally);

  const syncProgress = useCallback(
    async (
      mediaId: number,
      episodeWatched: number,
      totalEpisodes: number | null | undefined
    ) => {
      const isCompleted = totalEpisodes != null && episodeWatched >= totalEpisodes;
      const status = isCompleted ? "COMPLETED" : "CURRENT";

      // Always update locally
      updateAniListEntryLocally(mediaId, episodeWatched, status);

      // Push to AniList API if authenticated (fire-and-forget)
      if (!isAuthenticated || !anilistToken) return;

      try {
        await anilist.saveMediaListEntry(anilistToken, mediaId, episodeWatched, status);
      } catch (error) {
        console.error('Failed to sync progress to AniList:', error);
      }
    },
    [anilistToken, isAuthenticated, updateAniListEntryLocally]
  );

  return { syncProgress, isAuthenticated };
}
