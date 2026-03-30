/**
 * Recent Searches Component
 * Shows the last 5 searches as clickable chips, stored in localStorage
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";

const STORAGE_KEY = "animeverse-recent-searches";
const MAX_RECENT = 5;

export function saveRecentSearch(query: string): void {
  if (typeof window === "undefined" || !query.trim()) return;
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const deduped = [query, ...existing.filter((q) => q !== query)].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
  } catch {
    // ignore
  }
}

export function RecentSearches({ currentQuery }: { currentQuery?: string }) {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setRecents(stored);
    } catch {
      setRecents([]);
    }
  }, []);

  // Save current query when it exists
  useEffect(() => {
    if (currentQuery?.trim()) {
      saveRecentSearch(currentQuery.trim());
    }
  }, [currentQuery]);

  const removeRecent = (query: string) => {
    const updated = recents.filter((q) => q !== query);
    setRecents(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearAll = () => {
    setRecents([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Only show when there's no current query
  if (currentQuery?.trim() || recents.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>Recent Searches</span>
        </div>
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {recents.map((query) => (
          <div key={query} className="flex items-center gap-1 group">
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-sm transition-colors"
            >
              {query}
            </Link>
            <button
              onClick={() => removeRecent(query)}
              className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
