/**
 * Seasonal Page
 * Anime from current season
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { AnimeGrid } from "@/components/anime/anime-grid";

import { AnimeGridSkeleton } from "@/components/ui/skeleton";

import { anilist, getCurrentSeason, getCurrentYear } from "@/lib/anilist";

import { Calendar } from "lucide-react";

import { Suspense } from "react";

// ===================================
// Data Fetching
// ===================================

async function getSeasonalAnime() {
  const season = getCurrentSeason();
  const year = getCurrentYear();

  const result = await anilist.getSeasonal(season, year, 1, 48);
  return {
    anime: result.data?.Page.media ?? [],
    season,
    year,
  };
}

// ===================================
// Page Component
// ===================================

export default async function SeasonalPage() {
  const { anime, season, year } = await getSeasonalAnime();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">
                {season} {year} Anime
              </h1>
              <p className="text-muted-foreground">
                Currently airing this season
              </p>
            </div>
          </div>

          {/* Anime Grid */}
          <Suspense fallback={<AnimeGridSkeleton count={24} />}>
            <AnimeGrid anime={anime} priorityFirst />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ===================================
// Metadata
// ===================================

export const metadata = {
  title: "Seasonal",
  description: "Browse anime from the current season.",
};
