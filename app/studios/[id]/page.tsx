/**
 * Studio Detail Page
 * Shows all anime from a specific studio
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { anilist } from "@/lib/anilist";
import { Building2, ArrowLeft } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import { notFound } from "next/navigation";

interface StudioPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getStudioAnime(studioIdNum: number) {
  const result = await anilist.getByStudio(studioIdNum, 1, 50);
  return {
    anime: result.data?.Page.media ?? [],
    total: result.data?.Page.pageInfo.total ?? 0,
  };
}

export default async function StudioDetailPage({ params }: StudioPageProps) {
  const { id } = await params;

  // L4: NaN guard for studioId
  const studioIdNum = parseInt(id, 10);
  if (isNaN(studioIdNum) || studioIdNum <= 0) {
    return notFound();
  }

  let anime: Awaited<ReturnType<typeof getStudioAnime>>["anime"];
  let total: number;
  try {
    const data = await getStudioAnime(studioIdNum);
    anime = data.anime;
    total = data.total;
  } catch (error) {
    console.error('Failed to load studio page:', error);
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-red-400">Failed to load content</h2>
        <p className="text-gray-400 mt-2">Please try again later.</p>
      </div>
    );
  }

  if (anime.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Studio Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The studio you&apos;re looking for doesn&apos;t exist or has no anime.
            </p>
            <Link
              href="/studios"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Studios
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Get studio name from first anime
  const studioName = anime[0]?.studios?.nodes.find((s) => s.id === studioIdNum)?.name || "Unknown Studio";

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Back Button */}
          <Link
            href="/studios"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Studios
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{studioName}</h1>
              <p className="text-muted-foreground">
                {total} anime{total !== 1 ? "" : ""}
              </p>
            </div>
          </div>

          {/* Info Card */}
          <GlassCard className="p-4 mb-8">
            <p className="text-sm text-muted-foreground">
              Browse all anime produced by {studioName}. Click on any anime to view details and start watching.
            </p>
          </GlassCard>

          {/* Anime Grid */}
          <AnimeGrid anime={anime} />
        </div>
      </main>
      <Footer />
    </>
  );
}

export const dynamic = "force-dynamic";
