/**
 * Home Page
 * Trending anime and featured content with Continue Watching
 */
export const dynamic = "force-dynamic";


import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { ContinueWatching } from "@/components/continue-watching";
import { AIRecommendationsSection } from "@/components/recommendations/ai-recommendations-section";
import { GlassCard } from "@/components/ui/glass-card";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { CacheAnime } from "@/components/anime/cache-anime";
import { anilist } from "@/lib/anilist";
import { Button } from "@/components/ui/button";
import { Play, TrendingUp, Star, Clock, Eye } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { Media } from "@/types/anilist";
import {
  HeroSkeleton,
  AnimeGridSkeleton,
  ContinueWatchingSkeleton,
  LatestEpisodesSkeleton,
} from "@/components/ui/skeleton";

interface AiringSchedule {
  id: number;
  timeUntilAiring: number;
  episode: number;
  media: Media;
}

// Client wrapper for buttons with navigation
type ButtonVariant = "default" | "glass" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg" | "icon";

function HeroButton({
  href,
  children,
  variant = "default",
  size = "default"
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} className="no-underline">
      <Button variant={variant} size={size}>
        {children}
      </Button>
    </Link>
  );
}

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

async function getAiringAnime() {
  const result = await anilist.getAiring(1, 12);
  return result.data?.Page.airingSchedules ?? [];
}

async function getMostViewedAnime() {
  // Get page 2 of popular to show different anime than All Time Popular
  const result = await anilist.getPopular(2, 12);
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
          <ImageWithFallback
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
              <HeroButton size="lg" href={`/watch/${featured.id}/1`}>
                <span className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Watch Now
                </span>
              </HeroButton>
              <HeroButton variant="glass" size="lg" href={`/anime/${featured.id}`}>
                <span>View Details</span>
              </HeroButton>
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

async function MostViewedSection({ anime }: { anime: Media[] }) {
  if (anime.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-2xl font-display font-semibold">Most Viewed</h2>
        </div>
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

async function LatestEpisodesSection({ airingSchedules }: { airingSchedules: AiringSchedule[] }) {
  if (airingSchedules.length === 0) return null;

  // Group by anime and get latest episode info
  const latestEpisodes = airingSchedules.slice(0, 12);

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-secondary" />
          </div>
          <h2 className="text-2xl font-display font-semibold">Latest Episodes</h2>
        </div>
        <Link href="/schedule" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View Schedule
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {latestEpisodes.map((item) => {
          const anime = item.media;
          if (!anime) return null;

          const title = anime.title?.userPreferred || anime.title?.english || anime.title?.romaji || "Unknown";
          const cover = anime.coverImage?.large || anime.coverImage?.medium || "";
          const timeUntilAiring = item.timeUntilAiring;
          const isAiringSoon = timeUntilAiring > 0 && timeUntilAiring < 3600; // Less than 1 hour

          return (
            <Link key={item.id} href={`/anime/${anime.id}`} className="group">
              <GlassCard className="overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="relative w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                    <ImageWithFallback
                      src={cover}
                      alt={title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="80px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 bg-primary/20 text-primary rounded">
                        EP {item.episode}
                      </span>
                      {isAiringSoon && (
                        <span className="flex items-center gap-1 text-primary">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                          Airing Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {anime.format?.replace("_", " ")} • {anime.seasonYear}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>
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
  const [trendingAnime, popularAnime, seasonalAnime, airingAnime, mostViewedAnime] = await Promise.all([
    getTrendingAnime(),
    getPopularAnime(),
    getSeasonalAnime(),
    getAiringAnime(),
    getMostViewedAnime(),
  ]);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <CacheAnime media={[...trendingAnime, ...popularAnime, ...seasonalAnime, ...mostViewedAnime]} />

          {/* Hero Section */}
          <Suspense fallback={<HeroSkeleton />}>
            <HeroSection anime={trendingAnime} />
          </Suspense>

          {/* Continue Watching - Client Component */}
          <Suspense fallback={<ContinueWatchingSkeleton />}>
            <ContinueWatching />
          </Suspense>

          {/* Latest Episodes - Recently Updated */}
          <Suspense fallback={<LatestEpisodesSkeleton />}>
            <LatestEpisodesSection airingSchedules={airingAnime} />
          </Suspense>

          {/* AI Recommendations - Personalized Picks */}
          <Suspense fallback={<AnimeGridSkeleton count={6} />}>
            <AIRecommendationsSectionWrapper
              allAnime={[...trendingAnime, ...popularAnime, ...seasonalAnime]}
            />
          </Suspense>

          {/* Trending Section */}
          <TrendingSection anime={trendingAnime} />

          {/* Popular Section */}
          <PopularSection anime={popularAnime} />

          {/* Most Viewed Section */}
          <MostViewedSection anime={mostViewedAnime} />

          {/* Seasonal Section */}
          <SeasonalSection anime={seasonalAnime} />
        </div>
      </main>
      <Footer />
    </>
  );
}
