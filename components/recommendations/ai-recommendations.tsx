/**
 * AI-Powered Recommendations Component
 * Shows personalized anime recommendations based on watch history
 */

"use client";

import { useEffect, useState } from "react";
import { AnimeCard } from "@/components/anime/anime-card";
import { GlassCard } from "@/components/ui/glass-card";
import { Sparkles, TrendingUp, Heart } from "lucide-react";
import type { Media } from "@/types/anilist";
import type { WatchHistoryItem } from "@/types/anilist";

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

  useEffect(() => {
    async function loadRecommendations() {
      setLoading(true);

      // Simulate AI processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simple recommendation logic (client-side)
      const watchedIds = new Set(watchHistory.map((h) => h.mediaId));
      const favoriteIds = new Set(favorites);

      let scored: RecommendationResult[] = [];

      if (basedOnAnime) {
        // "Because you watched X" recommendations
        scored = allAnime
          .filter((a) => a.id !== basedOnAnime.id)
          .map((anime) => {
            let score = 0;
            const reasons: string[] = [];

            // Genre matching
            if (basedOnAnime.genres && anime.genres) {
              const sharedGenres = basedOnAnime.genres.filter((g) => anime.genres?.includes(g));
              if (sharedGenres.length > 0) {
                score += sharedGenres.length * 15;
                reasons.push(`Similar genres: ${sharedGenres.slice(0, 2).join(", ")}`);
              }
            }

            // Same studio
            if (basedOnAnime.studios?.nodes && anime.studios?.nodes) {
              const sameStudio = basedOnAnime.studios.nodes.some((s1) =>
                anime.studios?.nodes?.some((s2) => s1.name === s2.name)
              );
              if (sameStudio) {
                score += 25;
                reasons.push("Same studio");
              }
            }

            // Same format
            if (basedOnAnime.format === anime.format) {
              score += 10;
              reasons.push("Same format");
            }

            // Quality score
            if (anime.averageScore && anime.averageScore >= 75) {
              score += 10;
              reasons.push("Highly rated");
            }

            // Currently airing
            if (anime.status === "RELEASING") {
              score += 5;
            }

            return { anime, score, reasons, matchPercentage: Math.min(100, score) };
          })
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } else {
        // Personalized recommendations
        // Get favorite genres from watched anime
        const genreCounts = new Map<string, number>();
        const studioCounts = new Map<string, number>();

        watchHistory.forEach((h) => {
          const anime = allAnime.find((a) => a.id === h.mediaId);
          if (anime) {
            anime.genres?.forEach((g) => {
              genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
            });
            anime.studios?.nodes.forEach((s) => {
              studioCounts.set(s.name, (studioCounts.get(s.name) || 0) + 1);
            });
          }
        });

        const topGenres = Array.from(genreCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map((e) => e[0]);

        const topStudios = Array.from(studioCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map((e) => e[0]);

        scored = allAnime
          .filter((a) => !watchedIds.has(a.id))
          .map((anime) => {
            let score = 0;
            const reasons: string[] = [];

            // Genre matching
            if (anime.genres) {
              const matchedGenres = anime.genres.filter((g) => topGenres.includes(g));
              if (matchedGenres.length > 0) {
                score += matchedGenres.length * 15;
                reasons.push(`Matches your interests`);
              }
            }

            // Studio matching
            if (anime.studios?.nodes) {
              const matchedStudio = anime.studios.nodes.some((s) => topStudios.includes(s.name));
              if (matchedStudio) {
                score += 20;
                reasons.push(`From a studio you like`);
              }
            }

            // Highly rated
            if (anime.averageScore && anime.averageScore >= 80) {
              score += 15;
              reasons.push("Critically acclaimed");
            }

            // Trending
            if (anime.trending > 10000) {
              score += 10;
              reasons.push("Trending now");
            }

            // Favorites genre match
            if (favoriteIds.size > 0) {
              const favoriteAnime = allAnime.filter((a) => favoriteIds.has(a.id));
              const favoriteGenres = new Set<string>();
              favoriteAnime.forEach((a) => a.genres?.forEach((g) => favoriteGenres.add(g)));

              if (anime.genres) {
                const favMatch = anime.genres.filter((g) => favoriteGenres.has(g));
                if (favMatch.length > 0) {
                  score += favMatch.length * 10;
                }
              }
            }

            // Currently airing
            if (anime.status === "RELEASING") {
              score += 5;
            }

            return { anime, score, reasons, matchPercentage: Math.min(100, score) };
          })
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }

      setRecommendations(scored);
      setLoading(false);
    }

    loadRecommendations();
  }, [allAnime, watchHistory, favorites, basedOnAnime, limit]);

  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          <h2 className="text-xl font-display font-semibold">
            {title || (basedOnAnime ? "Because You Watched" : "AI Picks For You")}
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

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-semibold">
            {title || (basedOnAnime ? `Because You Watched ${basedOnAnime.title?.romaji}` : "AI Picks For You")}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span>Powered by AI</span>
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
