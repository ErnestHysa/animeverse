/**
 * Home Page
 * Trending anime and featured content with Continue Watching
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { ContinueWatching } from "@/components/continue-watching";
import { AIRecommendationsSection } from "@/components/recommendations/ai-recommendations-section";
import { anilist } from "@/lib/anilist";
import { Button } from "@/components/ui/button";
import { Play, TrendingUp, Star, Clock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Media } from "@/types/anilist";

// ===================================
// Data Fetching
// ===================================

async function getTrendingAnime() {
  const result = await anilist.getTrending(1, 24);
  return result.data?.Page.media ?? [];
}

async function getPopularAnime() {
  const result = await anilist.getPopular(1, 12);
  return result.data?.Page.media ?? [];
}

async function getSeasonalAnime() {
  // Use current season and year from anilist helper
  const { getCurrentSeason, getCurrentYear } = await import("@/lib/anilist");
  const season = getCurrentSeason();
  const year = getCurrentYear();
  const result = await anilist.getSeasonal(season, year, 1, 6);
  return result.data?.Page.media ?? [];
}

// ===================================
// Components
// ===================================

async function HeroSection({ anime }: { anime: Media[] }) {
  const featured = anime[0];

  if (!featured) return null;

  const title = featured.title?.userPreferred || featured.title?.english || featured.title?.romaji || "Unknown";
  const cover = featured.bannerImage || featured.coverImage?.extraLarge || "";
  const description = featured.description?.slice(0, 200) + "...";

  return (
    <section className="relative h-[60vh] min-h-[400px] md:h-[70vh] rounded-2xl overflow-hidden mb-12 group">
      {/* Background Image */}
      {cover && (
        <div className="absolute inset-0">
          <Image
            src={cover}
            alt={title}
            fill
            priority
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
        <div className="container mx-auto">
          <div className="max-w-2xl space-y-4 animate-slideUp">
            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                Featured
              </span>
              {featured.genres?.slice(0, 3).map((genre: string) => (
                <span
                  key={genre}
                  className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm"
                >
                  {genre}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-display font-bold text-gradient">
              {title}
            </h1>

            {/* Description */}
            <p className="text-muted-foreground text-sm md:text-base line-clamp-3">
              {description}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {featured.averageScore && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{featured.averageScore / 10}/10</span>
                </div>
              )}
              {featured.episodes && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{featured.episodes} episodes</span>
                </div>
              )}
              {featured.format && <span>{featured.format.replace("_", " ")}</span>}
              {featured.seasonYear && <span>{featured.seasonYear}</span>}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link href={`/watch/${featured.id}/1`}>
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Watch Now
                  </span>
                </Link>
              </Button>
              <Button variant="glass" size="lg" asChild>
                <Link href={`/anime/${featured.id}`}>
                  <span>View Details</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

async function TrendingSection({ anime }: { anime: Media[] }) {
  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-display font-semibold">Trending Now</h2>
        </div>
        <Link href="/trending" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View All
        </Link>
      </div>
      <AnimeGrid anime={anime} priorityFirst />
    </section>
  );
}

async function PopularSection({ anime }: { anime: Media[] }) {
  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-semibold">All Time Popular</h2>
        <Link href="/popular" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View All
        </Link>
      </div>
      <AnimeGrid anime={anime} />
    </section>
  );
}

async function SeasonalSection({ anime }: { anime: Media[] }) {
  if (anime.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-semibold">This Season</h2>
        <Link href="/seasonal" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View All
        </Link>
      </div>
      <AnimeGrid anime={anime} />
    </section>
  );
}

// ===================================
// AI Recommendations Wrapper
// ===================================

async function AIRecommendationsSectionWrapper({ allAnime }: { allAnime: Media[] }) {
  // Pass data to client component
  return <AIRecommendationsSection allAnime={allAnime} />;
}

// ===================================
// Page Component
// ===================================

export default async function HomePage() {
  const [trendingAnime, popularAnime, seasonalAnime] = await Promise.all([
    getTrendingAnime(),
    getPopularAnime(),
    getSeasonalAnime(),
  ]);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Hero Section */}
          <Suspense fallback={<div className="h-[50vh] bg-muted rounded-xl animate-pulse" />}>
            <HeroSection anime={trendingAnime} />
          </Suspense>

          {/* Continue Watching - Client Component */}
          <ContinueWatching />

          {/* AI Recommendations - Personalized Picks */}
          <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
            <AIRecommendationsSectionWrapper
              allAnime={[...trendingAnime, ...popularAnime, ...seasonalAnime]}
            />
          </Suspense>

          {/* Trending Section */}
          <TrendingSection anime={trendingAnime} />

          {/* Popular Section */}
          <PopularSection anime={popularAnime} />

          {/* Seasonal Section */}
          <SeasonalSection anime={seasonalAnime} />
        </div>
      </main>
      <Footer />
    </>
  );
}
