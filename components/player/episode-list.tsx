/**
 * Episode List Component
 * Client-side episode list with watch history, filler detection, and progress tracking
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Play, Clock, CheckCircle, Filter } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useStore } from "@/store";

interface EpisodeListProps {
  animeId: number;
  malId?: number | null;
  totalEpisodes: number;
  currentEpisode: number;
  showFillers?: boolean;
}

export function EpisodeList({
  animeId,
  malId,
  totalEpisodes,
  currentEpisode,
  showFillers = true,
}: EpisodeListProps) {
  const watchHistory = useStore((state) => state.watchHistory);
  const preferences = useStore((state) => state.preferences);
  const [fillerEpisodes, setFillerEpisodes] = useState<Set<number>>(new Set());
  const [showOnlyUnwatched, setShowOnlyUnwatched] = useState(false);
  const currentRef = useRef<HTMLAnchorElement>(null);

  // Load filler data
  useEffect(() => {
    if (!malId || !preferences.showFillerEpisodes) return;

    const loadFillerData = async () => {
      try {
        const { getFillerEpisodes } = await import("@/lib/filler-detection");
        const fillers = await getFillerEpisodes(malId);
        setFillerEpisodes(new Set(fillers));
      } catch {
        // Silently fail - filler detection is optional
      }
    };

    loadFillerData();
  }, [malId, preferences.showFillerEpisodes]);

  // Scroll current episode into view
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentEpisode]);

  // Get watch history for this anime
  const episodeHistoryMap = new Map<number, { progress: number; completed: boolean }>();
  for (const item of watchHistory) {
    if (item.mediaId === animeId) {
      episodeHistoryMap.set(item.episodeNumber, {
        progress: item.progress,
        completed: item.completed,
      });
    }
  }

  const episodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
  const filteredEpisodes = showOnlyUnwatched
    ? episodes.filter((ep) => !episodeHistoryMap.get(ep)?.completed)
    : episodes;

  const watchedCount = episodes.filter((ep) => episodeHistoryMap.get(ep)?.completed).length;

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Episodes</h2>
          {watchedCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {watchedCount}/{totalEpisodes} watched
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{totalEpisodes} eps</span>
          {watchedCount > 0 && (
            <button
              onClick={() => setShowOnlyUnwatched(!showOnlyUnwatched)}
              className={`p-1.5 rounded-lg transition-colors ${
                showOnlyUnwatched ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-muted-foreground"
              }`}
              title={showOnlyUnwatched ? "Show all episodes" : "Show unwatched only"}
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {watchedCount > 0 && (
        <div className="mb-4">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(watchedCount / totalEpisodes) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
        {filteredEpisodes.map((epNum) => {
          const isCurrent = epNum === currentEpisode;
          const historyItem = episodeHistoryMap.get(epNum);
          const isWatched = historyItem?.completed ?? false;
          const inProgress = historyItem && !historyItem.completed && historyItem.progress > 0;
          const progressPercent = historyItem?.progress
            ? Math.min(100, (historyItem.progress / (24 * 60)) * 100)
            : 0;
          const isFiller = fillerEpisodes.has(epNum);

          // Skip filler episodes if preference is set
          if (isFiller && !showFillers && !preferences.showFillerEpisodes) return null;

          return (
            <Link
              key={epNum}
              ref={isCurrent ? currentRef : undefined}
              href={`/watch/${animeId}/${epNum}`}
              className="flex items-center gap-3 p-2.5 rounded-lg transition-all hover:bg-white/5 group relative overflow-hidden"
              style={{
                backgroundColor: isCurrent ? "rgba(139, 92, 246, 0.15)" : undefined,
                border: isCurrent ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid transparent",
              }}
            >
              {/* Episode number / status indicator */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: isCurrent
                    ? "rgb(139, 92, 246)"
                    : isWatched
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(255, 255, 255, 0.05)",
                  color: isCurrent ? "white" : isWatched ? "rgb(34, 197, 94)" : undefined,
                }}
              >
                {isCurrent ? (
                  <Play className="w-4 h-4 fill-current" />
                ) : isWatched ? (
                  <CheckCircle className="w-4 h-4" />
                ) : inProgress ? (
                  <Clock className="w-4 h-4 text-yellow-400" />
                ) : (
                  <span className="text-xs">{epNum}</span>
                )}
              </div>

              {/* Episode info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">Episode {epNum}</p>
                  {isFiller && (
                    <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded flex-shrink-0">
                      Filler
                    </span>
                  )}
                </div>
                {isCurrent && (
                  <p className="text-xs text-primary">Now Playing</p>
                )}
                {inProgress && !isCurrent && (
                  <p className="text-xs text-yellow-400">In Progress</p>
                )}
              </div>

              {/* Progress indicator for in-progress episodes */}
              {(inProgress || isWatched) && !isCurrent && (
                <div className="flex-shrink-0 w-12">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isWatched ? "bg-green-500" : "bg-yellow-400"}`}
                      style={{ width: isWatched ? "100%" : `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          );
        })}

        {filteredEpisodes.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            All episodes watched! 🎉
          </p>
        )}
      </div>
    </GlassCard>
  );
}
