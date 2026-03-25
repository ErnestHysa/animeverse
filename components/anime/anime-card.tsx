/**
 * AnimeCard Component
 * Displays anime poster with hover effects and metadata
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { memo, useState, useEffect, useRef } from "react";
import { Star, Play, Zap, Clock } from "lucide-react";
import type { Media } from "@/types/anilist";
import { getAnimeTitle, getAnimeCover, formatEpisodeCount, getStarRating } from "@/lib/anilist";
import { cn } from "@/lib/utils";
import { LanguageBadge } from "@/components/ui/badge";

export interface AnimeCardProps {
  anime: Media;
  priority?: boolean;
  showProgress?: boolean;
  progress?: number;
  className?: string;
  showLanguageBadge?: boolean;
  hasDub?: boolean;
}

// Custom hook to get simulcast status without impure render
function useSimulcastStatus(airingAt: number | null | undefined): boolean {
  const [isSimulcast, setIsSimulcast] = useState(false);

  useEffect(() => {
    if (!airingAt) return;

    const checkSimulcast = () => {
      const now = Date.now();
      const airingTime = airingAt * 1000;
      setIsSimulcast(airingTime - now < 24 * 60 * 60 * 1000 && airingTime > now);
    };

    checkSimulcast();
    const interval = setInterval(checkSimulcast, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [airingAt]);

  return isSimulcast;
}

export const AnimeCard = memo(function AnimeCard({
  anime,
  priority = false,
  showProgress = false,
  progress = 0,
  className,
  showLanguageBadge = false,
  hasDub = false,
}: AnimeCardProps) {
  const title = getAnimeTitle(anime);
  const cover = getAnimeCover(anime);
  const rating = getStarRating(anime.averageScore);
  const episodes = formatEpisodeCount(anime.episodes, anime.status);
  const isAiring = anime.status === "RELEASING";
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showHoverPanel, setShowHoverPanel] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Check if simulcast (airs within 24 hours of Japan broadcast)
  const isSimulcast = useSimulcastStatus(anime.nextAiringEpisode?.airingAt);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => setShowHoverPanel(true), 500);
  };
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowHoverPanel(false);
  };

  return (
    <Link
      href={`/anime/${anime.id}`}
      className={cn("group block relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
        {/* Loading skeleton */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-shimmer" />
        )}

        {/* Error placeholder */}
        {imageError && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Play className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Cover Image */}
        <Image
          src={cover}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-105",
            !imageLoaded && "opacity-0"
          )}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Badges Container */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Simulcast Badge */}
          {isSimulcast && (
            <div className="px-2 py-1 bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-sm rounded-full text-xs font-medium text-white flex items-center gap-1">
              <Zap className="w-3 h-3" />
              SIMULCAST
            </div>
          )}

          {/* Airing Badge */}
          {isAiring && !isSimulcast && (
            <div className="px-2 py-1 bg-primary/80 backdrop-blur-sm rounded-full text-xs font-medium text-white flex items-center gap-1">
              <span className="w-1.5 h-1 bg-green-400 rounded-full animate-pulse" />
              AIRING
            </div>
          )}

          {/* Format Badge */}
          {anime.format && (
            <span className="px-1.5 py-0.5 bg-black/70 text-white text-xs rounded font-medium">
              {anime.format.replace("_", " ")}
            </span>
          )}
        </div>

        {/* Episode Badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs font-medium text-white">
          {episodes}
        </div>

        {/* Episode count overlay badge (bottom right, shown when no rating) */}
        {!anime.averageScore && anime.episodes && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
            {anime.episodes} ep
          </span>
        )}

        {/* Language Badge (bottom left) */}
        {showLanguageBadge && (
          <div className="absolute bottom-2 left-2">
            <LanguageBadge sub={true} dub={hasDub} size="sm" />
          </div>
        )}

        {/* Play Button (on hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Progress Bar */}
        {showProgress && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {/* Rating Badge */}
        {anime.averageScore && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{rating}/5</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {anime.format && <span>{anime.format.replace("_", " ")}</span>}
          {anime.seasonYear && <span>• {anime.seasonYear}</span>}
        </div>
      </div>

      {/* Hover Info Panel */}
      {showHoverPanel && (anime.description || (anime.genres && anime.genres.length > 0)) && (
        <div className="absolute left-full top-0 ml-2 w-56 bg-popover border border-white/10 rounded-xl shadow-2xl p-3 z-50 pointer-events-none animate-fadeIn hidden lg:block">
          <p className="font-semibold text-sm mb-2 line-clamp-2">{title}</p>
          {anime.averageScore && (
            <div className="flex items-center gap-1 mb-2 text-xs">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{anime.averageScore / 10}/10</span>
              {anime.episodes && (
                <>
                  <span className="text-muted-foreground mx-1">•</span>
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{anime.episodes} eps</span>
                </>
              )}
            </div>
          )}
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {anime.genres.slice(0, 4).map((g) => (
                <span key={g} className="px-1.5 py-0.5 bg-white/10 rounded text-xs">{g}</span>
              ))}
            </div>
          )}
          {anime.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {anime.description.replace(/<[^>]*>/g, "")}
            </p>
          )}
        </div>
      )}
    </Link>
  );
});

/**
 * Compact AnimeCard variant for horizontal lists
 */
export interface AnimeCardCompactProps {
  anime: Media;
  showNumber?: boolean;
  number?: number;
  className?: string;
}

export const AnimeCardCompact = memo(function AnimeCardCompact({ anime, showNumber = false, number, className }: AnimeCardCompactProps) {
  const title = getAnimeTitle(anime);
  const cover = getAnimeCover(anime);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Link href={`/anime/${anime.id}`} className={cn("flex gap-3 group", className)}>
      {/* Rank Number */}
      {showNumber && number !== undefined && (
        <div className="flex-shrink-0 w-8 flex items-center justify-center text-2xl font-bold text-muted-foreground group-hover:text-primary transition-colors">
          {number}
        </div>
      )}

      {/* Cover Image */}
      <div className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
        {/* Loading skeleton */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-shimmer" />
        )}

        {/* Error placeholder */}
        {imageError && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/5" />
          </div>
        )}

        <Image
          src={cover}
          alt={title}
          fill
          sizes="64px"
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-105",
            !imageLoaded && "opacity-0"
          )}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {anime.format && <span>{anime.format.replace("_", " ")}</span>}
          {anime.seasonYear && <span>• {anime.seasonYear}</span>}
          {anime.episodes && <span>• {anime.episodes} eps</span>}
        </div>
        {anime.genres && anime.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {anime.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 text-xs bg-white/5 rounded-full"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
});
