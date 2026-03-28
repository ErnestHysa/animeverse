# AnimeVerse Stream - Current Status

**Last Updated:** 2026-03-28
**Version:** 0.1.0
**Status:** Production Ready

---

## Executive Summary

AnimeVerse Stream is a fully functional anime streaming application built with Next.js 16, React 19, and TypeScript. The app features direct HLS video streaming with built-in scraping capabilities, comprehensive anime metadata from AniList and Jikan APIs, and a rich user experience with watch history tracking, favorites, achievements, and more.

---

## Tech Stack

### Core Framework
- **Next.js 16.2.1** - React framework with App Router
- **React 19.2.4** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4.2.2** - Styling

### State & Data
- **Zustand 5.0.12** - State management with persistence
- **AniList GraphQL API** - Primary metadata source
- **Jikan REST API** - MyAnimeList fallback
- **Playwright 1.58.2** - Video source scraping

### Video & Media
- **hls.js 1.6.15** - HLS streaming
- **Server-side HLS proxy** - CORS bypass and URL rewriting

### UI & UX
- **Radix UI** - Accessible components
- **Framer Motion 12.38.0** - Animations
- **Lucide React 0.577.0** - Icons
- **react-hot-toast 2.6.0** - Notifications

### Development
- **ESLint 9** - Linting
- **Playwright** - E2E testing
- **Webpack** - Bundler

---

## Features Overview

### Discovery & Browsing
- [x] Home page with hero section
- [x] Trending anime
- [x] Popular anime
- [x] Seasonal anime
- [x] Genre browsing
- [x] Studio browsing
- [x] Airing schedule
- [x] Search with filters
- [x] AI recommendations
- [x] Continue watching
- [x] Random anime discovery

### Video Playback
- [x] HLS streaming with hls.js
- [x] Server-side HLS proxy for CORS bypass
- [x] Built-in Playwright scraper for video sources
- [x] Video quality selection
- [x] Playback speed control
- [x] Keyboard shortcuts
- [x] Episode navigation
- [x] Progress tracking

### User Features
- [x] Watch history with progress
- [x] Favorites list
- [x] Watchlist
- [x] Custom lists
- [x] Viewing statistics
- [x] Achievement system
- [x] User preferences
- [x] Media caching

### Advanced Features
- [x] AniList OAuth integration
- [x] Filler episode detection
- [x] Skip intro/outro timestamps (AniSkip)
- [x] Episode comments
- [x] Download packaging
- [x] Batch operations
- [x] PWA manifest support

---

## Project Structure

```
anime-stream/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── health/               # Health check
│   │   ├── search-suggestions/   # Search autocomplete
│   │   ├── video-sources/        # Video source fetching
│   │   ├── proxy-hls/            # HLS proxy
│   │   ├── proxy-subtitle/       # Subtitle proxy
│   │   ├── download-hls/         # Download packaging
│   │   ├── filler/               # Filler detection
│   │   ├── aniskip/              # Skip timestamps
│   │   └── scrape/               # Generic scraper
│   ├── anime/[id]/               # Anime detail pages
│   ├── watch/[animeId]/[episode]/ # Watch pages
│   ├── auth/anilist/             # AniList OAuth
│   ├── search/                   # Search page
│   ├── trending/                 # Trending page
│   ├── popular/                  # Popular page
│   ├── seasonal/                 # Seasonal page
│   ├── schedule/                 # Airing schedule
│   ├── genres/                   # Genre browse
│   ├── genre/[genre]/            # Specific genre
│   ├── studios/                  # Studio browse
│   ├── studios/[id]/             # Specific studio
│   ├── favorites/                # Favorites page
│   ├── watchlist/                # Watchlist page
│   ├── lists/                    # Custom lists
│   ├── history/                  # Watch history
│   ├── stats/                    # Statistics
│   ├── achievements/             # Achievements
│   ├── settings/                 # Settings
│   ├── random/                   # Random anime
│   ├── batch/                    # Batch operations
│   ├── profile/                  # User profile
│   ├── coming-soon/              # Upcoming anime
│   ├── about/                    # About page
│   ├── faq/                      # FAQ
│   ├── privacy/                  # Privacy policy
│   ├── terms/                    # Terms of service
│   ├── dmca/                     # DMCA info
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   ├── template.tsx              # Template
│   ├── error.tsx                 # Error boundary
│   └── not-found.tsx             # 404 page
├── components/
│   ├── anime/                    # Anime components
│   │   ├── anime-card.tsx
│   │   ├── anime-grid.tsx
│   │   ├── anime-actions.tsx
│   │   └── cache-anime.tsx
│   ├── player/                   # Player components
│   │   ├── enhanced-video-player.tsx
│   │   ├── video-player.tsx
│   │   ├── episode-list.tsx
│   │   ├── episode-thumbnails.tsx
│   │   ├── server-selector.tsx
│   │   ├── download-button.tsx
│   │   ├── keyboard-shortcuts.tsx
│   │   ├── share-dialog.tsx
│   │   ├── report-dialog.tsx
│   │   ├── watch-party.tsx
│   │   └── video-source-loader.tsx
│   ├── layout/                   # Layout components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── page-layout.tsx
│   │   ├── global-components.tsx
│   │   └── app-suite-orchestrator.tsx
│   ├── comments/                 # Comments
│   ├── lists/                    # Lists
│   ├── notifications/            # Notifications
│   ├── recommendations/          # AI recommendations
│   ├── error/                    # Error handling
│   └── ui/                       # UI components
├── lib/
│   ├── anilist.ts                # AniList API client
│   ├── jikan.ts                  # Jikan API client
│   ├── video-sources.ts          # Video sources
│   ├── video-sources-fast.ts     # Fast scraper
│   ├── storage.ts                # Local storage
│   ├── constants.ts              # Constants
│   ├── utils.ts                  # Utilities
│   ├── achievements.ts           # Achievements
│   ├── stats.ts                  # Statistics
│   ├── custom-lists.ts           # Custom lists
│   ├── episode-comments.ts       # Episode comments
│   ├── filler-detection.ts       # Filler detection
│   ├── aniskip.ts                # Skip timestamps
│   ├── downloads.ts              # Downloads
│   ├── notifications.ts          # Notifications
│   ├── recommendations.ts        # Recommendations
│   ├── keyboard-shortcuts.ts     # Shortcuts
│   ├── html-sanitizer.ts         # HTML sanitization
│   └── webtorrent.ts             # WebTorrent (legacy)
├── store/
│   └── index.ts                  # Zustand store
├── types/
│   └── anilist.ts                # AniList types
├── public/                       # Static assets
├── e2e/                          # E2E tests
├── tests/                        # Tests
├── scripts/                      # Build/dev scripts
├── .env.local.example            # Environment template
├── next.config.ts                # Next.js config
├── tailwind.config.ts            # Tailwind config
├── tsconfig.json                 # TypeScript config
├── eslint.config.mjs             # ESLint config
├── playwright.config.ts          # Playwright config
└── package.json                  # Dependencies
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Health check endpoint |
| `/api/search-suggestions` | GET | Search autocomplete |
| `/api/video-sources/[animeId]/[episode]` | GET | Fetch video sources via scraper |
| `/api/proxy-hls` | GET | HLS proxy for CORS bypass |
| `/api/proxy-subtitle` | GET | Subtitle proxy |
| `/api/download-hls` | GET | Package HLS for download |
| `/api/filler/[malId]` | GET | Detect filler episodes |
| `/api/aniskip/[malId]/[episode]` | GET | Get skip timestamps |
| `/api/scrape` | POST | Generic scraping endpoint |

---

## Environment Variables

```env
# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: External video API (built-in scraper used if not set)
VIDEO_API_BASE_URL=http://localhost:3001

