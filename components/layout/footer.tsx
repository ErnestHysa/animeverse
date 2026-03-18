/**
 * Footer Component
 */

import Link from "next/link";
import { Github, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-lg" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Y</span>
                </div>
              </div>
              <span className="font-display font-bold">YggdrasilStream</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Free anime streaming powered by P2P technology and community.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-4">Browse</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/trending" className="hover:text-foreground transition-colors">
                  Trending
                </Link>
              </li>
              <li>
                <Link href="/seasonal" className="hover:text-foreground transition-colors">
                  Seasonal
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="hover:text-foreground transition-colors">
                  Favorites
                </Link>
              </li>
              <li>
                <Link href="/watchlist" className="hover:text-foreground transition-colors">
                  Watchlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Information */}
          <div>
            <h3 className="font-semibold mb-4">Info</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://anilist.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Data via AniList
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="hover:text-foreground transition-colors">
                  DMCA
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} YggdrasilStream. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Made with</span>
            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
            <span>using open source technology</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
