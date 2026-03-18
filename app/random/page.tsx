/**
 * Random Anime Discovery Page
 * "I'm feeling lucky" feature for anime discovery
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { anilist } from "@/lib/anilist";
import { Shuffle, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/anime-card";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import type { Media } from "@/types/anilist";

// ===================================
// Data Fetching
// ===================================

async function getRandomAnime(): Promise<Media | null> {
  const result = await anilist.getTrending(1, 50);
  const anime = result.data?.Page.media ?? [];

  if (anime.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * anime.length);
  return anime[randomIndex];
}

async function getRecommendations(genres?: string[] | null): Promise<Media[]> {
  if (!genres || genres.length === 0) {
    const result = await anilist.getTrending(1, 12);
    return result.data?.Page.media ?? [];
  }

  const result = await anilist.search({
    genre: genres[0]!,
    sort: "SCORE_DESC",
    perPage: 12,
  });

  return result.data?.Page.media ?? [];
}

// ===================================
// Page Component
// ===================================

export default function RandomPage() {
  const router = useRouter();
  const [randomAnime, setRandomAnime] = useState<Media | null>(null);
  const [recommendations, setRecommendations] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const anime = await getRandomAnime();
      if (!anime) {
        setLoading(false);
        return;
      }
      setRandomAnime(anime);
      const recs = await getRecommendations(anime.genres);
      setRecommendations(recs);
    } catch (err) {
      console.error("Failed to load random anime:", err);
      setError("Failed to load anime. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Finding anime for you...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Error</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!randomAnime) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">No Anime Found</h1>
            <p className="text-muted-foreground mb-4">
              Unable to fetch anime at this time.
            </p>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const title = randomAnime.title?.userPreferred ??
                randomAnime.title?.english ??
                randomAnime.title?.romaji ??
                "Unknown Anime";

  const description = randomAnime.description
    ? randomAnime.description.slice(0, 300)
    : "No description available.";
  const cover = randomAnime.bannerImage ?? randomAnime.coverImage?.extraLarge ?? "";

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Shuffle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold">
                  Discover Anime
                </h1>
                <p className="text-muted-foreground">
                  Find your next favorite anime
                </p>
              </div>
            </div>
            <Button onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Another
            </Button>
          </div>

          {/* Featured Random Anime */}
          <GlassCard className="mb-8 overflow-hidden">
            <div className="relative h-[400px] md:h-[500px]">
              {cover && (
                <Image
                  src={cover}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                  sizes="100vw"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    Random Pick
                  </span>
                  {randomAnime.averageScore && (
                    <span className="px-3 py-1 bg-white/10 rounded-full text-sm flex items-center gap-1">
                      ⭐ {randomAnime.averageScore / 10}/10
                    </span>
                  )}
                  {randomAnime.format && (
                    <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                      {randomAnime.format.replace("_", " ")}
                    </span>
                  )}
                </div>

                <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-gradient">
                  {title}
                </h2>

                {description && (
                  <p className="text-muted-foreground text-sm md:text-base line-clamp-3 mb-6 max-w-3xl">
                    {description}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => router.push(`/watch/${randomAnime.id}/1`)}
                  >
                    Watch Now
                  </Button>
                  <Button
                    variant="glass"
                    size="lg"
                    onClick={() => router.push(`/anime/${randomAnime.id}`)}
                  >
                    View Details
                  </Button>
                </div>

                {/* Genres */}
                {randomAnime.genres && randomAnime.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {randomAnime.genres.slice(0, 6).map((genre) => (
                      <Link
                        key={genre}
                        href={`/search?q=&genre=${genre}`}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-colors"
                      >
                        {genre}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* More Like This */}
          {recommendations.length > 0 && (
            <div>
              <h3 className="text-2xl font-display font-semibold mb-6">
                More Like This
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {recommendations
                  .filter((a) => a.id !== randomAnime.id)
                  .slice(0, 12)
                  .map((anime) => (
                    <AnimeCard key={anime.id} anime={anime} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
