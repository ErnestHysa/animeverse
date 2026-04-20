================================================================================
  ANIMEVERSE — CODEBASE TREE MAP
  Last updated: 2026-04-20
  Total files: ~324 | Total lines: ~37,100 (source code)
================================================================================

> **THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR UNDERSTANDING THIS CODEBASE.**
> **ANY LLM OR DEVELOPER WORKING ON THIS PROJECT MUST READ THIS FILE FIRST.**
>
> **MANDATORY RULE: When ANY file is created, deleted, renamed, or significantly
> modified, this tree_map.md MUST be updated accordingly. No exceptions. Keeping
> this file current is a hard requirement — an outdated tree_map.md is a bug.**


================================================================================
  TABLE OF CONTENTS
================================================================================

  1. Project Overview
  2. Tech Stack
  3. Project Structure (Directory Tree)
  4. Directory-by-Directory Breakdown
  5. Routing & Pages (app/)
  6. API Routes (app/api/)
  7. Components (components/)
  8. Library & Business Logic (lib/)
  9. State Management (store/)
  10. Type Definitions (types/)
  11. Services (services/)
  12. Electron Desktop App (electron/)
  13. Scripts (scripts/)
  14. Testing (tests/ & e2e/)
  15. Configuration Files
  16. Environment Variables
  17. Docker & Deployment
  18. Data Flow & Architecture
  19. Key Architectural Patterns
  20. Largest Files (Complexity Hotspots)
  21. CLI Tools Reference for LLMs
  22. Quick "Where Is X?" Lookup Table
  23. Server vs Client Component Boundary
  24. Import Alias Reference
  25. Critical Dependency Chains ("If I Change X...")
  26. User Action → Code Path Traces
  27. Common Development Task Recipes
  28. Known Gotchas & Pitfalls
  29. Coding Conventions
  30. Mandatory Update Protocol


================================================================================
  1. PROJECT OVERVIEW
================================================================================

AnimeVerse (package name: "anime-stream-app") is a full-featured anime streaming
web application with P2P (WebTorrent), HLS, and DASH streaming support. It
features AniList and MyAnimeList integration, a recommendation engine, watch
party functionality, PWA support, Electron desktop packaging, admin dashboard,
community features (ratings, comments), and comprehensive analytics.

Recent implementation notes (2026-04-20):
  - Admin auth now uses secure cookie-backed sessions end-to-end. The app now
    includes `/admin/login` plus a shared `lib/admin-client.ts` helper used by
    admin screens instead of `localStorage` tokens.
  - Monitoring/analytics now share a single server-side data layer in
    `lib/monitoring-data.ts`. Admin status routes and alerts read from that
    module, and alert monitoring is started lazily when the alerts system loads.
  - `/api/admin/torrents/health` now exists and backs the alert system.
  - Video source resolution no longer silently swaps to demo playback on normal
    failures. The API exposes explicit preview availability and the player only
    enters preview mode when the user chooses it.
  - Recommendation UI copy was renamed from “AI Picks” to neutral personalized
    phrasing; the underlying recommendation engine remains heuristic.
  - Several content pages now use ISR/revalidation instead of forced dynamic
    rendering, and AniList list/search queries use lighter fragments.

  - Name:    AnimeVerse Stream
  - Domain:  animeverse.stream
  - Version: 0.1.0
  - License: Private


================================================================================
  2. TECH STACK
================================================================================

  Framework:         Next.js 16 (App Router, standalone output)
  Language:          TypeScript 5
  UI Library:        React 19
  Styling:           Tailwind CSS 4 + custom glass-morphism components
  State Management:  Zustand 5 (with localStorage persistence)
  Video Streaming:   HLS.js, DASH.js, WebTorrent 2, p2p-media-loader
  Real-time:         Socket.IO (WebSocket for watch party)
  Auth:              JWT (jsonwebtoken) + bcrypt, AniList OAuth, MAL OAuth
  Data Source:       AniList GraphQL API (primary), Jikan/ MAL API (secondary)
  Scraping:          Cheerio + Axios (torrent source scraping)
  Desktop:           Electron 41 + electron-builder
  Testing:           Vitest (unit), Playwright (E2E), happy-dom
  Containerization:  Docker + Docker Compose (Postgres + Redis + App)
  Animation:         Framer Motion 12
  Icons:             Lucide React
  UI Primitives:     Radix UI (Accordion, Dialog, Switch, Label)


================================================================================
  3. PROJECT STRUCTURE (DIRECTORY TREE)
================================================================================

animeverse/
├── .claude/                        # Claude Code session settings
│   ├── settings.local.json
│   └── ralph-loop.local.md
├── .data/                          # Runtime data (gitignored)
│   └── torrent-cache.json
├── analysis/                       # Competitor research & scraping data
│   ├── analysis_*.json / .txt      #   Per-site analysis (9anime, animedao, etc.)
│   ├── review_*.json               #   Competitor reviews
│   └── scrape_summary.json
├── app/                            # Next.js App Router — pages & API routes
│   ├── layout.tsx                  # Root layout (metadata, providers, global components)
│   ├── page.tsx                    # Home page (trending, hero, continue watching)
│   ├── template.tsx                # Route template (transitions)
│   ├── error.tsx                   # Global error boundary
│   ├── not-found.tsx               # 404 page
│   ├── globals.css                 # Global styles (Tailwind + custom)
│   ├── favicon.ico
│   ├── about/                      # About page
│   ├── achievements/               # User achievements
│   ├── admin/                      # Admin panel (login, dashboard, magnets)
│   ├── anime/[id]/                 # Anime detail page (ISR, info, episodes)
│   ├── api/                        # API route handlers (see Section 6)
│   ├── auth/                       # OAuth callbacks (AniList, MAL)
│   ├── batch/                      # Batch operations page
│   ├── coming-soon/                # Coming soon page
│   ├── dmca/                       # DMCA/legal page
│   ├── faq/                        # FAQ page
│   ├── favorites/                  # User favorites
│   ├── genre/[genre]/              # Genre detail (dynamic route)
│   ├── genres/                     # Genre listing
│   ├── hidden-gems/                # Hidden gems discovery
│   ├── history/                    # Watch history
│   ├── lists/                      # Custom lists
│   ├── popular/                    # Popular anime
│   ├── privacy/                    # Privacy policy
│   ├── profile/                    # User profile
│   ├── random/                     # Random anime (with own layout)
│   ├── schedule/                   # Airing schedule
│   ├── search/                     # Search page
│   ├── seasonal/                   # Seasonal anime
│   ├── settings/                   # Settings page
│   ├── stats/                      # User stats
│   ├── studios/                    # Studios listing
│   │   └── [id]/                   # Studio detail (dynamic route)
│   ├── terms/                      # Terms of service
│   ├── top-rated/                  # Top rated anime
│   ├── trending/                   # Trending anime
│   ├── watch/[animeId]/[episode]/  # Episode watch page (dynamic route)
│   └── watchlist/                  # Watchlist
├── components/                     # React components (see Section 7)
│   ├── anime/                      # Anime-specific (cards, grids, countdowns)
│   ├── comments/                   # Comment sections
│   ├── error/                      # Error boundaries & fallbacks
│   ├── layout/                     # Layout (header, footer, nav, orchestrator)
│   ├── lists/                      # Batch operations
│   ├── notifications/              # Episode & notification components
│   ├── player/                     # Video player suite (HLS, DASH, Torrent)
│   ├── providers/                  # Context providers (theme)
│   ├── pwa/                        # PWA (service worker, install prompt)
│   ├── recommendations/            # Personalized recommendation UI
│   ├── search/                     # Search UI (filters, recent searches)
│   ├── seed-tracking/              # Seed ratio badges
│   ├── settings/                   # Settings panels
│   ├── stats/                      # Stats sharing
│   ├── ui/                         # Reusable UI primitives
│   └── watch/                      # Watch-page specific (episode comments)
│   └── continue-watching.tsx       # Continue watching strip
├── data/                           # Static data files
│   └── magnets.json                # Magnet link database
├── docs/                           # Project documentation
│   ├── COMPETITIVE_ANALYSIS_2026.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── PHASE11_COMPLETION_SUMMARY.md
│   ├── PHASE11_SECURITY_IMPLEMENTATION.md
│   ├── PHASE12_FINAL_MEMORY.md
│   ├── PRODUCTION_GAPS_ANALYSIS.md
│   ├── PRODUCTION_READINESS_PLAN.md
│   └── PRODUCTION_READY_SUMMARY.md
├── e2e/                            # Playwright E2E tests
│   ├── fixtures/mock-anilist.ts
│   ├── global-setup.ts
│   ├── home-page.spec.ts
│   ├── loading-animations.spec.ts
│   ├── real-user-flow.spec.ts
│   ├── screenshots.spec.ts
│   ├── user-journey.spec.ts
│   ├── video-player.spec.ts
│   └── webtorrent-player.spec.ts
├── electron/                       # Electron desktop wrapper
│   ├── main.ts                     # Electron main process
│   ├── preload.ts                  # Preload script (bridge)
│   └── tsconfig.json
├── lib/                            # Business logic & utilities (see Section 8)
│   ├── achievements.ts             # Achievement definitions & unlock logic
│   ├── alerts-manager.ts           # Admin alert system
│   ├── admin-client.ts             # Client helper for cookie-backed admin auth
│   ├── analytics-integration.ts    # Analytics API integration
│   ├── analytics-tracker.ts        # Client-side event tracking
│   ├── anilist.ts                  # AniList GraphQL client
│   ├── anilist-sync.ts             # AniList media list sync
│   ├── aniskip.ts                  # Anime skip intro/outro (AniSkip API)
│   ├── auth.ts                     # JWT auth, bcrypt, admin users
│   ├── bandwidth-manager.ts        # Upload/download bandwidth control
│   ├── constants.ts                # App-wide constants (API URLs, genres, etc.)
│   ├── custom-lists.ts             # Custom user anime lists
│   ├── dash-manager.ts             # DASH stream manager (singleton)
│   ├── dht-optimizer.ts            # DHT peer discovery optimization
│   ├── downloads.ts                # Episode download logic
│   ├── episode-comments.ts         # Episode comment storage/retrieval
│   ├── feature-flags.ts            # Feature flag system (gradual rollout)
│   ├── filler-detection.ts         # Filler episode detection
│   ├── html-sanitizer.ts           # HTML sanitization utility
│   ├── hybrid-stream-manager.ts    # Auto-switch between HLS/Torrent/DASH
│   ├── jikan.ts                    # Jikan/MAL API client
│   ├── keyboard-shortcuts.ts       # Keyboard shortcut definitions
│   ├── logger.ts                   # Scoped logger (dev/production aware)
│   ├── mal-api.ts                  # MyAnimeList API client
│   ├── monitoring-data.ts          # Shared analytics/health snapshot helpers
│   ├── notifications.ts            # Notification management
│   ├── p2pml-manager.ts            # P2P Media Loader (HLS P2P sharing)
│   ├── ratings.ts                  # Magnet/user rating logic
│   ├── recommendations.ts          # AI recommendation engine
│   ├── seed-tracker.ts             # Seed ratio tracking & achievements
│   ├── stats.ts                    # User statistics computation
│   ├── storage.ts                  # Safe localStorage wrapper
│   ├── torrent-finder.ts           # Magnet link discovery (Nyaa, AniDex)
│   ├── torrent-preloader.ts        # Preload next episode torrents
│   ├── torrent-stream-loader.ts    # Load torrent streams for playback
│   ├── torrent-subtitle-loader.ts  # Extract subtitles from torrents
│   ├── use-feature-flag.ts         # React hook for feature flags
│   ├── utils.ts                    # Utility functions (cn, date formatting, etc.)
│   ├── video-sources-robust.ts     # Multi-source video resolution
│   ├── websocket-server.ts         # Socket.IO server for watch party
│   ├── webtorrent-manager.ts       # WebTorrent lifecycle management
│   └── webtorrent.ts               # WebTorrent initialization helpers
├── public/                         # Static assets served directly
│   ├── favicon.ico
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker (caching)
│   ├── icons/icon.svg              # App icon
│   ├── images/                     # Placeholder images (SVGs)
│   │   ├── anime-placeholder.svg
│   │   └── anime-banner-placeholder.svg
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
├── scripts/                        # Development & build scripts
│   ├── dev.js                      # Custom dev server launcher
│   ├── start-next-webpack.mjs      # Next.js webpack dev server
│   ├── mock-anilist-server.js      # Mock AniList API for tests
│   ├── smoke-test.mjs              # Smoke test runner
│   ├── generate-demo-video.py      # Demo video generator
│   └── visual-player-check.js      # Visual player verification
├── services/                       # Standalone backend services
│   ├── anime-scraper.js            # Anime data scraper
│   ├── anime-tracker.ts            # Airing anime tracker
│   ├── seed-server.js              # Torrent seed server
│   ├── package.json
│   └── README.md
├── store/                          # Zustand global state
│   └── index.ts                    # Single store (1118 lines) with all slices
├── tests/                          # Vitest unit tests
│   ├── setup.ts
│   ├── browser-compatibility.spec.ts
│   ├── unit/
│   │   ├── hybrid-stream-manager.test.ts
│   │   ├── torrent-finder.test.ts
│   │   └── webtorrent-manager.test.ts
│   ├── load/
│   │   └── concurrent-streams.js
│   └── README.md
├── types/                          # TypeScript type definitions
│   ├── anilist.ts                  # AniList GraphQL response types
│   ├── analytics.ts                # Analytics event types
│   ├── magnet-ratings.ts           # Rating & comment types
│   └── seed-tracking.ts            # Seed tracking types


