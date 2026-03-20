# Recommended Features Implementation Guide

This guide provides implementation details for the recommended features based on competitor analysis.

---

## 1. Most Viewed Section (HIGH PRIORITY)

### Description
Add a "Most Viewed" section to the homepage showing the most-watched anime currently.

### Implementation

**Location:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/app/page.tsx`

Add after TrendingSection:

```typescript
async function getMostViewedAnime() {
  // Use AniList's popularity sort with a higher page count
  const result = await anilist.getPopular(1, 12);
  return result.data?.Page.media ?? [];
}

async function MostViewedSection({ anime }: { anime: Media[] }) {
  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-display font-semibold">Most Viewed</h2>
        </div>
        <Link href="/most-viewed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View All
        </Link>
      </div>
      <AnimeGrid anime={anime} />
    </section>
  );
}
```

**API Call:** AniList already supports this with `sort: POPULARITY`

---

## 2. Enhanced Episode List (HIGH PRIORITY)

### Description
Add episode thumbnails, air dates, and filler indicators to episode lists.

### Implementation

**New Component:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/components/anime/enhanced-episode-list.tsx`

```typescript
interface EnhancedEpisodeListProps {
  animeId: number;
  episodes: number;
  currentEpisode: number;
}

export function EnhancedEpisodeList({ animeId, episodes, currentEpisode }: EnhancedEpisodeListProps) {
  // Fetch episode thumbnails from API
  // Show air dates if available
  // Mark filler episodes (could integrate with animefillerlist.com API)
  // Show watched progress

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: episodes }).map((_, i) => {
        const epNumber = i + 1;
        const isFiller = false; // TODO: Integrate filler API
        const isWatched = false; // TODO: Check watch history

        return (
          <Link
            key={epNumber}
            href={`/watch/${animeId}/${epNumber}`}
            className={cn(
              "relative group aspect-video rounded-lg overflow-hidden bg-muted",
              epNumber === currentEpisode && "ring-2 ring-primary"
            )}
          >
            {/* Thumbnail */}
            <div className="absolute inset-0">
              <img
                src={`thumbnail-${epNumber}.jpg`}
                alt={`Episode ${epNumber}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
            </div>

            {/* Episode Number Badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded text-xs font-medium">
              EP {epNumber}
            </div>

            {/* Filler Badge */}
            {isFiller && (
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-orange-500/80 rounded text-xs">
                Filler
              </div>
            )}

            {/* Watched Indicator */}
            {isWatched && (
              <div className="absolute bottom-2 right-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            )}

            {/* Current Episode Indicator */}
            {epNumber === currentEpisode && (
              <div className="absolute inset-0 ring-2 ring-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
```

---

## 3. Related Anime Section (MEDIUM PRIORITY)

### Description
Show "More like this" and "From the same studio" sections on anime detail pages.

### Implementation

**New Component:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/components/anime/related-anime.tsx`

```typescript
interface RelatedAnimeProps {
  animeId: number;
  genres: string[];
  studio?: string;
}

export async function RelatedAnime({ animeId, genres, studio }: RelatedAnimeProps) {
  // Fetch similar anime by genre
  const similarByGenre = await anilist.searchByGenre(genres.slice(0, 3), 6);

  // Fetch anime by same studio
  const byStudio = studio ? await anilist.searchByStudio(studio, 6) : [];

  return (
    <div className="space-y-8">
      {/* More like this */}
      {similarByGenre.length > 0 && (
        <section>
          <h3 className="text-xl font-semibold mb-4">More like this</h3>
          <AnimeGrid anime={similarByGenre.filter(a => a.id !== animeId)} />
        </section>
      )}

      {/* From the same studio */}
      {byStudio.length > 0 && (
        <section>
          <h3 className="text-xl font-semibold mb-4">From {studio}</h3>
          <AnimeGrid anime={byStudio.filter(a => a.id !== animeId)} />
        </section>
      )}
    </div>
  );
}
```

---

## 4. Coming Soon Page (LOW PRIORITY)

### Description
A page showcasing upcoming anime announcements and seasonal previews.

### Implementation

**New Page:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/app/coming-soon/page.tsx`

```typescript
export default async function ComingSoonPage() {
  // Fetch upcoming anime from AniList
  const upcoming = await anilist.getUpcoming();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <h1 className="text-3xl font-display font-bold mb-8">Coming Soon</h1>

          {/* Group by season */}
          {upcoming.map((season) => (
            <section key={season.season} className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                {season.season} {season.year}
              </h2>
              <AnimeGrid anime={season.anime} />
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
```

---

## 5. History Page (LOW PRIORITY)

### Description
Full watch history with search and filter capabilities.

### Implementation

**New Page:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/app/history/page.tsx`

```typescript
"use client";

import { useWatchHistory } from "@/store";

export default function HistoryPage() {
  const { history } = useWatchHistory();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <h1 className="text-3xl font-display font-bold mb-8">Watch History</h1>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Search history..."
              className="px-4 py-2 bg-muted rounded-lg"
            />
            <select className="px-4 py-2 bg-muted rounded-lg">
              <option>All Time</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 3 months</option>
            </select>
          </div>

          {/* History List */}
          <div className="space-y-4">
            {history.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

---

## 6. Genres Page Enhancement (MEDIUM PRIORITY)

### Description
Create a dedicated genres browse page with A-Z listing.

### Implementation

**Update:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/app/genres/page.tsx`

```typescript
const ALL_GENRES = [
  "Action", "Adventure", "Avant Garde", "Award Winning",
  "Boys Love", "Comedy", "Drama", "Ecchi", "Fantasy",
  "Girls Love", "Gourmet", "Horror", "Mystery",
  "Romance", "Sci-Fi", "Slice of Life", "Sports",
  "Supernatural", "Suspense", "Thriller"
];

export default function GenresPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <h1 className="text-3xl font-display font-bold mb-8">Browse by Genre</h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {ALL_GENRES.map((genre) => (
              <Link
                key={genre}
                href={`/search?genre=${genre.toLowerCase()}`}
                className="p-4 bg-card rounded-lg hover:bg-accent transition-colors text-center"
              >
                {genre}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

---

## 7. Studios Page (LOW PRIORITY)

### Description
Browse anime by animation studio.

### Implementation

**New Page:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/app/studios/page.tsx`

```typescript
export default async function StudiosPage() {
  // Fetch popular studios
  const studios = await anilist.getPopularStudios();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <h1 className="text-3xl font-display font-bold mb-8">Browse by Studio</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studios.map((studio) => (
              <Link
                key={studio.id}
                href={`/studio/${studio.id}`}
                className="p-6 bg-card rounded-lg hover:bg-accent transition-colors"
              >
                <h3 className="font-semibold text-lg">{studio.name}</h3>
                <p className="text-muted-foreground">{studio.mediaCount} anime</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

---

## 8. Advanced Search Enhancement (LOW PRIORITY)

### Description
Add more filters to the search page (year range, score range, exclude genres).

### Implementation

**Update:** `C:/Users/ErnestW11/DEVPROJECTS/anime-stream/components/search/anime-filters.tsx`

Add these filter options:

```typescript
interface AdvancedFilters {
  genres: string[];
  yearRange: [number, number];
  scoreRange: [number, number];
  format: string[];
  status: string[];
  excludeGenres: string[];
  sort: string;
}

export function AdvancedFilters({ filters, onChange }: AdvancedFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Year Range Slider */}
      <div>
        <label>Year Range</label>
        <input
          type="range"
          min="1990"
          max={new Date().getFullYear()}
          value={filters.yearRange[1]}
          onChange={(e) => onChange({
            ...filters,
            yearRange: [filters.yearRange[0], parseInt(e.target.value)]
          })}
        />
      </div>

      {/* Score Range */}
      <div>
        <label>Minimum Score</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.scoreRange[0]}
          onChange={(e) => onChange({
            ...filters,
            scoreRange: [parseInt(e.target.value), filters.scoreRange[1]]
          })}
        />
      </div>

      {/* Exclude Genres */}
      <div>
        <label>Exclude Genres</label>
        <GenreMultiSelect
          genres={ALL_GENRES}
          selected={filters.excludeGenres}
          onChange={(excludeGenres) => onChange({ ...filters, excludeGenres })}
        />
      </div>
    </div>
  );
}
```

---

## Implementation Priority Order

### Phase 1: Quick Wins (1-2 days)
1. Most Viewed section
2. Coming Soon page
3. Enhanced episode list with thumbnails

### Phase 2: Content Discovery (3-5 days)
4. Related Anime section
5. Genres page enhancement
6. Studios page

### Phase 3: Personalization (5-7 days)
7. History page
8. Advanced search enhancement

---

## API Requirements

Most features can be implemented with existing AniList API:

- **Most Viewed**: `sort: POPULARITY`
- **Coming Soon**: `status: NOT_YET_RELEASED`
- **Related**: `genre` search, `studio` search
- **History**: Local storage + sync to backend
- **Episode Thumbnails**: May need third-party API or local generation

---

*Generated March 19, 2026*
