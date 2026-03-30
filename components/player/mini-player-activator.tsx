"use client";

import { useEffect } from "react";
import { useStore } from "@/store";

interface MiniPlayerActivatorProps {
  animeId: number;
  animeTitle: string;
  episode: number;
  coverImage?: string;
}

/**
 * Registers the current watch session in the mini player store.
 * When the user navigates away, the MiniPlayer component picks this up
 * and shows the floating bar at the bottom of every page.
 */
export function MiniPlayerActivator({
  animeId,
  animeTitle,
  episode,
  coverImage,
}: MiniPlayerActivatorProps) {
  const setMiniPlayer = useStore((s) => s.setMiniPlayer);

  useEffect(() => {
    setMiniPlayer({ animeId, animeTitle, episode, coverImage });
    // Don't clear on unmount — we want it to persist after navigation
  }, [animeId, animeTitle, episode, coverImage, setMiniPlayer]);

  return null;
}