================================================================================
  4. DIRECTORY-BY-DIRECTORY BREAKDOWN
================================================================================

  analysis/ — Competitor research files. JSON and TXT exports from scraping
    GogoAnime, AnimeDao, AniWave, 9Anime, ZoroTV, AnimeKai. These are
    reference materials, not runtime code. Safe to ignore for feature work.

  app/ — Next.js App Router. Every page is a page.tsx in its route folder.
    Dynamic routes use [bracket] syntax. API routes are route.ts files under
    app/api/. See Sections 5 and 6 for full listings.

  components/ — All React components. Organized by domain. UI primitives in
    components/ui/ use Radix UI + Tailwind + class-variance-authority. See
    Section 7 for full listing.

  data/ — Static JSON data. magnets.json is the magnet link database.

  docs/ — Project documentation (phase reports, deployment guides, competitive
    analysis). These are historical reference, not actively parsed by the app.

  e2e/ — Playwright E2E tests. Require a running dev server + mock AniList
    server. Config in playwright.config.ts. Tests cover home page, video
    player, WebTorrent player, user journeys, and loading animations.

  electron/ — Electron wrapper for desktop builds. main.ts is the entry point,
    preload.ts sets up the IPC bridge. Build config is in package.json under
    the "build" key. Targets: Windows (NSIS, portable), macOS (DMG, zip),
    Linux (AppImage, deb, rpm).

  lib/ — Core business logic. This is the brain of the app. Each file is a
    focused module. See Section 8 for detailed descriptions.

  public/ — Static files served at root. manifest.json + sw.js enable PWA.
    SVG placeholders for missing anime images.

  scripts/ — Dev/build utilities. dev.js orchestrates the dev environment.
    mock-anilist-server.js provides test fixtures on port 4000.

  services/ — Standalone Node.js services that can run independently.
    anime-tracker.ts monitors airing schedules. seed-server.js runs a
    torrent seed box. anime-scraper.js scrapes anime metadata.

  store/ — Single Zustand store (store/index.ts). 1118 lines. Contains all
    state slices: watch history, favorites, watchlist, user preferences,
    subtitle styles, notifications, achievements, seed tracking, custom lists,
    and AniList user data. Uses persist middleware for localStorage.

  tests/ — Vitest unit tests. Config in vitest.config.ts. Coverage via v8.
    Tests cover torrent-finder, webtorrent-manager, hybrid-stream-manager.

  types/ — Shared TypeScript interfaces. anilist.ts is the largest (353 lines)
    and defines the full AniList GraphQL schema types.


================================================================================
  5. ROUTING & PAGES (app/)
================================================================================

  Route                       | File                                    | Description
  ----------------------------|-----------------------------------------|---------------------------
  /                           | app/page.tsx (426 lines)                | Home — hero, trending, continue watching, personalized recs
  /about                      | app/about/page.tsx                      | About the app
  /achievements               | app/achievements/page.tsx               | User achievement gallery
  /admin/login                | app/admin/login/page.tsx                | Admin sign-in page
  /admin/dashboard            | app/admin/dashboard/page.tsx            | Admin panel dashboard
  /admin/magnets              | app/admin/magnets/page.tsx              | Admin magnet management
  /anime/[id]                 | app/anime/[id]/page.tsx                 | Anime detail — info, episodes, characters
  /batch                      | app/batch/page.tsx                      | Batch anime operations
  /coming-soon                | app/coming-soon/page.tsx                | Upcoming anime
  /dmca                       | app/dmca/page.tsx                       | DMCA notice
  /faq                        | app/faq/page.tsx                        | FAQ page
  /favorites                  | app/favorites/page.tsx                  | User favorites list
  /genre/[genre]              | app/genre/[genre]/page.tsx              | Anime by genre
  /genres                     | app/genres/page.tsx                     | Genre listing
  /hidden-gems                | app/hidden-gems/page.tsx                | Lesser-known anime discovery
  /history                    | app/history/page.tsx                    | Watch history
  /lists                      | app/lists/page.tsx                      | Custom anime lists
  /popular                    | app/popular/page.tsx                    | Popular anime
  /privacy                    | app/privacy/page.tsx                    | Privacy policy
  /profile                    | app/profile/page.tsx (460 lines)        | User profile + settings
  /random                     | app/random/page.tsx                     | Random anime (own layout)
  /schedule                   | app/schedule/page.tsx                   | Airing schedule calendar
  /search                     | app/search/page.tsx                     | Anime search
  /seasonal                   | app/seasonal/page.tsx                   | Seasonal anime
  /settings                   | app/settings/page.tsx (1411 lines)      | All app settings
  /stats                      | app/stats/page.tsx (447 lines)          | Viewing statistics
  /studios                    | app/studios/page.tsx                    | Studios listing
  /studios/[id]               | app/studios/[id]/page.tsx               | Studio detail
  /terms                      | app/terms/page.tsx                      | Terms of service
  /top-rated                  | app/top-rated/page.tsx                  | Top rated anime
  /trending                   | app/trending/page.tsx                   | Trending anime
  /watch/[animeId]/[episode]  | app/watch/[animeId]/[episode]/page.tsx  | Episode player page
  /watchlist                  | app/watchlist/page.tsx (140 lines)      | Plan-to-watch list


================================================================================
  6. API ROUTES (app/api/)
