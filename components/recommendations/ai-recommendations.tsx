/**
 * Personalized Recommendations Component
 * Shows personalized anime recommendations based on watch history
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimeCard } from "@/components/anime/anime-card";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionErrorFallback } from "@/components/error/error-fallback";
import { Zap, TrendingUp, Heart } from "lucide-react";
import type { Media } from "@/types/anilist";
import type { WatchHistoryItem } from "@/types/anilist";
import {
  getBecauseYouWatched,
  getPersonalizedRecommendations,
} from "@/lib/recommendations";

interface RecommendationResult {
  anime: Media;
  score: number;
  reasons: string[];
  matchPercentage: number;
}

interface AIRecommendationsProps {
  allAnime: Media[];
  watchHistory: WatchHistoryItem[];
  favorites: number[];
  basedOnAnime?: Media;
  limit?: number;
  title?: string;
}

export function AIRecommendations({
  allAnime,
  watchHistory,
  favorites,
  basedOnAnime,
  limit = 12,
  title,
}: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const scored = basedOnAnime
        ? await getBecauseYouWatched(basedOnAnime.id, allAnime)
        : await getPersonalizedRecommendations(allAnime, watchHistory, favorites);

      // Deduplicate by anime ID to avoid React key errors
      const uniqueRecommendations = Array.from(
        new Map(scored.map((r) => [r.anime.id, r])).values()
      ).slice(0, limit);

      setRecommendations(uniqueRecommendations);
    } catch (err) {
      console.error("Error loading recommendations:", err);
      setError("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }, [allAnime, watchHistory, favorites, basedOnAnime, limit]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-6 h-6 text-primary animate-pulse" />
          <h2 className="text-xl font-display font-semibold">
            {title || (basedOnAnime ? "Because You Watched" : "Picked For You")}
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <SectionErrorFallback
        title="Recommendations unavailable"
      />
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-semibold">
            {title || (basedOnAnime ? `Because You Watched ${basedOnAnime.title?.romaji}` : "Picked For You")}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span>Based on your watch history</span>
        </div>
      </div>

      {/* Top recommendation with reasons */}
      {recommendations[0].reasons.length > 0 && (
        <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm font-medium mb-2">Why we recommend this:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {recommendations[0].reasons.map((reason, i) => (
              <li key={i} className="flex items-center gap-2">
                <Heart className="w-3 h-3 text-primary fill-primary" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {recommendations.map((rec) => (
          <div key={rec.anime.id} className="relative group">
            <AnimeCard anime={rec.anime} />
            {rec.matchPercentage >= 70 && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-primary/90 rounded text-xs font-medium">
                {rec.matchPercentage}% Match
              </div>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
