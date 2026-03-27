/**
 * Header Component
 * Navigation header with search and user menu
 */

"use client";

import { useState, useCallback, memo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Heart,
  Clock,
  Settings,
  Menu,
  X,
  Zap,
  TrendingUp,
  Tv,
  Calendar,
  Shuffle,
  MessageSquare,
  Tags,
  Sun,
  Moon,
  User,
  LogOut,
  List as ListIcon,
  Trophy,
  BarChart3,
  BookMarked,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { EpisodeNotifications } from "@/components/notifications/episode-notifications";
import { useTheme } from "@/components/providers/theme-provider";
import { useAniListAuth } from "@/store";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

// Memoized navigation link components (must be defined before Header)
const NavLink = memo(function NavLink({ href, icon, children, className = "" }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap ${className}`}
    >
      {icon}
      <span className="hidden xl:inline">{children}</span>
    </Link>
  );
});

const MobileNavLink = memo(function MobileNavLink({ href, icon, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
});

export const Header = memo(function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{ id: number; title: string; year?: number | null; format?: string | null }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { anilistUser, isAuthenticated, clearAniListAuth } = useAniListAuth();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchOpen(false);
        setSearchQuery("");
        setShowSuggestions(false);
        setSearchSuggestions([]);
      }
    },
    [searchQuery, router]
  );

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchSuggestions(data.suggestions || []);
          setShowSuggestions(true);
        }
      } catch {
        // Silently fail
      }
    }, 300);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (userMenuOpen && !target.closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 min-w-0">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-lg group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="font-display font-bold text-lg hidden sm:block">
                AnimeVerse<span className="text-primary">Stream</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-0.5 min-w-0 flex-1 overflow-x-auto">
              <NavLink href="/" icon={<TrendingUp className="w-4 h-4" />}>
                Trending
              </NavLink>
              <NavLink href="/schedule" icon={<Calendar className="w-4 h-4" />}>
                Schedule
              </NavLink>
              <NavLink href="/coming-soon" icon={<Clock className="w-4 h-4" />}>
                Coming Soon
              </NavLink>
              <NavLink href="/random" icon={<Shuffle className="w-4 h-4" />}>
                Random
              </NavLink>
              <NavLink href="/seasonal" icon={<Tv className="w-4 h-4" />} className="hidden lg:flex">
                Seasonal
              </NavLink>
              <NavLink href="/genres" icon={<Tags className="w-4 h-4" />} className="hidden lg:flex">
                Genres
              </NavLink>
              <NavLink href="/favorites" icon={<Heart className="w-4 h-4" />} className="hidden xl:flex">
                Favorites
              </NavLink>
              <NavLink href="/watchlist" icon={<Clock className="w-4 h-4" />} className="hidden 2xl:flex">
                Watchlist
              </NavLink>
              <NavLink href="/lists" icon={<ListIcon className="w-4 h-4" />} className="hidden 2xl:flex">
                Lists
              </NavLink>
              <NavLink href="/achievements" icon={<Trophy className="w-4 h-4" />} className="hidden 2xl:flex">
                Achievements
              </NavLink>
              <NavLink href="/stats" icon={<BarChart3 className="w-4 h-4" />} className="hidden 2xl:flex">
                Stats
              </NavLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <form
                onSubmit={handleSearch}
                className="hidden xl:flex items-center relative mr-2"
              >
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Search anime..."
                  suppressHydrationWarning
                  className="w-56 pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  autoComplete="off"
                />
              </form>

              {/* Search Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSearch}
                aria-label="Search"
                className="h-8 w-8"
              >
                <Search className="w-4 h-4" />
              </Button>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="h-8 w-8"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>

              {/* Discord Community - hidden on smaller screens */}
              <a
                href="https://discord.gg/animeverse"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden 2xl:inline-flex items-center justify-center rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 h-8 px-2 gap-1 transition-colors text-xs font-medium"
                aria-label="Join Discord"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discord</span>
              </a>

              {/* Episode Notifications */}
              <EpisodeNotifications />

              {/* AniList User Profile */}
              {isAuthenticated && anilistUser ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    {anilistUser.avatar ? (
                      <img
                        src={anilistUser.avatar.medium || anilistUser.avatar.large}
                        alt={anilistUser.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden xl:inline text-xs font-medium max-w-[80px] truncate">
                      {anilistUser.name}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div className="user-menu-container absolute right-0 top-full mt-2 w-52 bg-popover border border-white/10 rounded-lg shadow-xl overflow-hidden animate-fadeIn z-50">
                      <div className="p-2 border-b border-white/10">
                        <p className="text-xs text-muted-foreground px-2 py-1">
                          Signed in as
                        </p>
                        <p className="text-sm font-medium px-2 py-1 truncate">
                          {anilistUser.name}
                        </p>
                      </div>
                      <div className="py-1">
                        {[
                          { href: "/profile", icon: <User className="w-4 h-4" />, label: "Profile" },
                          { href: "/history", icon: <Clock className="w-4 h-4" />, label: "Watch History" },
                          { href: "/watchlist", icon: <BookMarked className="w-4 h-4" />, label: "Watchlist" },
                          { href: "/batch", icon: <ListIcon className="w-4 h-4" />, label: "Batch Ops" },
                          { href: "/achievements", icon: <Trophy className="w-4 h-4" />, label: "Achievements" },
                          { href: "/stats", icon: <BarChart3 className="w-4 h-4" />, label: "Stats" },
                          { href: "/settings", icon: <Settings2 className="w-4 h-4" />, label: "Settings" },
                        ].map((item) => (
                          <button
                            key={item.href}
                            onClick={() => { router.push(item.href); setUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-left"
                          >
                            <span className="text-muted-foreground">{item.icon}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-white/10">
                        <button
                          onClick={() => {
                            clearAniListAuth();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-left text-red-400"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => router.push("/settings")}
                  className="hidden lg:inline-flex items-center justify-center rounded-lg text-primary hover:text-primary/80 hover:bg-primary/10 h-8 px-2 gap-1 transition-colors text-xs font-medium"
                  title="Connect AniList"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden 2xl:inline">Connect</span>
                </button>
              )}

              {/* Settings */}
              <button
                onClick={() => router.push("/settings")}
                className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 h-8 w-8 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={toggleMobileMenu}
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar Overlay */}
      {searchOpen && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-white/10 animate-slideDown">
          <div className="container mx-auto px-4 py-4">
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                    placeholder="Search anime..."
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                    autoComplete="off"
                  />
                  {/* Live Search Suggestions */}
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => {
                            router.push(`/anime/${suggestion.id}`);
                            setSearchOpen(false);
                            setSearchQuery("");
                            setShowSuggestions(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
                        >
                          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{suggestion.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.format?.replace("_", " ")}{suggestion.year ? ` • ${suggestion.year}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                          setSearchOpen(false);
                          setSearchQuery("");
                          setShowSuggestions(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-2 text-primary text-sm font-medium"
                      >
                        <Search className="w-4 h-4" />
                        See all results for &quot;{searchQuery}&quot;
                      </button>
                    </div>
                  )}
                </div>
                <Button type="submit" size="lg" className="shrink-0">
                  Search
                </Button>
                <button
                  type="button"
                  onClick={toggleSearch}
                  className="shrink-0 p-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close search"
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
            onClick={closeMobileMenu}
          />
          <GlassCard className="absolute top-14 right-4 left-4 p-4 animate-slideDown">
            <nav className="flex flex-col gap-2">
              <MobileNavLink href="/" icon={<TrendingUp className="w-5 h-5" />}>
                Trending
              </MobileNavLink>
              <MobileNavLink href="/schedule" icon={<Calendar className="w-5 h-5" />}>
                Schedule
              </MobileNavLink>
              <MobileNavLink href="/coming-soon" icon={<Clock className="w-5 h-5" />}>
                Coming Soon
              </MobileNavLink>
              <MobileNavLink href="/random" icon={<Shuffle className="w-5 h-5" />}>
                Random
              </MobileNavLink>
              <MobileNavLink href="/seasonal" icon={<Tv className="w-5 h-5" />}>
                Seasonal
              </MobileNavLink>
              <MobileNavLink href="/genres" icon={<Tags className="w-5 h-5" />}>
                Genres
              </MobileNavLink>
              <MobileNavLink href="/favorites" icon={<Heart className="w-5 h-5" />}>
                Favorites
              </MobileNavLink>
              <MobileNavLink href="/watchlist" icon={<Clock className="w-5 h-5" />}>
                Watchlist
              </MobileNavLink>
              <MobileNavLink href="/lists" icon={<ListIcon className="w-5 h-5" />}>
                Lists
              </MobileNavLink>
              <MobileNavLink href="/achievements" icon={<Trophy className="w-5 h-5" />}>
                Achievements
              </MobileNavLink>
              <MobileNavLink href="/stats" icon={<BarChart3 className="w-5 h-5" />}>
                Stats
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
});
