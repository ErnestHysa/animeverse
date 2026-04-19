/**
 * Genres Browse Page
 * Browse anime by genre/category
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { anilist } from "@/lib/anilist";
import { Tags, Tv } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import Link from "next/link";
import { POPULAR_GENRES } from "@/lib/constants";

// Genre descriptions and colors for visual variety
const GENRE_INFO: Record<string, { description: string; color: string; gradient: string }> = {
  Action: {
    description: "High-energy battles, intense combat, and heroic feats",
    color: "from-red-500/20 to-orange-500/20",
    gradient: "from-red-500 to-orange-500",
  },
  Adventure: {
    description: "Epic journeys to unknown lands and thrilling discoveries",
    color: "from-emerald-500/20 to-teal-500/20",
    gradient: "from-emerald-500 to-teal-500",
  },
  Comedy: {
    description: "Laugh-out-loud moments and hilarious situations",
    color: "from-yellow-500/20 to-amber-500/20",
    gradient: "from-yellow-500 to-amber-500",
  },
  Drama: {
    description: "Emotional stories with deep character development",
    color: "from-purple-500/20 to-pink-500/20",
    gradient: "from-purple-500 to-pink-500",
  },
  Fantasy: {
    description: "Magical worlds, mythical creatures, and enchanting tales",
    color: "from-indigo-500/20 to-violet-500/20",
    gradient: "from-indigo-500 to-violet-500",
  },
  Horror: {
    description: "Spine-chilling tales that will keep you on edge",
    color: "from-gray-700/20 to-slate-900/20",
    gradient: "from-gray-600 to-slate-800",
  },
  Mecha: {
    description: "Giant robots and futuristic technological warfare",
    color: "from-cyan-500/20 to-blue-500/20",
    gradient: "from-cyan-500 to-blue-500",
  },
  Mystery: {
    description: "Intriguing puzzles and suspenseful investigations",
    color: "from-violet-500/20 to-purple-500/20",
    gradient: "from-violet-500 to-purple-500",
  },
  Romance: {
    description: "Heartwarming love stories and emotional connections",
    color: "from-pink-500/20 to-rose-500/20",
    gradient: "from-pink-500 to-rose-500",
  },
  "Sci-Fi": {
    description: "Futuristic technology, space exploration, and scientific wonders",
    color: "from-blue-500/20 to-indigo-500/20",
    gradient: "from-blue-500 to-indigo-500",
  },
  "Slice of Life": {
    description: "Everyday moments and relatable life experiences",
    color: "from-green-500/20 to-lime-500/20",
    gradient: "from-green-500 to-lime-500",
  },
  Sports: {
    description: "Competitive athletics and inspiring underdog stories",
    color: "from-orange-500/20 to-red-500/20",
    gradient: "from-orange-500 to-red-500",
  },
  Supernatural: {
    description: "Ghosts, demons, and otherworldly phenomena",
    color: "from-fuchsia-500/20 to-purple-500/20",
    gradient: "from-fuchsia-500 to-purple-500",
  },
  Thriller: {
    description: "Suspenseful narratives that will keep you guessing",
    color: "from-red-600/20 to-rose-600/20",
    gradient: "from-red-600 to-rose-600",
  },
};

// Additional genres beyond POPULAR_GENRES
const ADDITIONAL_GENRES = [
  "Isekai",
  "Martial Arts",
  "Psychological",
  "Super Power",
  "Vampire",
  "Music",
  "School",
  "Seinen",
  "Shoujo",
  "Shounen",
  "Game",
  "Harem",
  "Ecchi",
  "Cyberpunk",
  "Demons",
  "Magic",
  "Space",
];

async function getGenreData() {
  const genres = [...POPULAR_GENRES, ...ADDITIONAL_GENRES] as const;

  // Fetch anime count for each genre in parallel batches
  const batchSize = 10;
  const genreData: Array<{
    name: string;
    slug: string;
    count: number;
    info: { description: string; color: string; gradient: string };
    sampleAnime: Array<{ id: number; title: string; coverImage: string }>;
  }> = [];

  // Helper to add timeout to individual requests
  const fetchWithTimeout = <T,>(promise: Promise<T>, timeout = 5000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      new Promise<never>((_, reject) =>
        timer = setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  };

  for (let i = 0; i < genres.length; i += batchSize) {
    const batch = genres.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (genre) => {
        const result = await fetchWithTimeout(anilist.getByGenre(genre, 1, 4));
        const anime = result.data?.Page.media ?? [];
        const total = result.data?.Page.pageInfo.total ?? 0;

        return {
          name: genre,
          slug: genre.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          count: total,
          info: GENRE_INFO[genre] || {
            description: `Explore ${genre} anime series`,
            color: "from-primary/20 to-secondary/20",
            gradient: "from-primary to-secondary",
          },
          sampleAnime: anime.slice(0, 4).map((a) => ({
            id: a.id,
            title: a.title.userPreferred || a.title.romaji || "",
            coverImage: a.coverImage.large || a.coverImage.medium || "",
          })),
        };
      })
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        genreData.push(result.value);
      }
    });
  }

  // Sort by count (descending)
  return genreData.sort((a, b) => b.count - a.count);
}

export const metadata = {
  title: "Browse Genres",
  description: "Browse anime by genre. Find your favorite type of anime from action and adventure to romance and slice of life.",
};

export default async function GenresPage() {
  const genreData = await getGenreData();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Tags className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Browse by Genre</h1>
              <p className="text-muted-foreground">
                Find anime that matches your mood and preferences
              </p>
            </div>
          </div>

          {/* Info Card */}
          <GlassCard className="p-4 mb-8">
            <p className="text-sm text-muted-foreground">
              Explore anime across {genreData.length} different genres. From high-octane action to
              heartwarming romance, discover your next favorite series by browsing through categories
              that match your interests.
            </p>
          </GlassCard>

          {/* Genres Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {genreData.map((genre) => (
              <Link key={genre.slug} href={`/genre/${genre.slug}`} className="group">
                <GlassCard className="h-full transition-all hover:ring-2 hover:ring-primary/50 overflow-hidden">
                  {/* Sample Anime Preview */}
                  <div className="grid grid-cols-4 gap-0.5 p-2 bg-gradient-to-br opacity-80 group-hover:opacity-100 transition-opacity">
                    {genre.sampleAnime.length > 0 ? (
                      genre.sampleAnime.map((anime) => (
                        <div key={anime.id} className="relative aspect-[3/4] rounded overflow-hidden bg-muted">
                          <ImageWithFallback
                            src={anime.coverImage}
                            alt={anime.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="80px"
                          />
                        </div>
                      ))
                    ) : (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-[3/4] bg-gradient-to-br from-muted to-muted-foreground/20"
                        />
                      ))
                    )}
                  </div>

                  {/* Genre Info */}
                  <div className="p-4 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {genre.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tv className="w-3 h-3" />
                        <span>{genre.count.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {genre.info.description}
                    </p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>

          {/* Empty State */}
          {genreData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Tags className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Genres Found</h3>
              <p className="text-muted-foreground max-w-sm">
                Unable to load genres at this time. Please try again later.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export const revalidate = 86400; // Revalidate daily
