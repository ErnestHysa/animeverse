/**
 * Genre Detail Page
 * Shows all anime for a specific genre
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { anilist } from "@/lib/anilist";
import { ArrowLeft, Filter } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import { notFound } from "next/navigation";

interface GenrePageProps {
  params: Promise<{
    genre: string;
  }>;
}

// Genre name mapping from slug to display name
const GENRE_SLUG_TO_NAME: Record<string, string> = {
  "action": "Action",
  "adventure": "Adventure",
  "comedy": "Comedy",
  "drama": "Drama",
  "fantasy": "Fantasy",
  "horror": "Horror",
  "mecha": "Mecha",
  "mystery": "Mystery",
  "romance": "Romance",
  "sci-fi": "Sci-Fi",
  "slice-of-life": "Slice of Life",
  "sports": "Sports",
  "supernatural": "Supernatural",
  "thriller": "Thriller",
  "isekai": "Isekai",
  "martial-arts": "Martial Arts",
  "psychological": "Psychological",
  "super-power": "Super Power",
  "vampire": "Vampire",
  "music": "Music",
  "school": "School",
  "seinen": "Seinen",
  "shoujo": "Shoujo",
  "shounen": "Shounen",
  "game": "Game",
  "harem": "Harem",
  "ecchi": "Ecchi",
  "cyberpunk": "Cyberpunk",
  "demons": "Demons",
  "magic": "Magic",
  "space": "Space",
};

async function getGenreAnime(genreSlug: string, page: number = 1) {
  const genreName = GENRE_SLUG_TO_NAME[genreSlug];

  if (!genreName) {
    return null;
  }

  const result = await anilist.getByGenre(genreName, page, 50);
  return {
    genre: genreName,
    anime: result.data?.Page.media ?? [],
    total: result.data?.Page.pageInfo.total ?? 0,
    hasNextPage: result.data?.Page.pageInfo.hasNextPage ?? false,
  };
}

export async function generateMetadata({ params }: GenrePageProps) {
  const { genre } = await params;
  const genreName = GENRE_SLUG_TO_NAME[genre];

  if (!genreName) {
    return {
      title: "Genre Not Found",
    };
  }

  return {
    title: `${genreName} Anime`,
    description: `Browse all ${genreName.toLowerCase()} anime. Watch the best ${genreName.toLowerCase()} series online for free.`,
  };
}

export default async function GenreDetailPage({ params, searchParams }: GenrePageProps & { searchParams: Promise<{ page?: string }> }) {
  const { genre } = await params;
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam || "1", 10);

  let data;
  try {
    data = await getGenreAnime(genre, page);
  } catch (error) {
    console.error('Failed to load genre page:', error);
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-red-400">Failed to load content</h2>
        <p className="text-gray-400 mt-2">Please try again later.</p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const { genre: genreName, anime, total, hasNextPage } = data;

  if (anime.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Genre Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The genre you&apos;re looking for doesn&apos;t exist or has no anime.
            </p>
            <Link
              href="/genres"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Genres
            </Link>
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
          {/* Back Button */}
          <Link
            href="/genres"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Genres
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Filter className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{genreName} Anime</h1>
              <p className="text-muted-foreground">
                {total.toLocaleString()} title{total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Info Card */}
          <GlassCard className="p-4 mb-8">
            <p className="text-sm text-muted-foreground">
              Browse all {genreName.toLowerCase()} anime. This genre features {total.toLocaleString()} titles
              for you to discover and enjoy.
            </p>
          </GlassCard>

          {/* Anime Grid */}
          <AnimeGrid anime={anime} />

          {/* Pagination */}
          {hasNextPage && (
            <div className="flex justify-center mt-8">
              <Link
                href={`/genre/${genre}?page=${page + 1}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Load More
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate hourly