# Optional: AniList OAuth
NEXT_PUBLIC_ANILIST_CLIENT_ID=your-client-id
ANILIST_CLIENT_SECRET=your-client-secret
```

---

## Available Scripts

```bash
npm run dev              # Start development server
npm run dev:next         # Start Next.js only
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run test:smoke       # Run smoke tests
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:e2e:headed  # Run E2E tests in headed mode
npm run test:e2e:debug   # Run E2E tests in debug mode
```

---

## Video Source Architecture

### Built-in Scraper

The app includes a Playwright-based scraper that:

1. Attempts direct URL patterns for known domains
2. Falls back to page navigation and extraction
3. Captures network requests to find HLS manifests
4. Returns demo content if all scraping fails

### HLS Proxy

The `/api/proxy-hls` route provides:

- CORS bypass for external video sources
- URL rewriting for manifest files
- DRM key file proxying
- Range request support for seeking
- Thumbnail image proxying

---

## State Management

### Zustand Store

The app uses Zustand with localStorage persistence for:

- Favorites list
- Watchlist
- Watch history with progress
- User preferences (quality, autoplay, etc.)
- Media cache
- AniList authentication
- Achievements

### Persistence

All user data is stored locally in the browser:

- `animeverse-stream-storage` - Main state
- `animeverse_stats` - Viewing statistics
- `animeverse_achievements` - Achievement progress

---

## Testing

### E2E Tests

Playwright tests cover:

- Home page functionality
- Video player controls
- Real user flows
- Smoke tests for core features

### Running Tests

```bash
# Run all tests
npm run test:e2e

# Run specific test
npx playwright test e2e/home-page.spec.ts --project=chromium

# Run with UI
npm run test:e2e:ui
```

---

## Known Limitations

1. **Video Sources**: Relies on scraping which may break when sources change
2. **Demo Fallback**: Returns sample video when scraping fails
3. **No Server-Side Auth**: All authentication is client-side
4. **Local Storage Only**: No cloud sync for user data

---

## Future Improvements

### High Priority
- [ ] Enhanced error handling for video sources
- [ ] More robust scraping with fallback sources
- [ ] Improved mobile player UI

### Medium Priority
- [ ] Background sync for watch history
- [ ] Offline mode with service workers
- [ ] More achievement types

### Low Priority
- [ ] Social sharing features
- [ ] User reviews and ratings
- [ ] Community features

---

## Deployment

### Build

```bash
npm run build
```

### Production Start

```bash
npm start
```

The app runs on port 3000 by default (configurable via PORT environment variable).

---

## License

This project is for educational purposes only. Please respect copyright laws and use legally available content sources.

---

## Support

For issues or questions:
- Check the [README.md](./README.md) for general information
- See [SETUP.md](./SETUP.md) for installation help
- Review [USER_GUIDE.md](./USER_GUIDE.md) for usage instructions
