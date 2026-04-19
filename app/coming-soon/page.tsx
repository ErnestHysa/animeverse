/**
 * Coming Soon Page
 * Shows upcoming anime that haven't aired yet
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { AnimeGrid } from "@/components/anime/anime-grid";

import { anilist } from "@/lib/anilist";

import { Calendar, Info } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

export const metadata = {
  title: "Coming Soon",
  description: "Upcoming anime releases and announcements.",
};

async function getUpcomingAnime() {
  const { getCurrentSeason, getCurrentYear } = await import("@/lib/anilist");

  const currentSeason = getCurrentSeason();
  const currentYear = getCurrentYear();

  // Calculate next season
  const seasons: Array<"WINTER" | "SPRING" | "SUMMER" | "FALL"> = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const currentSeasonIndex = seasons.indexOf(currentSeason);
  const nextSeasonIndex = (currentSeasonIndex + 1) % 4;
  const nextSeason = seasons[nextSeasonIndex];
  const nextYear = nextSeasonIndex < currentSeasonIndex ? currentYear + 1 : currentYear;

  // Fetch multiple sources for upcoming anime
  const [notYetReleased, nextSeasonAnime] = await Promise.all([
    // Anime that hasn't been released yet
    anilist.search({
      page: 1,
      perPage: 12,
      sort: "POPULARITY_DESC",
      status: "NOT_YET_RELEASED",
    }),
    // Next season anime
    anilist.getSeasonal(nextSeason, nextYear, 1, 12),
  ]);

  const notYetReleasedAnime = notYetReleased.data?.Page.media ?? [];
  const nextSeasonAnimeList = nextSeasonAnime.data?.Page.media ?? [];

  // Combine and deduplicate
  const combined = [...notYetReleasedAnime, ...nextSeasonAnimeList];
  const uniqueAnime = combined.filter((anime, index, self) =>
    index === self.findIndex((a) => a.id === anime.id)
  );

  return uniqueAnime;
}

export default async function ComingSoonPage() {
  const upcomingAnime = await getUpcomingAnime();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Coming Soon</h1>
              <p className="text-muted-foreground">
                Upcoming anime releases and announcements
              </p>
            </div>
          </div>

          {/* Info Card */}
          <GlassCard className="p-4 mb-8">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                This page shows anime that has been announced but hasn&apos;t started airing yet.
                Release dates are subject to change.
              </p>
            </div>
          </GlassCard>

          {/* Anime Grid */}
          {upcomingAnime.length > 0 ? (
            <AnimeGrid anime={upcomingAnime} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Upcoming Anime</h3>
              <p className="text-muted-foreground max-w-sm">
                Check back later for new anime announcements.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export const revalidate = 3600; // Revalidate every hour
