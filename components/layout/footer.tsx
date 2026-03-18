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
              <span className="font-display font-bold">AnimeVerse</span>
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
            © {new Date().getFullYear()} AnimeVerse. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://discord.gg/animeverse"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.066.074.168 0 .229-.081.452-.3.3-.756-.765-1.152-1.314.074-.086.074-.23.001-.304-.533-.833-1.058-1.396-1.618a.348.348 0 0 0-.482.046c-.346.203-.768.484-1.247.845-.06.045-.12.089-.18.13-.482-.438-.997-.926-1.535-1.445a19.945 19.945 0 0 0-5.429-3.057.337.337 0 0 0-.372.016c-.531.168-1.075.355-1.629.564a19.848 19.848 0 0 0-4.3 2.563c-.044.04-.088.082-.13.124a.357.357 0 0 0-.356-.016c-1.565.787-3.068 1.665-4.47 2.624-.054.037-.108.076-.162.113a.338.338 0 0 0-.342.034c-1.362.891-2.68 1.842-3.956 2.84a.343.343 0 0 0-.025.513c1.45 1.772 3.198 3.29 5.272 4.474a.347.347 0 0 0 .372-.03c1.075-.73 2.123-1.5 3.147-2.31a.339.339 0 0 0-.024-.514c-.854-.689-1.682-1.403-2.48-2.155a.337.337 0 0 1 .018-.509c1.267-1.04 2.656-1.96 4.145-2.724a.337.337 0 0 1 .352.016c2.42 1.194 4.996 1.806 7.62 1.806 2.623 0 5.2-.612 7.619-1.806a.337.337 0 0 1 .353-.016c1.49.764 2.878 1.684 4.145 2.724a.337.337 0 0 1 .018.509c-.798.752-1.626 1.466-2.48 2.155a.339.339 0 0 0-.024.514c1.024.81 2.072 1.58 3.147 2.31a.347.347 0 0 0 .372.03c2.074-1.184 3.822-2.702 5.272-4.474a.343.343 0 0 0-.025-.513c-1.276-1.178-2.594-1.949-3.956-2.84a.338.338 0 0 0-.342-.034c-.054.037-.108.076-.162.113-1.392-.783-2.905-1.437-4.47-2.624a.357.357 0 0 0-.356.016c-.042.041-.086.084-.13.124a19.945 19.945 0 0 0-5.429-3.057c-.538-.489-1.053-1.007-1.535-1.545a.348.348 0 0 0-.482.046c-.479.361-.901.642-1.247.845-.06.045-.12.089-.18.13-.482-.438-.997-.926-1.535-1.414a.348.348 0 0 1 .001-.304c.3-.756.765-1.152 1.314-1.618.06-.074.074-.168.001-.229-.081-.452-.3-.756-.765-1.152-1.314a19.791 19.791 0 0 0-4.885-1.515z"/>
              </svg>
              <span>Discord</span>
            </a>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">Made with</span>
            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
            <span className="text-muted-foreground">using open source technology</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
