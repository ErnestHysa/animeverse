/**
 * Episode Comments Section
 * Client-side wrapper for episode comments on the watch page
 */

"use client";

import { useCallback } from "react";
import { EpisodeComments } from "@/components/comments/episode-comments";
interface EpisodeCommentsSectionProps {
  animeId: number;
  episodeNumber: number;
}

export function EpisodeCommentsSection({ animeId, episodeNumber }: EpisodeCommentsSectionProps) {
  // This component can be extended to handle seeking to timestamps
  // by communicating with the video player

  const handleSeekToTimestamp = useCallback((timestamp: number) => {
    // Dispatch custom event that the video player can listen to
    window.dispatchEvent(
      new CustomEvent("seekVideo", {
        detail: { timestamp },
      })
    );
  }, []);

  return (
    <div className="mt-6">
      <EpisodeComments
        animeId={animeId}
        episodeNumber={episodeNumber}
        onSeekToTimestamp={handleSeekToTimestamp}
      />
    </div>
  );
}
