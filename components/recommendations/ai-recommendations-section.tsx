/**
 * Client-side AI Recommendations Section Wrapper
 * Uses hooks for watch history and favorites
 */

"use client";

import { AIRecommendations } from "@/components/recommendations/ai-recommendations";
import { useWatchHistory, useFavorites } from "@/store";
import type { Media } from "@/types/anilist";

interface AIRecommendationsSectionProps {
  allAnime: Media[];
}

export function AIRecommendationsSection({ allAnime }: AIRecommendationsSectionProps) {
  const { watchHistory } = useWatchHistory();
  const { favorites } = useFavorites();

  // Only show if user has some watch history or favorites
  const hasUserData = watchHistory.length > 0 || favorites.length > 0;

  if (!hasUserData) {
    return null;
  }

  return (
    <AIRecommendations
      allAnime={allAnime}
      watchHistory={watchHistory}
      favorites={favorites}
      limit={12}
      title="AI Picks For You"
    />
  );
}
