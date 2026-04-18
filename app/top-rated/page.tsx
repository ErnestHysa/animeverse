/**
 * Top Rated Anime Page
 * Highest-scoring finished anime, sorted by average community score.
 * Distinct from /popular (which ranks by view count / community size).
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { anilist } from "@/lib/anilist";
import { Trophy } from "lucide-react";

async function getTopRatedAnime() {
  const result = await anilist.getTopRated(1, 48);
  return result.data?.Page.media ?? [];
}

export default async function TopRatedPage() {
  let anime;
  try {
    anime = await getTopRatedAnime();
  } catch (error) {
    console.error('Failed to load top rated anime:', error);
    return (
      <>
        <Header />
        <main className="min-h-screen">
          <div className="container mx-auto px-4 pt-24 pb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold">Top Rated</h1>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-muted-foreground">Failed to load top rated anime. Please try again later.</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Top Rated</h1>
              <p className="text-muted-foreground">
                Highest-scoring finished anime, ranked by average community rating — not view count
              </p>
            </div>
          </div>

          <AnimeGrid anime={anime} />
        </div>
      </main>
      <Footer />
    </>
  );
}

export const metadata = {
  title: "Top Rated Anime",
  description: "Browse the highest-scoring finished anime of all time, ranked by community ratings.",
};
