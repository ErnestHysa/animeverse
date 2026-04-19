/**
 * Seasonal Page
 * Anime from current season
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { AnimeGrid } from "@/components/anime/anime-grid";

import { anilist, getCurrentSeason, getCurrentYear } from "@/lib/anilist";

import { Calendar } from "lucide-react";

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
  try {
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

            {/* Anime Grid — data is already awaited in this server component, no Suspense needed */}
            <AnimeGrid anime={anime} priorityFirst />
          </div>
        </main>
        <Footer />
      </>
    );
  } catch (error) {
    console.error('Failed to load seasonal anime:', error);
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold text-red-400">Failed to load seasonal anime</h2>
          <p className="text-gray-400 mt-2">Please try again later.</p>
        </div>
        <Footer />
      </>
    );
  }
}

// ===================================
// Metadata
// ===================================

export const metadata = {
  title: "Seasonal",
  description: "Browse anime from the current season.",
};
