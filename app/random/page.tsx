/**
 * Random Anime Discovery Page
 * "I'm feeling lucky" feature for anime discovery
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { anilist } from "@/lib/anilist";
import { Shuffle, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/anime-card";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

async function getRandomAnime() {
  // Get a large batch and pick a random one
  const result = await anilist.getTrending(1, 50);
  const anime = result.data?.Page.media ?? [];

  if (anime.length === 0) {
    // Return a fallback if no anime found
    return null;
  }

  const randomIndex = Math.floor(Math.random() * anime.length);
  return anime[randomIndex];
}

async function getRecommendations(genres?: string[] | null) {
  // Get anime from similar genres
  if (!genres || genres.length === 0) {
    const result = await anilist.getTrending(1, 12);
    return result.data?.Page.media ?? [];
  }

  // Search by first genre
  const result = await anilist.search({
    genre: genres[0]!,
    sort: "SCORE_DESC",
    perPage: 12,
  });

  return result.data?.Page.media ?? [];
}

export default async function RandomPage() {
  const randomAnime = await getRandomAnime();

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
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const recommendations = await getRecommendations(randomAnime.genres);

  const title = randomAnime.title?.userPreferred ??
                randomAnime.title?.english ??
                randomAnime.title?.romaji ??
                "Unknown Anime";

  const description = randomAnime.description ? randomAnime.description.slice(0, 300) : "No description available.";
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
            <Link href="/random">
              <Button>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Another
              </Button>
            </Link>
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
                    <Sparkles className="w-4 h-4" />
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
                  <Button size="lg" asChild>
                    <Link href={`/watch/${randomAnime.id}/1`}>
                      Watch Now
                    </Link>
                  </Button>
                  <Button variant="glass" size="lg" asChild>
                    <Link href={`/anime/${randomAnime.id}`}>
                      View Details
                    </Link>
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
                  .filter(a => a.id !== randomAnime.id)
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

export const metadata = {
  title: "Random Anime",
  description: "Discover new anime with our random picker.",
};

export const revalidate = 60; // Revalidate every minute
export const dynamic = "force-dynamic";
