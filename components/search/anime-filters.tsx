/**
 * Anime Filters Component
 * Advanced filtering options for anime search
 */

"use client";

import { useState, useCallback, memo, useMemo } from "react";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";

export interface FilterOptions {
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
  season?: string;
  minScore?: string;
}

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi",
  "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA"];

const STATUSES = ["RELEASING", "FINISHED", "UPCOMING", "CANCELLED"];

const SEASONS = [
  { value: "WINTER", label: "❄️ Winter (Jan–Mar)" },
  { value: "SPRING", label: "🌸 Spring (Apr–Jun)" },
  { value: "SUMMER", label: "☀️ Summer (Jul–Sep)" },
  { value: "FALL", label: "🍂 Fall (Oct–Dec)" },
];

const SCORE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "90", label: "90+ (Masterpiece)" },
  { value: "80", label: "80+ (Great)" },
  { value: "70", label: "70+ (Good)" },
  { value: "60", label: "60+ (Fine)" },
];

const SORT_OPTIONS = [
  { value: "POPULARITY_DESC", label: "Most Popular" },
  { value: "POPULARITY_ASC", label: "Least Popular" },
  { value: "SCORE_DESC", label: "Highest Rated" },
  { value: "SCORE_ASC", label: "Lowest Rated" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "START_DATE_DESC", label: "Newest" },
  { value: "START_DATE_ASC", label: "Oldest" },
  { value: "TITLE_ROMAJI_DESC", label: "Title (Z-A)" },
  { value: "TITLE_ROMAJI_ASC", label: "Title (A-Z)" },
];

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

const MOOD_PRESETS = [
  { id: 'action', label: '⚡ Hype', genres: ['Action', 'Martial Arts'] },
  { id: 'relaxing', label: '☁️ Relaxing', genres: ['Slice of Life', 'Comedy'] },
  { id: 'emotional', label: '💙 Emotional', genres: ['Drama', 'Psychological'] },
  { id: 'romance', label: '💕 Romance', genres: ['Romance', 'Shoujo'] },
  { id: 'dark', label: '🌑 Dark', genres: ['Horror', 'Thriller', 'Psychological'] },
  { id: 'adventure', label: '🗺️ Adventure', genres: ['Adventure', 'Fantasy'] },
  { id: 'fun', label: '😂 Funny', genres: ['Comedy', 'Parody'] },
  { id: 'mystery', label: '🔍 Mystery', genres: ['Mystery', 'Suspense'] },
];

interface AnimeFiltersProps {
  currentFilters: FilterOptions;
  query: string;
  defaultExpanded?: boolean;
}

// Memoized filter button to prevent unnecessary re-renders
const FilterButton = memo(function FilterButton({
  value,
  isActive,
  onClick,
  children,
  className = "",
}: {
  value: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm transition-colors ${className} ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-white/5 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
});

export const AnimeFilters = memo(function AnimeFilters({ currentFilters, query, defaultExpanded = false }: AnimeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Memoize hasActiveFilters to prevent recalculation
  const hasActiveFilters = useMemo(
    () => Object.values(currentFilters).some(Boolean),
    [currentFilters]
  );

  const updateFilter = useCallback((key: keyof FilterOptions, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/search?${params.toString()}`);
  }, [router, searchParams]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.push(`/search?${params.toString()}`);
  }, [router, query]);

  return (
    <GlassCard className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-primary" />
          <span className="font-medium">Advanced Filters</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-full text-xs">
              Active
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-white/10 mt-4">
          {/* Mood Presets */}
          <div>
            <label className="text-sm font-medium mb-2 block">Mood</label>
            <div className="flex flex-wrap gap-2">
              {MOOD_PRESETS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => updateFilter("genre", mood.genres[0])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    currentFilters.genre === mood.genres[0]
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter("sort", option.value)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentFilters.sort === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="text-sm font-medium mb-2 block">Genre</label>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                value=""
                isActive={!currentFilters.genre}
                onClick={() => updateFilter("genre", "")}
              >
                All
              </FilterButton>
              {GENRES.map((genre) => (
                <FilterButton
                  key={genre}
                  value={genre}
                  isActive={currentFilters.genre === genre}
                  onClick={() => updateFilter("genre", genre)}
                >
                  {genre}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                value=""
                isActive={!currentFilters.format}
                onClick={() => updateFilter("format", "")}
              >
                All
              </FilterButton>
              {FORMATS.map((format) => (
                <FilterButton
                  key={format}
                  value={format}
                  isActive={currentFilters.format === format}
                  onClick={() => updateFilter("format", format)}
                >
                  {format.replace("_", " ")}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                value=""
                isActive={!currentFilters.status}
                onClick={() => updateFilter("status", "")}
              >
                All
              </FilterButton>
              {STATUSES.map((status) => (
                <FilterButton
                  key={status}
                  value={status}
                  isActive={currentFilters.status === status}
                  onClick={() => updateFilter("status", status)}
                >
                  {status.toLowerCase().replace("_", " ")}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* Season */}
          <div>
            <label className="text-sm font-medium mb-2 block">Season</label>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                value=""
                isActive={!currentFilters.season}
                onClick={() => updateFilter("season", "")}
              >
                All Seasons
              </FilterButton>
              {SEASONS.map((season) => (
                <FilterButton
                  key={season.value}
                  value={season.value}
                  isActive={currentFilters.season === season.value}
                  onClick={() => updateFilter("season", season.value)}
                >
                  {season.label}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* Year */}
          <div>
            <label className="text-sm font-medium mb-2 block">Year</label>
            <select
              value={currentFilters.year || ""}
              onChange={(e) => updateFilter("year", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary/50"
            >
              <option value="">All Years</option>
              {YEARS.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Min Score */}
          <div>
            <label className="text-sm font-medium mb-2 block">Minimum Score</label>
            <div className="flex flex-wrap gap-2">
              {SCORE_OPTIONS.map((option) => (
                <FilterButton
                  key={option.value}
                  value={option.value}
                  isActive={(currentFilters.minScore || "") === option.value}
                  onClick={() => updateFilter("minScore", option.value)}
                >
                  {option.label}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
});
