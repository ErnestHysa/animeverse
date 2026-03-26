/**
 * About Page
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { Star, Users, Zap, Shield } from "lucide-react";

export const metadata = {
  title: "About Us",
  description: "Learn about AnimeVerse and the features that power the current app experience.",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-display font-bold mb-4">About AnimeVerse</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              AniList-powered anime discovery and streaming tools, built to make browsing, tracking,
              and watching feel fast on desktop and mobile.
            </p>
          </div>

          {/* Mission */}
          <GlassCard className="p-8 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-3">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                  AnimeVerse focuses on a polished anime web experience: rich discovery pages, resilient
                  playback, local watch tracking, AniList sync, and helpful utilities like downloads,
                  schedule views, comments, and keyboard shortcuts.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <GlassCard className="p-6">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold mb-2">Fast Streaming</h3>
              <p className="text-sm text-muted-foreground">
                HD quality streaming with multiple server options for buffer-free viewing.
              </p>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">Community Driven</h3>
              <p className="text-sm text-muted-foreground">
                Episode comments, personalized recommendations, and AniList-connected workflows help
                the app feel personal without forcing a separate account system.
              </p>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold mb-2">Safe & Secure</h3>
              <p className="text-sm text-muted-foreground">
                Local watch history, favorites, and preferences stay on-device unless you explicitly
                connect AniList for sync features.
              </p>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mb-4">
                <Star className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="font-semibold mb-2">Always Updating</h3>
              <p className="text-sm text-muted-foreground">
                Trending, seasonal, studio, genre, and schedule views are powered by live AniList metadata
                so the catalog stays aligned with the current season.
              </p>
            </GlassCard>
          </div>

          {/* Data Source */}
          <GlassCard className="p-8">
            <h2 className="text-2xl font-semibold mb-4">Data Source</h2>
            <p className="text-muted-foreground mb-4">
              AnimeVerse uses the AniList API for discovery metadata and complements it with playback,
              watch-state, and utility features in-app, including:
            </p>
            <ul className="grid md:grid-cols-2 gap-3 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Detailed anime information and synopses
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Episode counts and airing schedules
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Score and popularity rankings
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Character information and voice actors
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Genre and tag classifications
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Recommendation seeds for related anime discovery
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                Watch history, favorites, watchlist, and achievement tracking
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Anime and manga data is provided by the AniList API. Visit{" "}
              <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                anilist.co
              </a>{" "}
              for more information.
            </p>
          </GlassCard>
        </div>
      </main>
      <Footer />
    </>
  );
}