================================================================================

  Endpoint                                    | File                                | Purpose
  --------------------------------------------|-------------------------------------|---------------------------
  GET /api/health                             | app/api/health/route.ts             | Health check endpoint
  GET /api/feature-flags                      | app/api/feature-flags/route.ts      | Feature flag status
  GET /api/search-suggestions?q=              | app/api/search-suggestions/route.ts | Search autocomplete
  GET /api/video-sources/[animeId]/[episode]  | app/api/video-sources/.../route.ts  | Resolve video streams
  GET /api/torrent-sources/[animeId]/[episode]| app/api/torrent-sources/.../route.ts| Resolve torrent sources
  GET /api/aniskip/[malId]/[episode]          | app/api/aniskip/.../route.ts        | Intro/outro skip times
  GET /api/filler/[malId]                     | app/api/filler/.../route.ts         | Filler episode markers
  GET /api/proxy-hls?url=                     | app/api/proxy-hls/route.ts          | HLS proxy (CORS bypass)
  GET /api/proxy-subtitle?url=                | app/api/proxy-subtitle/route.ts     | Subtitle proxy
  POST /api/download-hls                      | app/api/download-hls/route.ts       | Download HLS as archive
  GET /api/scrape                             | app/api/scrape/route.ts             | Scrape trigger
  POST /api/analytics/events                  | app/api/analytics/events/route.ts   | Log analytics events
  GET /api/analytics/summary                  | app/api/analytics/summary/route.ts  | Analytics summary data
  GET /api/magnets/ratings                    | app/api/magnets/ratings/route.ts    | Magnet ratings
  POST /api/magnets/comments                  | app/api/magnets/comments/route.ts   | Magnet comments
  POST /api/magnets/flags                     | app/api/magnets/flags/route.ts      | Flag broken magnets
  GET /api/watch-party/rooms                  | app/api/watch-party/rooms/route.ts  | List watch party rooms
  GET /api/watch-party/rooms/[roomId]         | app/api/watch-party/rooms/.../route.ts | Room details
  POST /api/admin/login                       | app/api/admin/login/route.ts        | Admin JWT login
  GET /api/admin/feature-flags                | app/api/admin/feature-flags/route.ts| Admin flag management
  GET/POST/PATCH /api/admin/alerts            | app/api/admin/alerts/route.ts       | Admin alert system
  GET/POST /api/admin/magnets                 | app/api/admin/magnets/route.ts      | Admin magnet CRUD
  POST /api/admin/magnets/bulk-import         | app/api/admin/magnets/bulk-import/route.ts | Bulk import magnets
  POST /api/admin/magnets/validate            | app/api/admin/magnets/validate/route.ts    | Validate magnet links
  GET /api/admin/seed-server/status           | app/api/admin/seed-server/status/route.ts | Seed server status
  GET /api/admin/torrents/health              | app/api/admin/torrents/health/route.ts | Torrent health snapshot


================================================================================
  7. COMPONENTS (components/)
================================================================================

  --- anime/ — Anime display components ---
  anime-card.tsx            Card for anime in grids (cover, title, score)
  anime-grid.tsx            Responsive grid of AnimeCards
  anime-actions.tsx         Action buttons (favorite, watchlist, share, rate)
  airing-countdown.tsx      Live countdown to next episode airing
  cache-anime.tsx           Prefetch/cache anime data for detail pages
  mark-all-watched.tsx      Mark all episodes as watched
  user-rating.tsx           Star rating component

  --- comments/ — Comment sections ---
  comments-section.tsx      Generic comments section
  episode-comments.tsx      Episode-specific comment thread

  --- error/ — Error handling ---
  error-boundary.tsx        React error boundary (catches render errors)
  error-fallback.tsx        Fallback UI shown on error
  client-error-boundary.tsx Client-side error boundary wrapper

  --- layout/ — Page structure ---
  header.tsx (570 lines)    Top navigation bar, search, user menu, notifications
  footer.tsx                Site footer with links
  mobile-nav.tsx            Mobile bottom navigation bar
  page-layout.tsx           Reusable page layout wrapper
  global-components.tsx     Components rendered globally (toasts, mini-player)
  app-suite-orchestrator.tsx Orchestrates app-level initialization

  --- lists/ — List management ---
  batch-operations.tsx      Bulk add/remove from lists

  --- notifications/ — Notifications ---
  episode-notifications.tsx (543 lines) Episode airing notifications
  notification-settings.tsx Notification preferences

  --- player/ — Video player suite (most complex components) ---
  enhanced-video-player.tsx (3021 lines) Main player: HLS + WebTorrent + controls
  video-source-loader.tsx (692 lines)    Source resolution & loading
  dash-player.tsx (408 lines)            DASH player (dash.js)
  webtorrent-player.tsx (383 lines)      WebTorrent P2P player
  watch-party.tsx (583 lines)            Real-time watch party
  server-selector.tsx                    Streaming server picker
  download-button.tsx                    Episode download button
  share-dialog.tsx                       Share episode dialog
  report-dialog.tsx                      Report broken source dialog
  episode-list.tsx                       Episode list with progress
  episode-thumbnails.tsx                 Episode thumbnail previews
  keyboard-shortcuts.tsx                 Player keyboard shortcuts
  mini-player.tsx                        Picture-in-picture mini player
  mini-player-activator.tsx              Activates mini player on navigate
  torrent-quality-selector.tsx           Torrent quality picker

  --- providers/ — React context ---
  theme-provider.tsx        Dark/light theme context provider

  --- pwa/ — Progressive Web App ---
  service-worker-register.tsx  Registers the service worker
  install-prompt.tsx           "Install App" prompt for PWA

  --- recommendations/ — Personalized discovery ---
  ai-recommendations.tsx          Recommendation list component
  ai-recommendations-section.tsx  Section wrapper for home page

  --- search/ — Search UI ---
  anime-filters.tsx          Advanced anime filters (genre, year, format, status)
  recent-searches.tsx        Recent search history display

  --- seed-tracking/ — P2P tracking ---
  seed-stats-badge.tsx       Seed ratio/stats badge overlay

  --- settings/ — Settings panels ---
  streaming-settings.tsx     Streaming quality & source settings
  subtitle-settings.tsx (401 lines) Subtitle appearance & language
  performance-settings.tsx (505 lines) Performance & bandwidth tuning
  analytics-settings.tsx     Analytics opt-in/out
  seed-tracking-settings.tsx Seed tracking preferences

  --- stats/ — Statistics ---
  share-stats-card.tsx       Shareable stats card image

  --- ui/ — Reusable primitives (Radix + Tailwind) ---
  button.tsx                 Button (variants: default, glass, outline, ghost)
  badge.tsx                  Status/tag badge
  input.tsx                  Text input
  label.tsx                  Form label
  dialog.tsx                 Modal dialog (Radix Dialog)
  accordion.tsx              Collapsible accordion (Radix)
  switch.tsx                 Toggle switch (Radix)
  glass-card.tsx             Glassmorphism card container
  image-with-fallback.tsx    Image with fallback placeholder
  skeleton.tsx               Loading skeleton placeholders
  shortcuts-modal.tsx        Keyboard shortcuts reference modal

  --- watch/ — Watch page specific ---
  episode-comments-section.tsx Episode comments on watch page

  --- Root ---
  continue-watching.tsx      "Continue Watching" horizontal strip for home


================================================================================
  8. LIBRARY & BUSINESS LOGIC (lib/)
