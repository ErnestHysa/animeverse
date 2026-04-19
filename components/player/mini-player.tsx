"use client";

import { useMemo } from "react";
import { useStore } from "@/store";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Play, X, ExternalLink } from "lucide-react";

/**
 * Mini Player Bar
 * Shows at the bottom of the screen when the user has an active watch session
 * but has navigated away from the watch page.
 */
export function MiniPlayer() {
  const miniPlayer = useStore((s) => s.miniPlayer);
  const clearMiniPlayer = useStore((s) => s.clearMiniPlayer);
  const watchHistory = useStore((s) => s.watchHistory);
  const pathname = usePathname();

  // Memoize the O(n) history lookup so it doesn't run on every render
  const historyItem = useMemo(
    () =>
      miniPlayer
        ? watchHistory.find(
            (h) =>
              h.mediaId === miniPlayer.animeId &&
              h.episodeNumber === miniPlayer.episode
          )
        : undefined,
    [watchHistory, miniPlayer?.animeId, miniPlayer?.episode]
  );

  // Hide on the watch page itself
  if (!miniPlayer) return null;
  if (pathname.startsWith(`/watch/${miniPlayer.animeId}`)) return null;

  const watchUrl = `/watch/${miniPlayer.animeId}/${miniPlayer.episode}`;
  const progressPercent = historyItem
    ? Math.min(100, historyItem.completed
        ? 100
        : (() => {
            const histItem = historyItem as { progress: number; completed: boolean; duration?: number; totalDuration?: number };
            const duration = histItem.duration || histItem.totalDuration || 1440;
            return Math.round((historyItem.progress / duration) * 100);
          })())
    : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-card/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-4 py-3 max-w-xs w-full sm:max-w-sm animate-slideInRight">
      {/* Cover art */}
      <div className="relative w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
        {miniPlayer.coverImage ? (
          <Image
            src={miniPlayer.coverImage}
            alt={miniPlayer.animeTitle}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-primary/20 flex items-center justify-center">
            <Play className="w-4 h-4 text-primary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{miniPlayer.animeTitle}</p>
        <p className="text-xs text-muted-foreground">Episode {miniPlayer.episode}</p>
        {/* Mini progress bar (decorative — actual progress comes from history) */}
        <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Resume button */}
      <Link
        href={watchUrl}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
        aria-label="Resume watching"
      >
        <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
      </Link>

      {/* Detail page link */}
      <Link
        href={`/anime/${miniPlayer.animeId}`}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        aria-label="View anime details"
      >
        <ExternalLink className="w-3 h-3 text-muted-foreground" />
      </Link>

      {/* Dismiss */}
      <button
        onClick={clearMiniPlayer}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        aria-label="Close mini player"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  );
}
