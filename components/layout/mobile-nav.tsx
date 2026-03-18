/**
 * Mobile Bottom Navigation
 * Bottom tab bar for mobile devices
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Heart, Shuffle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/random", icon: Shuffle, label: "Random" },
  { href: "/favorites", icon: Heart, label: "Favorites" },
  { href: "/search", icon: Search, label: "Search" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
