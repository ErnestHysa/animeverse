/**
 * Anime Filters Component
 * Advanced filtering options for anime search
 */

"use client";

import { useState, useCallback } from "react";
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
}

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi",
  "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA"];

const STATUSES = ["RELEASING", "FINISHED", "UPCOMING", "CANCELLED"];

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

interface AnimeFiltersProps {
  currentFilters: FilterOptions;
  query: string;
}

export function AnimeFilters({ currentFilters, query }: AnimeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = useCallback((key: keyof FilterOptions, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/?${params.toString()}`);
  }, [router, searchParams]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.push(`/search?${params.toString()}`);
  }, [router, query]);

  const hasActiveFilters = Object.values(currentFilters).some(Boolean);

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
              <button
                onClick={() => updateFilter("genre", "")}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  !currentFilters.genre
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => updateFilter("genre", genre)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    currentFilters.genre === genre
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateFilter("format", "")}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  !currentFilters.format
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {FORMATS.map((format) => (
                <button
                  key={format}
                  onClick={() => updateFilter("format", format)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    currentFilters.format === format
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {format.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateFilter("status", "")}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  !currentFilters.status
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => updateFilter("status", status)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    currentFilters.status === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {status.toLowerCase().replace("_", " ")}
                </button>
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
}