================================================================================

  anilist.ts (371 lines)
    AniList GraphQL API client. Defines MEDIA_MINIMAL_FRAGMENT and
    MEDIA_FULL_FRAGMENT for reusable field selection. Methods: getTrending,
    getPopular, search, getMediaById, getAiringSchedule, getStudio, etc.
    All API calls go through this module.

  anilist-sync.ts
    Syncs local watch state to AniList media lists (CURRENT, PLANNING,
    COMPLETED, DROPPED, PAUSED, REPEATING).

  auth.ts (477 lines)
    JWT authentication for admin panel. Generates access tokens (1h) and
    refresh tokens (7d). bcrypt password hashing (12 rounds). Uses
    JWT_SECRET from env. Admin user management.

  torrent-finder.ts (974 lines) — LARGEST LIB FILE
    Discovers magnet links from Nyaa.si, Nyaa.land, AniDex. Parses HTML
    with cheerio. Validates infoHashes with parse-torrent. Ranks results
    by seeders, quality, size.

  webtorrent-manager.ts (381 lines)
    Manages WebTorrent client lifecycle. Creates/destroys torrent instances.
    Tracks download/upload progress. Handles peer connections.

  hybrid-stream-manager.ts (599 lines)
    Auto-switches between HLS, WebTorrent, and DASH based on availability
    and performance. Falls back gracefully. Tracks method history.

  video-sources-robust.ts (696 lines)
    Multi-source video resolution. Tries multiple providers in parallel.
    Returns the first successful source. Handles timeouts and retries.

  p2pml-manager.ts (314 lines)
    P2P Media Loader for HLS. Integrates with hls.js for segment sharing
    between peers. Reduces CDN bandwidth costs.

  dash-manager.ts (238 lines)
    DASH stream manager (singleton). Loads DASH manifests as alternative
    to HLS. Falls back to HLS if DASH unavailable.

  websocket-server.ts (573 lines)
    Socket.IO server for watch party. Manages rooms, viewers, playback
    sync (play, pause, seek), chat messages, timeline reactions.
    Room auto-cleanup after 24h inactivity.

  recommendations.ts (354 lines)
    Heuristic recommendation engine. Analyzes watch history to build genre/format/
    studio preference profiles. Scores candidate anime by match percentage.
    Provides human-readable reasons for each recommendation.

  analytics-tracker.ts (321 lines)
    Client-side analytics. Batches events (10 items or 30s interval).
    Tracks: playback_start, playback_end, fallback, buffering, torrent_stats,
    quality_change, playback_error. Sends batched payloads to
    /api/analytics/events, including unload beacons.

  seed-tracker.ts (341 lines)
    Tracks P2P seed ratios. Manages seed sessions, computes stats, unlocks
    achievements (first_seed, seed_1gb, seed_10gb, ratio_2, etc.). Ranks:
    bronze, silver, gold, platinum, diamond.

  feature-flags.ts (299 lines)
    Gradual rollout system. Phases: admin-only → beta-10 → beta-50 → full.
    Flags: WEBTORRENT_STREAMING, HYBRID_STREAMING, TORRENT_PRELOADING,
    BANDWIDTH_THROTTLING, SEED_TRACKING.

  bandwidth-manager.ts (614 lines)
    Controls upload/download bandwidth for P2P. Throttles based on user
    settings and network conditions.

  torrent-preloader.ts (680 lines)
    Preloads next episode's torrent while current is playing. Predicts
    viewing patterns from watch history.

  torrent-stream-loader.ts (425 lines)
    Loads and manages torrent-to-stream conversion. Handles piece
    prioritization for seeking.

  torrent-subtitle-loader.ts (419 lines)
    Extracts subtitle files from torrent payloads. Supports SRT, ASS, VTT.

  dht-optimizer.ts (526 lines)
    Optimizes DHT peer discovery for faster torrent starts.

  downloads.ts (387 lines)
    Episode download logic. Fetches HLS segments and packages as archive.

  jikan.ts (440 lines)
    Jikan API client (unofficial MAL API). Used as secondary data source.

  mal-api.ts
    MyAnimeList official API client. OAuth + REST.

  constants.ts (315 lines)
    App-wide constants: API URLs, pagination sizes, image URL templates,
    genre lists, format labels, status labels, storage keys, defaults.

  utils.ts (300 lines)
    Utilities: cn() (Tailwind merge), formatDistanceToNow, formatRelativeTime,
  | slugify, truncateText, debounce, throttle, formatDuration, etc.

  storage.ts (100 lines)
    Safe localStorage wrapper. Handles private browsing, quota exceeded,
    SSR (window undefined).

  logger.ts (70 lines)
    Scoped logger. Only outputs in dev or when NEXT_PUBLIC_ENABLE_LOGGING=true.
    Levels: error, warn, info, log, debug.

  achievements.ts
    Achievement definitions and unlock requirement checking.

  alerts-manager.ts
    Admin alert system for system notifications. Uses shared monitoring-data
    helpers instead of server-side relative fetch calls.

  monitoring-data.ts
    Shared analytics summary and health snapshot loader. Reads analytics event
    logs and magnet data for admin routes and alerts.

  aniskip.ts
    AniSkip API client. Returns intro/outro timestamps for auto-skip.

  custom-lists.ts
    Custom user-created anime lists (beyond built-in favorites/watchlist).

  episode-comments.ts
    Server-side episode comment storage and retrieval.

  filler-detection.ts
    Identifies filler episodes using external databases.

  html-sanitizer.ts
    Sanitizes user-generated HTML (comments, descriptions).

  keyboard-shortcuts.ts
    Keyboard shortcut definitions for the video player.

  notifications.ts
    Notification scheduling and management.

  ratings.ts
    Rating computation and aggregation logic.

  stats.ts
    User viewing statistics computation.

  use-feature-flag.ts
    React hook wrapping the feature flag system for component use.

  webtorrent.ts
    WebTorrent client initialization helpers.


================================================================================
  9. STATE MANAGEMENT (store/)
================================================================================

  store/index.ts — Single Zustand store (1118 lines) with persist middleware.

  State Slices:
    - watchHistory: WatchHistoryItem[] — episodes watched with progress
    - anilistUser: AniListUser | null — logged-in AniList user
    - anilistMediaList: AniListMediaEntry[] — user's AniList entries
    - favorites: number[] — favorite anime IDs
    - watchlist: number[] — plan-to-watch anime IDs
    - preferences: { theme, streamingQuality, autoPlay, etc. }
    - subtitleStyle: SubtitleStyle — font, color, background, position
    - notifications: Notification[] — app notifications
    - customLists: CustomList[] — user-created anime lists
    - seedStats: SeedStats — P2P seeding statistics
    - achievements: unlocked achievement IDs

  Key Actions:
    - addWatchHistory, updateWatchProgress, clearWatchHistory
    - setAniListUser, updateAniListMediaList
    - toggleFavorite, toggleWatchlist
    - updatePreferences, updateSubtitleStyle
    - unlockAchievement
    - addCustomList, removeCustomList, addAnimeToList

  Persistence: localStorage via zustand/middleware persist. Keys defined
  in lib/constants.ts STORAGE_KEYS.


================================================================================
  10. TYPE DEFINITIONS (types/)
================================================================================

  anilist.ts (353 lines)
    Full AniList GraphQL schema types: Media, Title, CoverImage, MediaListResponse,
    TrendingResponse, SearchResponse, AiringResponse, StudioListResponse, etc.
    Also defines MediaType, MediaFormat, MediaStatus, MediaSeason, MediaSource,
    MediaRelationType, ExternalLinkType.

  analytics.ts (131 lines)
    Streaming event types: PlaybackStartEvent, PlaybackEndEvent, FallbackEvent,
    BufferingEvent, TorrentStatsEvent, QualityChangeEvent. Union type
    AnalyticsEvent. StreamingMethod = "hls" | "webtorrent" | "hybrid".

  magnet-ratings.ts (64 lines)
    MagnetRating, MagnetComment, MagnetSourceStats, MagnetFlag types for
    the community feedback system.

  seed-tracking.ts (55 lines)
    SeedSession, SeedStats, SeedAchievement, SeedRank types for P2P
    seeding tracking.


================================================================================
  11. SERVICES (services/)
================================================================================

  anime-scraper.js — Standalone scraper for anime metadata. Can be run
    independently to populate local data.

  anime-tracker.ts — Monitors airing schedules and tracks new episodes.
    Run via `npm run tracker:start` or `npm run tracker:dev` (with nodemon).

  seed-server.js — Torrent seed server. Keeps torrents seeding to maintain
    swarm health. Monitored via /api/admin/seed-server/status.


================================================================================
  12. ELECTRON DESKTOP APP (electron/)
================================================================================

  main.ts — Electron main process. Creates BrowserWindow, loads Next.js app.
    Handles IPC for native features (downloads, notifications, system tray).

  preload.ts — Preload script. Exposes safe APIs to renderer via contextBridge.

  tsconfig.json — Separate TypeScript config for Electron (compiles to JS).

  Build: `npm run electron:dev` (dev) or `npm run electron:build` (package).
  Config in package.json "build" key. Targets: Win (NSIS), Mac (DMG),
  Linux (AppImage/deb/rpm).


================================================================================
  13. SCRIPTS (scripts/)
================================================================================

  dev.js                  — Custom dev server launcher (orchestrates Next.js)
  start-next-webpack.mjs  — Starts Next.js with webpack (not turbopack)
  mock-anilist-server.js  — Mock AniList GraphQL server for E2E tests (port 4000)
  smoke-test.mjs          — Quick smoke test of running instance
  generate-demo-video.py  — Python script to generate demo video file
  visual-player-check.js  — Automated visual verification of player UI


================================================================================
  14. TESTING
================================================================================

  Unit Tests (Vitest):
    tests/unit/torrent-finder.test.ts          — Torrent discovery logic
    tests/unit/webtorrent-manager.test.ts      — WebTorrent lifecycle
    tests/unit/hybrid-stream-manager.test.ts   — Source switching logic
    tests/browser-compatibility.spec.ts        — Browser compat checks
    Run: npm test | npm run test:watch | npm run test:coverage

  E2E Tests (Playwright):
    e2e/home-page.spec.ts            — Home page rendering
    e2e/video-player.spec.ts         — Video player functionality
    e2e/webtorrent-player.spec.ts    — WebTorrent P2P playback
    e2e/user-journey.spec.ts         — Full user flow
    e2e/real-user-flow.spec.ts       — Realistic usage patterns
    e2e/loading-animations.spec.ts   — Loading state animations
    e2e/screenshots.spec.ts          — Visual regression screenshots
    Run: npm run test:e2e

  Config:
    vitest.config.ts — Vitest config (happy-dom, v8 coverage)
    playwright.config.ts — Playwright config (5 projects: Chromium, Firefox,
      WebKit, Mobile Chrome, Mobile Safari. 2-minute timeout. 2 web servers.)


================================================================================
  15. CONFIGURATION FILES
