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
        "animate-shimmer rounded-md",
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
