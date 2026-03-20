/**
 * AnimeGrid Component
 * Responsive grid layout for anime cards
 */

import { memo } from "react";
import type { Media } from "@/types/anilist";
import { AnimeCard } from "./anime-card";

export interface AnimeGridProps {
  anime: Media[];
  priorityFirst?: boolean;
  className?: string;
  loading?: boolean;
}

// Memoized empty state component
const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2">No anime found</h3>
      <p className="text-muted-foreground max-w-sm">
        Try adjusting your search or filters to find what you&apos;re looking for.
      </p>
    </div>
  );
});

// Memoized grid item to prevent re-renders
const GridItem = memo(function GridItem({
  item,
  priority,
}: {
  item: Media;
  priority: boolean;
}) {
  return <AnimeCard anime={item} priority={priority} />;
});

// Memoized anime grid component
export const AnimeGrid = memo(function AnimeGrid({
  anime,
  priorityFirst = false,
  className,
  loading = false,
}: AnimeGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[3/4] rounded-xl bg-muted" />
            <div className="mt-3 space-y-2">
              <div className="h-5 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (anime.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {anime.map((item, index) => (
          <GridItem
            key={item.id}
            item={item}
            priority={priorityFirst && index < 6}
          />
        ))}
      </div>
    </div>
  );
});