================================================================================

  package.json         — Dependencies, scripts, Electron build config
  tsconfig.json        — TypeScript config (strict mode, path aliases: @/*)
  tsconfig.build.json  — Separate TS config for `tsc --noEmit` pre-build check
  next.config.ts       — Next.js config (standalone output, image domains,
                         PWA headers, Turbopack settings, webpack overrides)
  vitest.config.ts     — Vitest config (happy-dom, path aliases, coverage)
  playwright.config.ts — Playwright config (multi-browser, mock servers)
  eslint.config.mjs    — ESLint flat config (next/core-web-vitals + TypeScript)
  postcss.config.mjs   — PostCSS config (for Tailwind)
  Dockerfile           — Multi-stage Docker build (deps → builder → runner)
  docker-compose.yml   — Production: app + Postgres + Redis
  docker-compose.dev.yml — Development compose
  .env.example         — Environment variable template
  .gitignore           — Ignores: node_modules, .next, out, .env*, coverage


================================================================================
  16. ENVIRONMENT VARIABLES
================================================================================

  Required:
    NEXT_PUBLIC_ANILIST_CLIENT_ID   — AniList OAuth client ID
    ANILIST_CLIENT_SECRET           — AniList OAuth client secret
    NEXT_PUBLIC_APP_URL             — Full app URL (no trailing slash)
    NEXT_PUBLIC_SITE_URL            — Same as APP_URL
    NEXT_PUBLIC_BASE_URL            — Same as APP_URL

  Required:
    JWT_SECRET                      — Secret for admin JWT tokens (NO default — app throws if missing)
    DEFAULT_ADMIN_USERNAME           — Default admin username (NO default — app throws if missing)
    DEFAULT_ADMIN_PASSWORD           — Default admin password (NO default — app throws if missing)

  Optional:
    ANILIST_GRAPHQL_URL             — Override AniList API URL
    NEXT_PUBLIC_MAL_CLIENT_ID       — MAL OAuth client ID
    MAL_CLIENT_SECRET               — MAL OAuth client secret
    NEXT_PUBLIC_ENABLE_LOGGING      — "true" to enable verbose logs
    NEXT_PUBLIC_LOG_LEVEL           — debug | info | warn | error


================================================================================
  17. DOCKER & DEPLOYMENT
================================================================================

  Dockerfile — Multi-stage:
    1. base: node:20-alpine + python3, make, g++, openssl
    2. deps: npm ci --only=production
    3. builder: full npm ci + next build
    4. runner: minimal image with standalone output

  docker-compose.yml — Production stack:
    - app: Next.js on port 3000
    - postgres: PostgreSQL 15-alpine (port 5432)
    - redis: Redis 7-alpine (port 6379)
    All on "anime-stream-network". Health checks configured.

  docker-compose.dev.yml — Development overrides.

  Deploy commands:
    docker-compose up -d            (production)
    docker-compose -f docker-compose.dev.yml up  (development)


================================================================================
  18. DATA FLOW & ARCHITECTURE
================================================================================

  [User Browser]
       │
       ├──→ [Next.js App Router] ──→ Renders React pages (SSR/RSC)
       │         │
       │         ├──→ [lib/anilist.ts] ──→ AniList GraphQL API
       │         ├──→ [lib/jikan.ts] ──→ Jikan/MAL REST API
       │         ├──→ [app/api/*] ──→ Next.js API Routes
       │         │       │
       │         │       ├──→ [lib/video-sources-robust.ts] → Stream resolution
       │         │       ├──→ [lib/torrent-finder.ts] → Magnet link discovery
       │         │       ├──→ [lib/auth.ts] → JWT admin auth
       │         │       ├──→ [lib/analytics-tracker.ts] → Event logging
       │         │       └──→ [lib/websocket-server.ts] → Socket.IO watch party
       │         │
       │         └──→ [store/index.ts] → Zustand + localStorage persistence
       │
       ├──→ [components/player/enhanced-video-player.tsx]
       │         │
       │         ├──→ [hls.js] → HLS streaming
       │         ├──→ [dash.js] → DASH streaming
       │         ├──→ [webtorrent] → P2P torrent streaming
       │         └──→ [p2p-media-loader] → P2P segment sharing over HLS
       │
       └──→ [public/sw.js] → PWA service worker (caching)

  External APIs:
    - AniList GraphQL (graphql.anilist.co) — Primary anime data source
    - Jikan API (api.jikan.moe) — Secondary MAL data
    - MAL OAuth (myanimelist.net) — User auth
    - AniList OAuth (anilist.co) — User auth
    - Nyaa.si / Nyaa.land / AniDex — Torrent source scraping
    - AniSkip — Intro/outro skip timestamps


================================================================================
  19. KEY ARCHITECTURAL PATTERNS
================================================================================

  1. APP ROUTER (Next.js 16)
     All pages use the App Router convention. Server Components by default.
     Client Components marked with "use client". Dynamic routes with [params].

  2. SINGLE STORE (Zustand)
     One global store in store/index.ts with multiple slices. Persisted to
     localStorage. No Redux, no Context for global state.

  3. LIBRARY MODULES (lib/)
     Each lib/ file is a focused module, usually exporting a class (often
     singleton) or a set of functions. No circular dependencies. Clean API.

  4. COMPONENT HIERARCHY
     Page (app/) → Layout Components → Domain Components → UI Primitives.
     UI primitives in components/ui/ are generic and reusable.

  5. VIDEO STREAMING FALLBACK CHAIN
     enhanced-video-player.tsx tries: HLS → WebTorrent → DASH.
     hybrid-stream-manager.ts auto-switches based on performance.

  6. P2P ARCHITECTURE
     WebTorrent for full-torrent streaming. p2p-media-loader for HLS P2P.
     Bandwidth managed. Seed ratio tracked. DHT optimized.

  7. FEATURE FLAGS
     New features behind flags. Gradual rollout: admin → 10% → 50% → 100%.

  8. PWA SUPPORT
     manifest.json + sw.js + install-prompt.tsx. Caches static assets for
     offline access. Service worker skips in development.

  9. ADMIN PANEL
     JWT-protected admin routes under /admin. Feature flag management,
     magnet CRUD, alerts, seed server monitoring.

  10. MULTI-PLATFORM
      Web (Next.js), Desktop (Electron), PWA (installable). Same codebase.


================================================================================
  20. LARGEST FILES (COMPLEXITY HOTSPOTS)
================================================================================

  Lines   File
  ------  --------------------------------------------------------
  3021    components/player/enhanced-video-player.tsx  ← Most complex
  1411    app/settings/page.tsx
  1118    store/index.ts
   974    lib/torrent-finder.ts
   696    lib/video-sources-robust.ts
   692    components/player/video-source-loader.tsx
   680    lib/torrent-preloader.ts
   627    app/globals.css
   614    lib/bandwidth-manager.ts
   599    lib/hybrid-stream-manager.ts
   583    components/player/watch-party.tsx
   573    lib/websocket-server.ts
   570    components/layout/header.tsx
   543    components/notifications/episode-notifications.tsx
   526    lib/dht-optimizer.ts
   505    components/settings/performance-settings.tsx
   477    lib/auth.ts
   460    app/profile/page.tsx
   447    app/stats/page.tsx
   440    lib/jikan.ts
   426    app/page.tsx
   425    lib/torrent-stream-loader.ts
   419    lib/torrent-subtitle-loader.ts
   408    components/player/dash-player.tsx
   401    components/settings/subtitle-settings.tsx
   387    lib/downloads.ts
   383    components/player/webtorrent-player.tsx
   381    lib/webtorrent-manager.ts
   371    lib/anilist.ts

  Total source code: ~36,850 lines across app/, components/, lib/, store/, types/.


================================================================================
  21. CLI TOOLS REFERENCE FOR LLMs
================================================================================

  When exploring or debugging this codebase, use these commands for maximum
  efficiency. These are PREFERRED over reading entire files blindly.

  --- Find files by name or glob ---
  find . -name "*.tsx" -path "*/player/*"            Find player components
  find . -name "route.ts"                            List all API routes
  ls -la lib/                                        Quick lib directory listing

  --- Search inside files (grep / rg) ---
  grep -rn "use client" components/                  Find client components
  grep -rn "export async function" app/              Find server-side data fetchers
  grep -rn "interface\|type " types/                 All type definitions
  grep -rn "SOCKET_IO\|socket\.io" lib/              WebSocket related code
  grep -rn "fetch\|axios" lib/                       All HTTP requests
  grep -rn "graphql\|GRAPHQL" lib/                   GraphQL queries
  grep -rn "WebTorrent\|webtorrent" lib/ components/  Torrent-related code
  grep -rn "Hls\|hls\.js" lib/ components/           HLS streaming code
  grep -rn "Zustand\|create(" store/                  State management
  grep -rn "persist\|localStorage" store/ lib/       Persistence layer

  --- Read specific files (head / tail) ---
  head -50 lib/anilist.ts                            See AniList client top
  tail -30 store/index.ts                            See store exports
  head -80 app/page.tsx                              Home page data fetching

  --- Count lines / measure size ---
  wc -l lib/*.ts                                     Lines per lib module
  wc -l components/**/*.tsx                          Lines per component
  find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20
                                                     Top 20 largest source files

  --- Understand imports / dependencies ---
  grep -rn "from.*@/lib" app/ components/            What uses lib/ modules
  grep -rn "from.*@/store" app/ components/          What uses the store
  grep -rn "from.*@/types" lib/ components/          What uses type definitions

  --- Git operations ---
  git log --oneline -20                              Recent commits
  git diff --stat                                    See what changed
  git diff HEAD~1 -- app/ lib/ store/                Changes in core directories

  --- Quick health checks ---
  npm run lint                                       Lint the codebase
  npm run build                                      Attempt a build
  npm test                                           Run unit tests
  cat package.json | grep -A30 '"scripts"'           See all npm scripts

  --- Navigate directory tree ---
  tree -I 'node_modules|.next|.git|out' -L 3        Clean tree view
  find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | sort
                                                     All directories


================================================================================
  22. MANDATORY UPDATE PROTOCOL
================================================================================

  ******************************************************************************
  *  WHENEVER YOU MODIFY THIS CODEBASE, YOU MUST UPDATE THIS FILE IF YOUR     *
  *  CHANGES MATCH ANY OF THE FOLLOWING CRITERIA:                             *
  ******************************************************************************

  Update this file when:
    1. A new file is created anywhere in the project
    2. A file is deleted or renamed
    3. A new directory is added
    4. A new npm dependency is added or removed (update Tech Stack, Section 2)
    5. A new page/route is added (update Sections 5 or 6)
    6. A new API endpoint is created (update Section 6)
    7. A new component is created (update Section 7)
    8. A new lib module is created or significantly changed (update Section 8)
    9. A new store slice is added (update Section 9)
   10. A new type definition file is added (update Section 10)
   11. Environment variables change (update Section 16)
   12. Docker/deployment config changes (update Section 17)
   13. The data flow or architecture changes (update Sections 18-19)
   14. A file grows significantly and enters the top-30 list (update Section 20)

  Update procedure:
    1. Make your code changes
    2. Update the relevant section(s) in this tree_map.md
    3. Update the "Last updated" date at the top of this file
    4. Verify: search this file for the old file names / paths and replace them
    5. Commit tree_map.md alongside your code changes

  ******************************************************************************
  *  AN OUTDATED tree_map.md IS CONSIDERED A BUG. ALWAYS UPDATE IT.           *
  *  IF YOU ARE AN LLM AND YOU MODIFY THE CODEBASE, UPDATING THIS FILE IS     *
  *  NOT OPTIONAL — IT IS A HARD REQUIREMENT.                                  *
  ******************************************************************************

================================================================================
  22. QUICK "WHERE IS X?" LOOKUP TABLE
================================================================================

  Use this table to instantly locate any concept in the codebase without
  scanning directories.

  "I need to find..."                              | Where to look
  --------------------------------------------------|---------------------------
  The video player                                 | components/player/enhanced-video-player.tsx
  HLS streaming logic                              | components/player/enhanced-video-player.tsx (hlsRef)
  WebTorrent P2P streaming                         | components/player/webtorrent-player.tsx
  DASH streaming logic                             | components/player/dash-player.tsx + lib/dash-manager.ts
  Stream source resolution (which server to use)   | lib/video-sources-robust.ts
  Auto-switch between HLS/Torrent/DASH             | lib/hybrid-stream-manager.ts
  Torrent magnet link discovery                    | lib/torrent-finder.ts (scrapes Nyaa, AniDex)
  The AniList API client                           | lib/anilist.ts
  The MAL/Jikan API client                         | lib/mal-api.ts + lib/jikan.ts
  User authentication (JWT)                        | lib/auth.ts
  AniList OAuth flow                               | app/auth/anilist/callback/route.ts
  MAL OAuth flow                                   | app/auth/mal/route.ts + app/auth/mal/callback/route.ts
  Global state (Zustand store)                     | store/index.ts
  User preferences (theme, quality, etc.)          | store/index.ts → UserPreferences interface
  Watch history                                    | store/index.ts → watchHistory slice
  Favorites / Watchlist                            | store/index.ts → favorites / watchlist slices
  Anime type definitions                           | types/anilist.ts
  App constants (API URLs, genres, storage keys)   | lib/constants.ts
  The home page                                    | app/page.tsx
  The anime detail page                            | app/anime/[id]/page.tsx
  The watch/episode player page                    | app/watch/[animeId]/[episode]/page.tsx
  Site header / navigation                         | components/layout/header.tsx
  Site footer                                      | components/layout/footer.tsx
  Mobile navigation                                | components/layout/mobile-nav.tsx
  Settings page                                    | app/settings/page.tsx (1411 lines, all settings)
  Admin dashboard                                  | app/admin/dashboard/page.tsx
  Watch party (multi-device sync)                  | components/player/watch-party.tsx + lib/websocket-server.ts
  AI recommendations engine                        | lib/recommendations.ts
  Recommendation UI                                | components/recommendations/ai-recommendations.tsx
  Seed ratio / P2P tracking                        | lib/seed-tracker.ts + types/seed-tracking.ts
  Feature flag system                              | lib/feature-flags.ts + lib/use-feature-flag.ts
  Analytics event tracking                         | lib/analytics-tracker.ts + types/analytics.ts
  Episode comments                                 | components/comments/ + lib/episode-comments.ts
  Magnet ratings / community feedback              | types/magnet-ratings.ts + app/api/magnets/
  Search functionality                             | app/search/page.tsx + app/api/search-suggestions/
  Airing schedule                                  | app/schedule/page.tsx
  PWA service worker                               | public/sw.js + components/pwa/service-worker-register.tsx
  PWA install prompt                               | components/pwa/install-prompt.tsx
  Error boundaries                                 | components/error/error-boundary.tsx
  Loading skeletons                                | components/ui/skeleton.tsx
  Tailwind class merge utility (cn)                | lib/utils.ts → cn() function
  HTML sanitizer                                   | lib/html-sanitizer.ts
  Logger utility                                   | lib/logger.ts
  Safe localStorage wrapper                        | lib/storage.ts
  Bandwidth management                             | lib/bandwidth-manager.ts
  Torrent preloading (next episode)                | lib/torrent-preloader.ts
  Torrent subtitle extraction                      | lib/torrent-subtitle-loader.ts
  DHT peer optimization                            | lib/dht-optimizer.ts
  Episode downloads                                | lib/downloads.ts + app/api/download-hls/
  Intro/outro skip (AniSkip)                       | lib/aniskip.ts
  Filler episode detection                         | lib/filler-detection.ts
  User achievements                                | lib/achievements.ts + app/achievements/page.tsx
  Custom user lists                                | lib/custom-lists.ts
  Notification system                              | lib/notifications.ts + components/notifications/
  P2P Media Loader (HLS segment sharing)           | lib/p2pml-manager.ts
  Docker configuration                             | Dockerfile + docker-compose.yml
  Environment variables template                   | .env.example
  TypeScript config                                | tsconfig.json + tsconfig.build.json
  Test configuration                               | vitest.config.ts + playwright.config.ts
  ESLint configuration                             | eslint.config.mjs
  Next.js configuration                            | next.config.ts
  Electron desktop entry point                     | electron/main.ts
  Competitor analysis data                         | analysis/
  Project documentation                            | docs/
  The data flow diagram                            | Section 18 of THIS file


================================================================================
  23. SERVER vs CLIENT COMPONENT BOUNDARY
================================================================================

  Next.js App Router splits components into Server Components (default) and
  Client Components (must have "use client"). Getting this wrong is the #1
  source of bugs. Here is the complete map.

  --- SERVER COMPONENTS (no "use client") ---
  These render on the server. They can do async data fetching (await fetch,
  await anilist.getById, etc.), access databases, and use Node.js APIs.
  They CANNOT use: useState, useEffect, event handlers, browser APIs, Zustand.

    app/layout.tsx                 Root layout (imports client providers)
    app/page.tsx                   Home page (fetches trending, popular, airing)
    app/anime/[id]/page.tsx        Anime detail (fetches anime data server-side)
    app/watch/[animeId]/[episode]/page.tsx  Watch page (fetches anime data)
    app/about/page.tsx             Static about page
    app/batch/page.tsx             Batch operations page
    app/coming-soon/page.tsx       Upcoming anime
    app/dmca/page.tsx              DMCA page
    app/faq/page.tsx               FAQ page
    app/genre/[genre]/page.tsx     Genre detail
    app/genres/page.tsx            Genre listing
    app/hidden-gems/page.tsx       Hidden gems
    app/popular/page.tsx           Popular anime
    app/privacy/page.tsx           Privacy policy
    app/schedule/page.tsx          Airing schedule
    app/search/page.tsx            Search page
    app/seasonal/page.tsx          Seasonal anime
    app/studios/page.tsx           Studios listing
    app/studios/[id]/page.tsx      Studio detail
    app/terms/page.tsx             Terms page
    app/top-rated/page.tsx         Top rated
    app/trending/page.tsx          Trending page
    app/random/layout.tsx          Random layout wrapper
    app/template.tsx               Route template
    app/globals.css                Global styles (not a component)
    ALL app/api/**/route.ts        API route handlers (server-only by nature)
    ALL app/auth/**/route.ts       OAuth callback handlers

  --- CLIENT COMPONENTS (have "use client") ---
  These render in the browser. They CAN use: useState, useEffect, event
  handlers, browser APIs, Zustand, localStorage. They CANNOT do async
  data fetching directly (must use useEffect + fetch or receive data as props).

    app/settings/page.tsx          Settings (uses store)
    app/achievements/page.tsx      Achievements (uses store)
    app/lists/page.tsx             Lists (uses store)
    app/favorites/page.tsx         Favorites (uses store)
    app/admin/dashboard/page.tsx   Admin dashboard
    app/admin/magnets/page.tsx     Admin magnets
    app/profile/page.tsx           Profile (uses store)
    app/history/page.tsx           History (uses store)
    app/random/page.tsx            Random anime
    app/stats/page.tsx             Stats (uses store)
    app/watchlist/page.tsx         Watchlist (uses store)
    app/error.tsx                  Error boundary (must be client)
    app/not-found.tsx              404 page

    ALL components/**/*.tsx        Every component under components/ is a client
                                   component (they all use "use client")

  --- KEY PATTERN: Server Page → Client Component data passing ---
  Server pages fetch data, then pass it as props to client components:

    // Server page (app/anime/[id]/page.tsx)
    async function AnimePage({ params }) {
      const anime = await anilist.getById(params.id);  // Server fetch
      return <AnimeDetailClient anime={anime} />;       // Pass to client
    }

    // Client component receives data as prop, uses store for interactivity


================================================================================
  24. IMPORT ALIAS REFERENCE
================================================================================

  tsconfig.json defines a single alias:

    @/*  →  ./*    (project root)

  Effective import patterns used throughout the codebase:

    import { anilist } from "@/lib/anilist"              Lib modules
    import { useStore } from "@/store"                    Zustand store
    import type { Media } from "@/types/anilist"          Type imports
    import { Button } from "@/components/ui/button"       UI primitives
    import { Header } from "@/components/layout/header"   Layout components
    import { cn } from "@/lib/utils"                      Tailwind merge
    import { ANILIST_API_URL } from "@/lib/constants"     Constants

  vitest.config.ts defines additional aliases for test resolution:

    @       → ./
    @/lib   → ./lib
    @/components → ./components
    @/app   → ./app
    @/store → ./store

  IMPORTANT: Always use @/ imports. Never use relative paths like
  "../../lib/anilist". The codebase consistently uses @/ everywhere.


================================================================================
  25. CRITICAL DEPENDENCY CHAINS ("If I Change X...")
================================================================================

  Use this map to understand blast radius of changes. If you modify a file
  on the left, you MUST verify the files on the right still work.

  If you change...                    | Also verify these files
  ------------------------------------|-------------------------------------------
  lib/anilist.ts                      | app/page.tsx, app/anime/[id]/page.tsx,
                                      | app/watch/[animeId]/[episode]/page.tsx,
                                      | app/trending/page.tsx, app/popular/page.tsx,
                                      | app/search/page.tsx, app/schedule/page.tsx,
                                      | app/seasonal/page.tsx, app/genre/[genre]/page.tsx,
                                      | app/studios/*.tsx, lib/recommendations.ts,
                                      | lib/anilist-sync.ts
                                      |
  types/anilist.ts (Media type)       | Nearly EVERY file — this is the core data type.
                                      | lib/anilist.ts, store/index.ts, all page components,
                                      | all anime/ components, lib/recommendations.ts
                                      |
  store/index.ts (Zustand store)      | app/settings/page.tsx, app/favorites/page.tsx,
                                      | app/watchlist/page.tsx, app/history/page.tsx,
                                      | app/profile/page.tsx, app/stats/page.tsx,
                                      | app/achievements/page.tsx, app/lists/page.tsx,
                                      | components/player/enhanced-video-player.tsx,
                                      | components/anime/anime-actions.tsx,
                                      | components/continue-watching.tsx
                                      |
  lib/constants.ts                    | store/index.ts, lib/anilist.ts, lib/analytics-tracker.ts,
                                      | every file that uses STORAGE_KEYS, API URLs, defaults
                                      |
  lib/video-sources-robust.ts         | app/api/video-sources/[animeId]/[episode]/route.ts,
                                      | components/player/video-source-loader.tsx
                                      |
  lib/hybrid-stream-manager.ts        | components/player/video-source-loader.tsx,
                                      | components/player/enhanced-video-player.tsx,
                                      | lib/torrent-preloader.ts
                                      |
  lib/torrent-finder.ts               | app/api/torrent-sources/[animeId]/[episode]/route.ts,
                                      | lib/torrent-preloader.ts, lib/torrent-stream-loader.ts
                                      |
  lib/webtorrent-manager.ts           | components/player/webtorrent-player.tsx,
                                      | lib/hybrid-stream-manager.ts, lib/seed-tracker.ts
                                      |
  lib/websocket-server.ts             | app/api/watch-party/rooms/route.ts,
                                      | components/player/watch-party.tsx, server-custom.js
                                      |
  lib/auth.ts                         | app/api/admin/login/route.ts,
                                      | ALL app/api/admin/* routes (JWT verification)
                                      |
  components/player/enhanced-video-   | app/watch/[animeId]/[episode]/page.tsx,
    player.tsx (3021 lines)           | components/player/video-source-loader.tsx
                                      |
  app/globals.css (design tokens)     | ALL components that use Tailwind custom classes,
                                      | components/ui/glass-card.tsx (glassmorphism vars)


================================================================================
  26. USER ACTION → CODE PATH TRACES
================================================================================

  These traces show the exact file-by-file execution path for common user
  actions. Follow these when debugging or adding features.

  --- TRACE 1: User opens the home page ---
  1. Browser requests /
  2. Next.js renders app/layout.tsx (root layout, wraps with providers)
  3. Next.js renders app/page.tsx (SERVER COMPONENT, ISR with 5-minute revalidate)
  4. getTrendingAnime() → lib/anilist.ts → AniList GraphQL API
  5. getPopularAnime() → lib/anilist.ts → AniList GraphQL API
  6. getLatestEpisodes() → lib/anilist.ts → AniList GraphQL API
  7. getAiringSchedule() → lib/anilist.ts → AniList GraphQL API
  8. Renders: Hero section, AnimeGrid, ContinueWatching, personalized recommendations
  9. ContinueWatching reads from Zustand store (localStorage)

  --- TRACE 2: User clicks play on an episode ---
  1. Browser navigates to /watch/[animeId]/[episode]
  2. app/watch/[animeId]/[episode]/page.tsx (SERVER COMPONENT)
  3. getAnimeData() → lib/anilist.ts → anilist.getById(id)
  4. Renders <VideoSourceLoader> with animeId + episode props
  5. components/player/video-source-loader.tsx (CLIENT COMPONENT)
  6. Calls /api/video-sources/[animeId]/[episode]
  7. app/api/video-sources/.../route.ts → lib/video-sources-robust.ts
  8. video-sources-robust.ts tries multiple providers, returns first success
  9. Renders <EnhancedVideoPlayer> with the source URL
 10. components/player/enhanced-video-player.tsx (3021 lines)
 11. If HLS: creates hls.js instance, attaches to <video>
 12. If Torrent: hands off to <WebTorrentPlayer>
 13. If DASH: hands off to <DashPlayer>
 14. Watch progress saved to Zustand store → localStorage

  --- TRACE 3: User searches for an anime ---
  1. User types in header search bar (components/layout/header.tsx)
  2. Debounced API call to /api/search-suggestions?q=...
  3. app/api/search-suggestions/route.ts → lib/anilist.ts → search()
  4. Returns matching anime → displayed as dropdown suggestions
  5. User clicks result → navigates to /anime/[id]
  6. app/anime/[id]/page.tsx fetches full anime data server-side

  --- TRACE 4: User adds anime to favorites ---
  1. User clicks heart icon on AnimeCard or AnimeActions
  2. components/anime/anime-actions.tsx calls useStore().toggleFavorite(id)
  3. store/index.ts updates favorites array → persists to localStorage
  4. If AniList user logged in: lib/anilist-sync.ts syncs to AniList

  --- TRACE 5: User joins a watch party ---
  1. User creates/joins room via components/player/watch-party.tsx
  2. POST /api/watch-party/rooms → creates room
  3. Socket.IO connection established → lib/websocket-server.ts
  4. Playback events (play, pause, seek) broadcast to all viewers
  5. Chat messages relayed through Socket.IO

  --- TRACE 6: Admin manages feature flags ---
  1. Admin logs in via /admin/login → POST /api/admin/login → lib/auth.ts (JWT)
  2. /admin/dashboard renders with admin JWT cookie
  3. Feature flags read from lib/feature-flags.ts
  4. PUT /api/admin/feature-flags → updates flag configuration

  --- TRACE 7: P2P torrent streaming ---
  1. EnhancedVideoPlayer detects torrent source
  2. <WebTorrentPlayer> creates WebTorrent client via lib/webtorrent-manager.ts
  3. lib/torrent-finder.ts provides magnet URI
  4. WebTorrent downloads pieces, streams to <video> via blob URL
  5. lib/bandwidth-manager.ts throttles upload/download
  6. lib/seed-tracker.ts records seeding stats → achievements
  7. lib/torrent-preloader.ts preloads next episode in background


================================================================================
  27. COMMON DEVELOPMENT TASK RECIPES
================================================================================

  --- ADD A NEW PAGE ---
  1. Create directory: app/your-page/
  2. Create file:     app/your-page/page.tsx
  3. If it needs client interactivity (store, state, effects):
       Add "use client" at top
       Only add `export const dynamic = "force-dynamic"` if the route truly
       depends on per-request behavior that ISR/static rendering cannot handle
  4. If it fetches data server-side:
       Do NOT add "use client"
       Export an async function that awaits data
       Prefer `revalidate = ...` for cacheable content pages
       Pass data to client components as props
  5. Import shared components from @/components/
  6. Add link to navigation in components/layout/header.tsx
     (NavLink for desktop, MobileNavLink for mobile)
  7. UPDATE THIS FILE: Add route to Section 5 table

  --- ADD A NEW API ROUTE ---
  1. Create directory: app/api/your-endpoint/
  2. Create file:     app/api/your-endpoint/route.ts
  3. Export named functions: GET, POST, PUT, PATCH, DELETE
  4. For dynamic params: app/api/your-endpoint/[param]/route.ts
  5. Access params via: const { params } = await request
     (params is a Promise in Next.js 16)
  6. Return: NextResponse.json({ data }) or NextResponse.json({ error }, { status })
  7. UPDATE THIS FILE: Add endpoint to Section 6 table

  --- ADD A NEW COMPONENT ---
  1. Determine domain: components/ui/, components/player/, etc.
  2. Create file: components/domain/your-component.tsx
  3. ALWAYS add "use client" at the top (all components are client)
  4. Import UI primitives from @/components/ui/
  5. Import store hooks: import { useStore } from "@/store"
  6. Import types: import type { Media } from "@/types/anilist"
  7. Style with Tailwind classes (use cn() from @/lib/utils for merging)
  8. UPDATE THIS FILE: Add component to Section 7 listing

  --- ADD A NEW LIB MODULE ---
  1. Create file: lib/your-module.ts
  2. If singleton: export class with private constructor + getInstance()
  3. If utility: export named functions
  4. Import types from @/types/
  5. Import constants from @/lib/constants
  6. Use logger from @/lib/logger (never raw console.log)
  7. UPDATE THIS FILE: Add module to Section 8 with description

  --- ADD A NEW STORE SLICE ---
  1. Open store/index.ts
  2. Add interface to StoreState
  3. Add initial values to the store creator
  4. Add actions (set functions) to the store creator
  5. Optionally add a selector hook at the bottom (like useFavorites)
  6. UPDATE THIS FILE: Update Section 9 state slices

  --- ADD A NEW TYPE DEFINITION ---
  1. If related to AniList: add to types/anilist.ts
  2. If related to analytics: add to types/analytics.ts
  3. If related to magnets/ratings: add to types/magnet-ratings.ts
  4. If related to P2P/seeding: add to types/seed-tracking.ts
  5. If entirely new domain: create types/your-domain.ts
  6. Always use "export interface" or "export type"
  7. UPDATE THIS FILE: Update Section 10 or add new type file

  --- ADD A NEW STREAMING SOURCE ---
  1. Add scraper in lib/torrent-finder.ts (new provider function)
  2. Add source resolution in lib/video-sources-robust.ts
  3. If HLS: enhanced-video-player.tsx handles it already
  4. If new protocol: create new player component + add to hybrid manager
  5. UPDATE THIS FILE: Update Sections 8, 18, 26

  --- ADD A NEW FEATURE BEHIND A FLAG ---
  1. Add flag definition in lib/feature-flags.ts (FEATURE_FLAGS object)
  2. Add admin toggle in app/api/admin/feature-flags/route.ts
  3. Use in components: import { useFeatureFlag } from "@/lib/use-feature-flag"
  4. UPDATE THIS FILE: Update Section 8 (feature-flags.ts description)


================================================================================
  28. KNOWN GOTCHAS & PITFALLS
================================================================================

  1. NO REAL DATABASE YET
     The app uses JSON files (data/magnets.json), in-memory stores, and
     localStorage. Some API routes have comments like "replace with database
     in production." The docker-compose.yml defines Postgres + Redis but
     the app code doesn't connect to them yet. If you add DB functionality,
     you'll need to integrate a real ORM or query layer.

  2. params IS A PROMISE IN NEXT.js 16
     Dynamic route params are async. You must:
       const { params } = await props; // or
       const { animeId } = await params;
     NOT: const { animeId } = params; // This will fail silently

  3. MIXED RENDERING MODES
     The app uses a mix of force-dynamic routes, client-heavy pages, and ISR.
     Prefer ISR/revalidation for cacheable content pages, and reserve
     `force-dynamic` for routes that truly require per-request behavior.

  4. WEBPACK, NOT TURBOPACK FOR PRODUCTION
     next.config.ts enables Turbopack for dev but the build uses webpack.
     The experimental settings disable webpackBuildWorker and workerThreads
     because of sandbox limitations. Do not remove these without testing.

  5. SERVICE WORKER IS DEVELOPMENT-AWARE
     public/sw.js skips caching for patterns like "_next", "turbopack",
     "hmr-client". It only caches in production. If you change dev build
     artifact patterns, update the SKIP_PATTERNS in sw.js.

  6. ALL COMPONENTS ARE CLIENT COMPONENTS
     Every file in components/ has "use client". The server/client boundary
     is at the page level, not the component level. Server pages fetch data,
     then pass it as props to client components.

  7. ZUSTAND STORE IS localStorage-ONLY
     No server-side state. The store persists only in the browser. If you
     need server-persisted state (e.g., cross-device sync), you must add
     API routes + database integration yourself.

  8. TORRENT STREAMING IS FEATURE-FLAGGED
     WebTorrent streaming is behind the WEBTORRENT_STREAMING feature flag
     (admin-only by default). To test torrent features, either change the
     flag in lib/feature-flags.ts or use the admin panel.

  9. CORS IS HANDLED VIA PROXY ROUTES
     External video/subtitle URLs are proxied through /api/proxy-hls and
     /api/proxy-subtitle to avoid CORS issues. Direct browser requests to
     third-party video URLs will fail.

  10. MAGNET DATA IS A JSON FILE
      data/magnets.json is the "database" for magnet links. Admin bulk import
      and validation operate on this file. For production, this needs to be
      replaced with a real database.

  11. CUSTOM DEV SERVER (server-custom.js)
      The app runs on a custom Node server (server-custom.js) that adds
      Socket.IO support for watch party. The standard `next start` doesn't
      include WebSocket support. Always use `node server-custom.js` for
      production or `npm run dev` for development.

  12. IMAGE DOMAINS ARE WHITELISTED
      next.config.ts defines allowed image domains (anilist.co, cloudinary,
      googleusercontent, googlevideo, localhost). If you add a new image
      source, you MUST add its hostname to the remotePatterns array.

  13. ELECTRON BUILD IS CONFIGURED BUT NOT TESTED
      Electron wrapper exists in electron/ but is likely not the primary
      deployment target. The main entry point is the web app.

  14. TYPESCRIPT ignoreBuildErrors IS NOW FALSE
      next.config.ts had `ignoreBuildErrors: true` but this was removed in the
      April 2026 audit. Now `tsc --noEmit` is used for type checking. Framework-
      level type errors in node_modules/next/ may appear but are not from app code.

  15. LOGGER MUST BE USED INSTEAD OF console.log
      Use lib/logger.ts (or createScopedLogger) for all logging. Raw
      console.log calls should not appear in production code. The logger
      respects NEXT_PUBLIC_ENABLE_LOGGING and NEXT_PUBLIC_LOG_LEVEL.

  16. PROXY ROUTES HAVE SSR PROTECTION
      /api/proxy-hls, /api/proxy-subtitle, /api/download-hls now block requests
      to private IPs, localhost, and cloud metadata endpoints (SSRF protection).
      If you need to proxy to a local service, add it to the allowlist in the
      isUrlAllowed() function in each route.

  17. ADMIN ROUTES REQUIRE isADMINRequest() AUTH
      All admin API routes now call isAdminRequest() which checks for a valid
      JWT token. Do not add new admin routes without this guard.

  18. STORE SELECTORS PATTERN
      The Zustand store uses selectors (useStore(s => s.field)) instead of bare
      useStore() calls to prevent unnecessary re-renders. Follow this pattern
      in any new components that use the store.


================================================================================
  29. CODING CONVENTIONS
================================================================================

  Follow these conventions to maintain consistency with the existing codebase.

  --- File Naming ---
    Pages:        page.tsx (always, in route directory)
    API routes:   route.ts (always, in api directory)
    Components:   kebab-case.tsx (e.g., anime-card.tsx, video-source-loader.tsx)
    Lib modules:  kebab-case.ts (e.g., torrent-finder.ts, hybrid-stream-manager.ts)
    Types:        kebab-case.ts (e.g., magnet-ratings.ts, seed-tracking.ts)
    Tests:        source-file.test.ts or source-file.spec.ts

  --- Exports ---
    Default exports:  Only for Next.js pages and layouts
    Named exports:    Everything else (components, lib functions, types)
    Component export: export function ComponentName() or export const ComponentName

  --- Imports Order (follow this order in every file) ---
    1. React/Next imports     (react, next/link, next/navigation)
    2. Third-party libraries  (hls.js, zustand, lucide-react, framer-motion)
    3. Internal lib modules   (@/lib/*)
    4. Store                  (@/store)
    5. Types                  (@/types/*)
    6. Components             (@/components/*)

  --- Component Pattern ---
    "use client";                              // Always first line
    // JSDoc comment describing the component
    import { ... } from "...";

    interface ComponentProps {                 // Props interface above component
      prop1: string;
      prop2?: number;
    }

    export function ComponentName({ prop1, prop2 }: ComponentProps) {
      // Hooks at top
      const store = useStore();
      const [state, setState] = useState();

      // Handlers
      function handleClick() { ... }

      // Render
      return (
        <div className="tailwind-classes">
          ...
        </div>
      );
    }

  --- Styling ---
    Use Tailwind CSS classes exclusively
    Use cn() from @/lib/utils for conditional/merged classes
    Use CSS custom properties from app/globals.css (--primary, --background, etc.)
    Glass cards: use <GlassCard> component, not manual glassmorphism
    Dark theme is default; light theme supported via ThemeProvider

  --- Design Tokens (from app/globals.css) ---
    Background:    var(--background)  → Deep dark blue-black (222 47% 4%)
    Text:          var(--foreground)  → Off-white (210 40% 98%)
    Primary:       var(--primary)     → Purple accent (263 70% 50%)
    Secondary:     var(--secondary)   → Cyan/blue accent (199 89% 48%)
    Muted:         var(--muted)       → Dark slate (217 33% 17%)
    Destructive:   var(--destructive) → Red (0 84% 60%)
    Success:       var(--success)     → Green (142 76% 36%)
    Warning:       var(--warning)     → Amber (38 92% 50%)
    Glass BG:      var(--glass-bg)    → rgba(15, 23, 42, 0.7)
    Glass Border:  var(--glass-border)→ rgba(139, 92, 246, 0.2)
    Radius:        var(--radius-lg)   → 0.75rem (standard), var(--radius-xl) for cards

  --- State Management ---
    Read state:   const favorites = useStore((s) => s.favorites);
    Or use hooks: const { favorites, toggleFavorite } = useFavorites();
    Never call:   useStore().favorites inside render without selector (perf)
    Mutate:       useStore().toggleFavorite(id);  // Call the action directly

  --- Error Handling ---
    API routes:   try/catch with NextResponse.json({ error }, { status: 500 })
    Components:   ErrorBoundary wrapper (components/error/error-boundary.tsx)
    Lib modules:  Return { data, error } pattern or throw with descriptive message
    Never:        Silent catches (catch {} without logging)

  --- Data Fetching ---
    Server pages:  async function + await anilist.method()
    Client comps:  useEffect + fetch() or receive data as props from server page
    API routes:    NextRequest → process → NextResponse.json()
    External APIs: Use lib/ clients (anilist.ts, jikan.ts, mal-api.ts)

  --- Comments ---
    Every file starts with a JSDoc block comment describing its purpose
    Section separators use: // ===================================
    Phase references: Many files reference "Phase X" from the original
    development plan. These are historical markers, not active constraints.

  --- Git Conventions ---
    No enforced commit convention, but the repo history uses descriptive messages
    Main branch: main (based on GitHub repo default)
    No CI/CD pipeline configured in the repo (no .github/workflows/)


================================================================================
  30. MANDATORY UPDATE PROTOCOL
================================================================================

================================================================================
  END OF tree_map.md
================================================================================
