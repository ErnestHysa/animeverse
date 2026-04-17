/**
 * Episode List Component
 * Client-side episode list with watch history, filler detection, and progress tracking
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Clock, CheckCircle, Filter, CornerDownRight, ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useStore } from "@/store";

interface StreamingEpisodeData {
  site: string;
  title: string | null;
  thumbnail: string | null;
  url: string;
}

interface EpisodeListProps {
  animeId: number;
  malId?: number | null;
  totalEpisodes: number;
  currentEpisode: number;
  showFillers?: boolean;
  streamingEpisodes?: StreamingEpisodeData[];
  defaultEpisodeDuration?: number; // minutes, defaults to 24
}

export function EpisodeList({
  animeId,
  malId,
  totalEpisodes,
  currentEpisode,
  showFillers = true,
  streamingEpisodes,
  defaultEpisodeDuration = 24,
}: EpisodeListProps) {
  const router = useRouter();
  const watchHistory = useStore((state) => state.watchHistory);
  const preferences = useStore((state) => state.preferences);
  const [fillerEpisodes, setFillerEpisodes] = useState<Set<number>>(new Set());
  const [showOnlyUnwatched, setShowOnlyUnwatched] = useState(false);
  const [jumpToEp, setJumpToEp] = useState("");
  const currentRef = useRef<HTMLAnchorElement>(null);

  // Windowing state for large episode lists
  const CHUNK_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const listContainerRef = useRef<HTMLDivElement>(null);

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

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [showOnlyUnwatched]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + CHUNK_SIZE);
  }, []);

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

  // Build a map from episode number to title from streamingEpisodes data.
  // AniList titles are formatted as "Episode N - Title" or just "Episode N".
  const streamingEpisodeTitleMap = new Map<number, string>();
  if (streamingEpisodes) {
    for (const ep of streamingEpisodes) {
      if (!ep.title) continue;
      // Try to parse "Episode N - Title" pattern
      const match = ep.title.match(/^Episode\s+(\d+)(?:\s+-\s+(.+))?$/i);
      if (match) {
        const epNum = parseInt(match[1], 10);
        const subtitle = match[2]?.trim();
        if (!Number.isNaN(epNum) && subtitle) {
          streamingEpisodeTitleMap.set(epNum, subtitle);
        }
      }
    }
  }

  const handleJumpTo = (e: React.FormEvent) => {
    e.preventDefault();
    const epNum = parseInt(jumpToEp, 10);
    if (!isNaN(epNum) && epNum >= 1 && epNum <= totalEpisodes) {
      router.push(`/watch/${animeId}/${epNum}`);
      setJumpToEp("");
    }
  };

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

      {/* Jump to episode */}
      {totalEpisodes > 10 && (
        <form onSubmit={handleJumpTo} className="flex gap-1.5 mb-3">
          <input
            type="number"
            min={1}
            max={totalEpisodes}
            value={jumpToEp}
            onChange={(e) => setJumpToEp(e.target.value)}
            placeholder={`Ep 1–${totalEpisodes}`}
            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm transition-colors"
            title="Jump to episode"
          >
            <CornerDownRight className="w-4 h-4" />
          </button>
        </form>
      )}

      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin" ref={listContainerRef}>
        {filteredEpisodes.slice(0, visibleCount).map((epNum) => {
          const isCurrent = epNum === currentEpisode;
          const historyItem = episodeHistoryMap.get(epNum);
          const isWatched = historyItem?.completed ?? false;
          const inProgress = historyItem && !historyItem.completed && historyItem.progress > 0;
          const progressPercent = historyItem?.progress
            ? Math.min(100, (historyItem.progress / (defaultEpisodeDuration * 60)) * 100)
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
                  <p className="text-sm font-medium truncate">
                    Episode {epNum}
                    {streamingEpisodeTitleMap.has(epNum) && (
                      <span className="text-muted-foreground font-normal">
                        {" "}&ndash;{" "}{streamingEpisodeTitleMap.get(epNum)}
                      </span>
                    )}
                  </p>
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

        {/* Show More button for windowing */}
        {filteredEpisodes.length > visibleCount && (
          <button
            onClick={loadMore}
            className="w-full py-2.5 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Show More</span>
            <span className="text-xs">({Math.min(visibleCount + CHUNK_SIZE, filteredEpisodes.length) - visibleCount} of {filteredEpisodes.length - visibleCount} remaining)</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {filteredEpisodes.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            All episodes watched! 🎉
          </p>
        )}
      </div>
    </GlassCard>
  );
}
