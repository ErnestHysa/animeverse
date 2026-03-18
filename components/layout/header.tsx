/**
 * Header Component
 * Navigation header with search and user menu
 */

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  Heart,
  Clock,
  Settings,
  Menu,
  X,
  Sparkles,
  TrendingUp,
  Tv,
  Calendar,
  Shuffle,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchOpen(false);
        setSearchQuery("");
      }
    },
    [searchQuery, router]
  );

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-lg group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="font-display font-bold text-lg hidden sm:block">
                AnimeVerse<span className="text-primary">Stream</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/" icon={<TrendingUp className="w-4 h-4" />}>
                Trending
              </NavLink>
              <NavLink href="/schedule" icon={<Calendar className="w-4 h-4" />}>
                Schedule
              </NavLink>
              <NavLink href="/random" icon={<Shuffle className="w-4 h-4" />}>
                Random
              </NavLink>
              <NavLink href="/seasonal" icon={<Tv className="w-4 h-4" />}>
                Seasonal
              </NavLink>
              <NavLink href="/favorites" icon={<Heart className="w-4 h-4" />}>
                Favorites
              </NavLink>
              <NavLink href="/watchlist" icon={<Clock className="w-4 h-4" />}>
                Watchlist
              </NavLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Search Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* Discord Community */}
              <a
                href="https://discord.gg/animeverse"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center justify-center rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 h-10 px-3 gap-2 transition-colors text-sm font-medium"
                aria-label="Join Discord"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Discord</span>
              </a>

              {/* Settings */}
              <button
                onClick={() => router.push("/settings")}
                className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 h-10 w-10 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar Overlay */}
      {searchOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-white/10 animate-slideDown">
          <div className="container mx-auto px-4 py-4">
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search anime..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <GlassCard className="absolute top-16 right-4 left-4 p-4 animate-slideDown">
            <nav className="flex flex-col gap-2">
              <MobileNavLink href="/" icon={<TrendingUp className="w-5 h-5" />}>
                Trending
              </MobileNavLink>
              <MobileNavLink href="/schedule" icon={<Calendar className="w-5 h-5" />}>
                Schedule
              </MobileNavLink>
              <MobileNavLink href="/random" icon={<Shuffle className="w-5 h-5" />}>
                Random
              </MobileNavLink>
              <MobileNavLink href="/seasonal" icon={<Tv className="w-5 h-5" />}>
                Seasonal
              </MobileNavLink>
              <MobileNavLink href="/favorites" icon={<Heart className="w-5 h-5" />}>
                Favorites
              </MobileNavLink>
              <MobileNavLink href="/watchlist" icon={<Clock className="w-5 h-5" />}>
                Watchlist
              </MobileNavLink>
              <MobileNavLink href="/settings" icon={<Settings className="w-5 h-5" />}>
                Settings
              </MobileNavLink>
            </nav>
          </GlassCard>
        </div>
      )}
    </>
  );
}

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function NavLink({ href, icon, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function MobileNavLink({ href, icon, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
