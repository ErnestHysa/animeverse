/**
 * Favorites Page
 * User's favorite anime list
 */

"use client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeCard } from "@/components/anime/anime-card";
import { useFavorites } from "@/store";
import { Heart } from "lucide-react";
import { anilist } from "@/lib/anilist";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Media } from "@/types/anilist";

export default function FavoritesPage() {
  const { favorites } = useFavorites();
  const [anime, setAnime] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      if (favorites.length > 0) {
        const result = await anilist.getByIds(favorites);
        const fetchedAnime = result.data?.Page.media.filter((m: Media) =>
          favorites.includes(m.id)
        ) ?? [];
        setAnime(fetchedAnime);
      }
      setLoading(false);
    }

    loadFavorites();
  }, [favorites]);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center gap-3 mb-8">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
            <div>
              <h1 className="text-3xl font-display font-bold">My Favorites</h1>
              <p className="text-muted-foreground">
                {favorites.length > 0
                  ? `${favorites.length} anime in your favorites`
                  : "No favorites yet"}
              </p>
            </div>
          </div>

          {loading ? (
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
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No favorites yet</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Start adding anime to your favorites to build your personal collection.
              </p>
              <Link
                href="/"
                className="px-6 py-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors inline-block"
              >
                Browse Anime
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {anime.map((item) => (
                <AnimeCard key={item.id} anime={item} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
