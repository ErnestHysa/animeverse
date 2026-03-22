/**
 * Anime Actions Component
 * Client-side buttons for watchlist, favorites, and sharing
 */

"use client";

import { Plus, Check, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist, useFavorites } from "@/store";
import { useSyncExternalStore } from "react";
import { ShareButton } from "@/components/player/share-dialog";

interface AnimeActionsProps {
  animeId: number;
  animeTitle?: string;
}

export function AnimeActions({ animeId, animeTitle }: AnimeActionsProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Track if component is client-mounted for hydration safety
  // Using useSyncExternalStore for proper client detection
  const isClient = useSyncExternalStore(
    () => () => {}, // No subscription needed
    () => true, // Client snapshot
    () => false, // Server snapshot
  );

  if (!isClient) {
    return (
      <>
        <Button variant="glass" size="lg" disabled>
          <Plus className="w-5 h-5 mr-2" />
          Add to List
        </Button>
        <Button variant="glass" size="lg" disabled>
          <Heart className="w-5 h-5 mr-2" />
          Favorite
        </Button>
        <Button variant="glass" size="lg" disabled>
          <Share2 className="w-5 h-5 mr-2" />
          Share
        </Button>
      </>
    );
  }

  const inWatchlist = isInWatchlist(animeId);
  const isFav = isFavorite(animeId);

  return (
    <>
      <Button
        variant="glass"
        size="lg"
        onClick={() => toggleWatchlist(animeId)}
        className={inWatchlist ? "bg-primary/20 text-primary" : ""}
        aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
        aria-pressed={inWatchlist}
      >
        {inWatchlist ? (
          <Check className="w-5 h-5 mr-2" />
        ) : (
          <Plus className="w-5 h-5 mr-2" />
        )}
        {inWatchlist ? "In Watchlist" : "Add to List"}
      </Button>
      <Button
        variant="glass"
        size="lg"
        onClick={() => toggleFavorite(animeId)}
        className={isFav ? "bg-red-500/20 text-red-400" : ""}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFav}
      >
        <Heart className={`w-5 h-5 mr-2 ${isFav ? "fill-red-400" : ""}`} />
        {isFav ? "Favorited" : "Favorite"}
      </Button>
      <ShareButton title={animeTitle || "Anime"} />
    </>
  );
}
