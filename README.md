# AnimeVerse Stream

AnimeVerse Stream is a modern Next.js 16 / React 19 anime streaming application focused on discovery, tracking, and resilient playback. It features direct video streaming with HLS proxy support, comprehensive anime metadata from multiple sources, and a rich user experience with watch history, favorites, achievements, and more.

## Features

### Discovery & Browsing
- **Home Page**: Featured hero section, trending anime, popular titles, seasonal picks, latest episodes
- **Search**: Full-text search with suggestions and filters
- **Library Views**: Trending, popular, seasonal, genres, studios, airing schedule
- **AI Recommendations**: Personalized anime suggestions based on viewing history

### Playback & Watching
- **Direct Streaming**: HLS video playback with hls.js integration
- **HLS Proxy**: Server-side proxy to bypass CORS and hotlink protection
- **Video Quality**: Automatic quality selection with manual override options
- **Keyboard Shortcuts**: Full keyboard control (play/pause, seek, volume, fullscreen, next episode)
- **Episode Navigation**: Easy access to next/previous episodes
- **Continue Watching**: Resume from where you left off

### User Tools
- **Watch History**: Track all watched episodes with progress
- **Favorites**: Save your favorite anime
- **Watchlist**: Plan what to watch next
- **Custom Lists**: Create personalized anime collections
- **Stats & Achievements**: Track your viewing habits and unlock achievements
- **Batch Operations**: Manage multiple anime at once

### Data Sources
- **AniList API**: Primary source for anime metadata, search, and recommendations
- **Jikan API**: MyAnimeList API fallback for additional metadata
- **Video Scraper**: Built-in Playwright-based scraper for video sources

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4 with custom design tokens
- **State**: Zustand with localStorage persistence
- **Video**: hls.js for streaming, Playwright for scraping
- **Testing**: Playwright for end-to-end coverage
- **Build**: Webpack bundler with custom configuration

## Project Structure

```
anime-stream/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── video-sources/    # Video source fetching
│   │   ├── proxy-hls/        # HLS proxy for CORS bypass
│   │   ├── health/           # Health check
│   │   └── ...
│   ├── anime/[id]/           # Anime detail page
│   ├── watch/[animeId]/[episode]/  # Watch page
│   ├── search/               # Search page
│   ├── trending/             # Trending page
│   └── ...
├── components/               # React components
│   ├── anime/                # Anime-related components
│   ├── player/               # Video player components
│   ├── layout/               # Layout components
│   └── ui/                   # UI components
├── lib/                      # Utility libraries
│   ├── anilist.ts            # AniList API client
│   ├── jikan.ts              # Jikan API client
│   ├── video-sources-fast.ts # Video scraper
│   └── ...
├── store/                    # Zustand state management
├── types/                    # TypeScript type definitions
└── public/                   # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd anime-stream
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.local.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Video API (optional - built-in scraper used if not set)
VIDEO_API_BASE_URL=http://localhost:3001

# AniList OAuth (optional - for user authentication)
NEXT_PUBLIC_ANILIST_CLIENT_ID=your-client-id
ANILIST_CLIENT_SECRET=your-client-secret
```

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test:smoke   # Run smoke tests
npm run test:e2e     # Run Playwright tests
```

### Video Source Architecture

The app uses a built-in Playwright-based scraper to fetch video sources:

1. **Fast Scraper**: Attempts direct URL patterns for known domains
2. **Fallback Scraper**: Navigates pages and extracts video URLs
3. **Demo Fallback**: Returns sample video if scraping fails

The HLS proxy (`/api/proxy-hls`) handles:
- CORS bypass for external video sources
- URL rewriting for manifest files
- DRM key file proxying
- Range request support for seeking

## API Routes

| Route | Description |
|-------|-------------|
| `/api/health` | Health check endpoint |
| `/api/search-suggestions` | Search autocomplete |
| `/api/video-sources/[animeId]/[episode]` | Fetch video sources |
| `/api/proxy-hls` | HLS proxy for streaming |
| `/api/proxy-subtitle` | Subtitle proxy |
| `/api/download-hls` | Download packaging |
| `/api/filler/[malId]` | Filler episode detection |
| `/api/aniskip/[malId]/[episode]` | Skip timestamps |

## Pages & Routes

### Main Pages
- `/` - Home with featured anime and recommendations
- `/search` - Search anime with filters
- `/trending` - Trending anime
- `/popular` - All-time popular
- `/seasonal` - Current season anime
- `/schedule` - Airing schedule
- `/genres` - Browse by genre
- `/studios` - Browse by studio

### Anime Pages
- `/anime/[id]` - Anime details with episodes
- `/watch/[animeId]/[episode]` - Video player

### User Pages
- `/favorites` - Favorited anime
- `/watchlist` - Plan to watch
- `/lists` - Custom lists
- `/history` - Watch history
- `/stats` - Viewing statistics
- `/achievements` - Unlocked achievements
- `/settings` - User preferences

### Info Pages
- `/about` - About the app
- `/faq` - Frequently asked questions
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/dmca` - DMCA information

## Troubleshooting

### Video Playback Issues

If videos don't play:

1. Check the browser console for errors
2. Verify the scraper is working (check server logs)
3. Try a different anime/episode
4. Check if HLS is supported in your browser

### Build Issues

If the build fails:

1. Clear the Next.js cache: `rm -rf .next`
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check TypeScript errors: `npx tsc --noEmit`

### Playwright Test Failures

If tests fail:

1. Ensure no other processes are using port 3000
2. Update Playwright browsers: `npx playwright install`
3. Run tests in headed mode to debug: `npx playwright test --headed`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is for educational purposes only. Please respect the copyright of anime content and use legally available sources.

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [AniList API](https://docs.anilist.co)
- [Jikan API](https://docs.api.jikan.moe)
- [hls.js Documentation](https://github.com/video-dev/hls.js)
- [Playwright Documentation](https://playwright.dev/docs/intro)
