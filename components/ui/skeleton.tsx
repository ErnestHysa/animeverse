/**
 * Skeleton Components
 * Loading placeholders with anime aesthetic
 */

import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-muted",
        {
          "rounded-full": variant === "circular",
          "h-4 w-full": variant === "text",
        },
        className
      )}
      {...props}
    />
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="group relative">
      <div className="aspect-[3/4] rounded-xl overflow-hidden">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-5 w-3/4" variant="text" />
        <Skeleton className="h-4 w-1/2" variant="text" />
      </div>
    </div>
  );
}

export function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[60vh] min-h-[400px] rounded-2xl overflow-hidden">
      <Skeleton className="w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
        <Skeleton className="h-10 w-3/4 max-w-md" variant="text" />
        <Skeleton className="h-6 w-1/2 max-w-sm" variant="text" />
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

export function EpisodeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative aspect-video rounded-lg overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Continue Watching Skeleton
 * Horizontal cards for the continue watching section
 */
export function ContinueWatchingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="relative aspect-video rounded-xl bg-muted overflow-hidden">
            {/* Progress bar skeleton */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
              <div className="h-full w-2/3 bg-primary/50 rounded-full" />
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <Skeleton className="h-5 w-full" variant="text" />
            <Skeleton className="h-4 w-1/2" variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Latest Episodes Skeleton
 * Compact horizontal cards for latest episodes section
 */
export function LatestEpisodesSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex gap-3 p-3 rounded-xl bg-muted/30">
            <div className="w-20 h-28 flex-shrink-0 rounded-lg bg-muted" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-5 w-3/4" variant="text" />
              <Skeleton className="h-4 w-1/2" variant="text" />
              <Skeleton className="h-4 w-1/3" variant="text" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Section Header Skeleton
 * For section titles with "View All" links
 */
export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
        <Skeleton className="h-8 w-48" variant="text" />
      </div>
      <Skeleton className="h-5 w-20" variant="text" />
    </div>
  );
}

/**
 * Anime Detail Page Skeletons
 */
export function AnimeDetailHeroSkeleton() {
  return (
    <div className="relative">
      {/* Banner skeleton */}
      <div className="relative h-[40vh] min-h-[300px]">
        <Skeleton className="w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
      </div>

      {/* Content skeleton */}
      <div className="relative -mt-32">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover image skeleton */}
            <div className="flex-shrink-0">
              <div className="relative w-48 md:w-64 aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            </div>

            {/* Info skeleton */}
            <div className="flex-1 space-y-4">
              <Skeleton className="h-12 w-3/4 max-w-lg" variant="text" />
              <Skeleton className="h-6 w-1/2" variant="text" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
              <div className="flex gap-6">
                <Skeleton className="h-16 w-16" variant="circular" />
                <Skeleton className="h-16 w-16" variant="circular" />
                <Skeleton className="h-16 w-16" variant="circular" />
              </div>
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-12 w-32" />
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnimeDetailInfoSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
      {/* Main content skeleton */}
      <div className="lg:col-span-2 space-y-8">
        {/* Synopsis skeleton */}
        <div className="rounded-xl p-6 bg-muted/30">
          <Skeleton className="h-7 w-32 mb-4" variant="text" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-5/6" variant="text" />
            <Skeleton className="h-4 w-4/6" variant="text" />
          </div>
        </div>

        {/* Episodes skeleton */}
        <div className="rounded-xl p-6 bg-muted/30">
          <Skeleton className="h-7 w-24 mb-4" variant="text" />
          <EpisodeGridSkeleton count={10} />
        </div>
      </div>

      {/* Sidebar skeleton */}
      <div className="space-y-6">
        <div className="rounded-xl p-6 bg-muted/30">
          <Skeleton className="h-6 w-24 mb-4" variant="text" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-3/4" variant="text" />
          </div>
        </div>
        <div className="rounded-xl p-6 bg-muted/30">
          <Skeleton className="h-6 w-28 mb-4" variant="text" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-5/6" variant="text" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Watch Page Skeletons
 */
export function VideoPlayerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" variant="text" />
        <Skeleton className="h-4 w-4" variant="circular" />
        <Skeleton className="h-4 w-24" variant="text" />
        <Skeleton className="h-4 w-4" variant="circular" />
        <Skeleton className="h-4 w-20" variant="text" />
      </div>

      {/* Player skeleton */}
      <div className="aspect-video rounded-xl bg-muted animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" variant="text" />
          <Skeleton className="h-4 w-32" variant="text" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  );
}

export function EpisodeListSkeleton() {
  return (
    <div className="rounded-xl p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" variant="text" />
        <Skeleton className="h-4 w-20" variant="text" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Skeleton className="w-8 h-8" variant="circular" />
            <Skeleton className="h-5 flex-1" variant="text" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Search Results Skeleton
 */
export function SearchResultsSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" variant="text" />
          <Skeleton className="h-5 w-48" variant="text" />
        </div>
      </div>
      <AnimeGridSkeleton count={24} />
    </>
  );
}

/**
 * Compact Card Skeleton
 * For horizontal lists (trending, recommendations, etc.)
 */
export function CompactCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl bg-muted/30 animate-pulse">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
            <Skeleton className="w-6 h-6" variant="text" />
          </div>
          <div className="relative w-16 h-24 flex-shrink-0 rounded-lg bg-muted" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-3/4" variant="text" />
            <Skeleton className="h-4 w-1/2" variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
}
