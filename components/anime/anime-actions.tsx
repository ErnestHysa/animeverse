/**
 * Anime Actions Component
 * Client-side buttons for watchlist and favorites
 */

"use client";

import { Plus, Check, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist, useFavorites } from "@/store";
import { useEffect, useState } from "react";

interface AnimeActionsProps {
  animeId: number;
}

export function AnimeActions({ animeId }: AnimeActionsProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
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
      >
        <Heart className={`w-5 h-5 mr-2 ${isFav ? "fill-red-400" : ""}`} />
        {isFav ? "Favorited" : "Favorite"}
      </Button>
    </>
  );
}
