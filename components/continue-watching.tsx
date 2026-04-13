/**
 * Continue Watching Component
 * Shows anime with watch progress
 */

"use client";

import { useEffect, useState, useCallback, memo } from "react";
import { useStore, useWatchHistory } from "@/store";
import type { WatchHistoryItem } from "@/store";
import { anilist } from "@/lib/anilist";
import { Clock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Media } from "@/types/anilist";
import { cn } from "@/lib/utils";

interface AnimeWithProgress {
  anime: Media;
  progress: number;
  episodeNumber: number;
}

export function ContinueWatching() {
  const { getContinueWatching } = useWatchHistory();
  const setMediaCache = useStore((state) => state.setMediaCache);
  const [animeWithProgress, setAnimeWithProgress] = useState<AnimeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContinueWatching = useCallback(async () => {
    try {
      setError(null);
      const history = getContinueWatching(12);
      if (history.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch anime details for each history item
      const animeIds = history.map((h: WatchHistoryItem) => h.mediaId);
      const result = await anilist.getByIds(animeIds);
      const mediaList = result.data?.Page.media ?? [];
      mediaList.forEach((anime: Media) => {
        setMediaCache(anime);
      });

      // Combine anime data with progress
      const combined = history.map((item: WatchHistoryItem) => {
        const anime = mediaList.find((m: Media) => m.id === item.mediaId);
        if (!anime) return null;

        // Calculate progress percentage based on episode duration (default 24 min)
        const episodeDuration = anime.duration || 24;
        const progressPercent = (item.progress / (episodeDuration * 60)) * 100;

        return {
          anime,
          progress: Math.min(progressPercent, 99), // Cap at 99%
          episodeNumber: item.episodeNumber,
        };
      }).filter(Boolean);

      setAnimeWithProgress(combined as AnimeWithProgress[]);
    } catch (err) {
      console.error("Error loading continue watching:", err);
      setError("Failed to load continue watching");
    } finally {
      setLoading(false);
    }
  }, [getContinueWatching, setMediaCache]);

  useEffect(() => {
    loadContinueWatching();
  }, [loadContinueWatching]);

  if (loading) {
    return (
      <section className="mb-16" aria-labelledby="continue-watching-heading">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-primary" aria-hidden="true" />
            <h2 id="continue-watching-heading" className="text-2xl font-display font-semibold">Continue Watching</h2>
          </div>
          <div className="h-6 w-20 bg-muted/30 rounded animate-pulse" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-xl bg-muted" />
              <div className="mt-2 space-y-2">
                <div className="h-5 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return null; // Silently fail for continue watching section
  }

  if (animeWithProgress.length === 0) {
    return null;
  }

  return (
    <section className="mb-16" aria-labelledby="continue-watching-heading">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 id="continue-watching-heading" className="text-2xl font-display font-semibold">Continue Watching</h2>
        </div>
        <Link
          href="/history"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {animeWithProgress.map(({ anime, progress, episodeNumber }) => (
          <ContinueWatchingCard
            key={anime.id}
            anime={anime}
            progress={progress}
            episodeNumber={episodeNumber}
          />
        ))}
      </div>
    </section>
  );
}

// Extracted card component for better memoization
const ContinueWatchingCard = memo(function ContinueWatchingCard({
  anime,
  progress,
  episodeNumber,
}: {
  anime: Media;
  progress: number;
  episodeNumber: number;
}) {
  const title = anime.title?.userPreferred || anime.title?.english || "Unknown";
  const cover = anime.coverImage?.large || anime.coverImage?.medium || "";
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Link
      href={`/watch/${anime.id}/${episodeNumber}`}
      className="group block"
      aria-label={`Continue watching ${title}, episode ${episodeNumber}, ${Math.round(progress)}% complete`}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
        {/* Loading skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted animate-shimmer" />
        )}

        {/* Cover Image */}
        <Image
          src={cover}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, 20vw"
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-105",
            !imageLoaded && "opacity-0"
          )}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Episode Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-primary/80 backdrop-blur-sm rounded-full text-xs font-medium text-white">
          Ep {episodeNumber}
        </div>

        {/* Play Button (on hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-10 h-10 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Clock className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress Percentage */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs font-medium text-white">
          {Math.round(progress)}%
        </div>
      </div>

      {/* Info */}
      <div className="mt-2">
        <h3 className="font-medium text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {anime.format?.replace("_", " ")} • {anime.seasonYear}
        </p>
      </div>
    </Link>
  );
});
