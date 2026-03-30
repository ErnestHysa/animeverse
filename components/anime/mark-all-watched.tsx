/**
 * Mark All Episodes Watched
 * Button to mark all episodes of an anime as completed
 */

"use client";

import { useState, useCallback } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { toast } from "react-hot-toast";

interface MarkAllWatchedProps {
  animeId: number;
  totalEpisodes: number;
}

export function MarkAllWatched({ animeId, totalEpisodes }: MarkAllWatchedProps) {
  const [isMarking, setIsMarking] = useState(false);
  const addToWatchHistory = useStore((s) => s.addToWatchHistory);
  const watchHistory = useStore((s) => s.watchHistory);

  const watchedCount = watchHistory.filter(
    (h) => h.mediaId === animeId && h.completed
  ).length;

  const isAllWatched = totalEpisodes > 0 && watchedCount >= totalEpisodes;

  const handleMarkAll = useCallback(async () => {
    if (isAllWatched || isMarking || !totalEpisodes) return;
    setIsMarking(true);
    try {
      for (let ep = 1; ep <= totalEpisodes; ep++) {
        addToWatchHistory({
          mediaId: animeId,
          episodeNumber: ep,
          progress: 24 * 60, // 24 min in seconds (treated as completed)
          completed: true,
        });
      }
      toast.success(`Marked all ${totalEpisodes} episodes as watched!`);
    } finally {
      setIsMarking(false);
    }
  }, [animeId, totalEpisodes, addToWatchHistory, isAllWatched, isMarking]);

  if (!totalEpisodes) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMarkAll}
      disabled={isAllWatched || isMarking}
      className="gap-2"
      title={isAllWatched ? "All episodes already marked as watched" : "Mark all episodes as watched"}
    >
      <CheckCheck className="w-4 h-4" />
      {isAllWatched ? "All Watched" : isMarking ? "Marking…" : "Mark All Watched"}
    </Button>
  );
}
