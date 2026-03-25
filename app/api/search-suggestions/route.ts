/**
 * Search Suggestions API
 * Returns quick anime title suggestions for live search typeahead
 */

import { NextRequest, NextResponse } from "next/server";
import { anilist } from "@/lib/anilist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const result = await anilist.search({
      search: q,
      page: 1,
      perPage: 8,
      sort: "POPULARITY_DESC",
    });

    const suggestions = (result.data?.Page.media ?? []).map((media) => ({
      id: media.id,
      title: media.title.userPreferred || media.title.english || media.title.romaji || "Unknown",
      year: media.seasonYear,
      format: media.format,
      coverImage: media.coverImage?.medium,
    }));

    return NextResponse.json({ suggestions }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
