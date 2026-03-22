/**
 * Watchlist Page
 * User's watchlist (plan to watch)
 */

"use client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeCard } from "@/components/anime/anime-card";
import { useWatchlist, useStore } from "@/store";
import { Clock } from "lucide-react";
import { anilist } from "@/lib/anilist";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Media } from "@/types/anilist";

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();
  const { mediaCache } = useStore();
  const [anime, setAnime] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWatchlist() {
      if (watchlist.length === 0) {
        setLoading(false);
        return;
      }

      // First, try to get from mediaCache (populated by AniList sync)
      const cachedAnime: Media[] = [];
      const missingIds: number[] = [];

      for (const id of watchlist) {
        if (mediaCache[id]) {
          cachedAnime.push(mediaCache[id]);
        } else {
          missingIds.push(id);
        }
      }

      // Fetch missing anime from AniList API
      let fetchedAnime: Media[] = [];
      if (missingIds.length > 0) {
        try {
          const result = await anilist.getByIds(missingIds);
          fetchedAnime = result.data?.Page.media.filter((m: Media) =>
            watchlist.includes(m.id)
          ) ?? [];
        } catch (error) {
          console.error("Failed to fetch watchlist from AniList:", error);
        }
      }

      // Combine cached and fetched anime
      setAnime([...cachedAnime, ...fetchedAnime]);
      setLoading(false);
    }

    loadWatchlist();
  }, [watchlist, mediaCache]);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center gap-3 mb-8">
            <Clock className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">My Watchlist</h1>
              <p className="text-muted-foreground">
                {watchlist.length > 0
                  ? `${watchlist.length} anime in your watchlist`
                  : "Your watchlist is empty"}
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
          ) : watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Your watchlist is empty</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Add anime to your watchlist to keep track of what you want to watch.
              </p>
              <Link
                href="/"
                className="px-6 py-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors inline-block"
              >
                Browse Anime
              </Link>
            </div>
          ) : anime.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
              <h3 className="text-lg font-medium mb-2">Sync Your Watchlist</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Sync your AniList account to see your plan to watch anime here.
              </p>
              <Link
                href="/settings"
                className="px-6 py-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors inline-block"
              >
                Go to Settings
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
