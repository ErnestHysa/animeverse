/**
 * Client-side AI Recommendations Section Wrapper
 * Uses hooks for watch history and favorites
 */

"use client";

import { AIRecommendations } from "@/components/recommendations/ai-recommendations";
import { useWatchHistory, useFavorites, useMediaCache } from "@/store";
import { useMemo } from "react";
import type { Media } from "@/types/anilist";

interface AIRecommendationsSectionProps {
  allAnime: Media[];
}

export function AIRecommendationsSection({ allAnime }: AIRecommendationsSectionProps) {
  const { watchHistory } = useWatchHistory();
  const { favorites } = useFavorites();
  const { mediaCache } = useMediaCache();

  // Merge allAnime with mediaCache to enrich recommendations with watched anime details
  const enrichedAnime = useMemo(() => {
    const animeMap = new Map<number, Media>();
    // Add allAnime first
    allAnime.forEach((a) => animeMap.set(a.id, a));
    // Add cached media (includes watched anime details)
    Object.values(mediaCache).forEach((a) => {
      if (a && !animeMap.has(a.id)) {
        animeMap.set(a.id, a);
      }
    });
    return Array.from(animeMap.values());
  }, [allAnime, mediaCache]);

  // Only show if user has some watch history or favorites
  const hasUserData = watchHistory.length > 0 || favorites.length > 0;

  if (!hasUserData) {
    return null;
  }

  return (
    <AIRecommendations
      allAnime={enrichedAnime}
      watchHistory={watchHistory}
      favorites={favorites}
      limit={12}
      title="AI Picks For You"
    />
  );
}
