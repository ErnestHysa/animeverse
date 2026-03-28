# AnimeVerse Stream - Setup Guide

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- (Optional) Docker for containerized development

### Installation Steps

1. **Clone and navigate to the project**:
```bash
cd anime-stream
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start the development server**:
```bash
npm run dev
```

4. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

## Video Sources

### Built-in Video Scraper

AnimeVerse Stream includes a built-in Playwright-based video scraper that automatically fetches video sources. No external video API is required!

The scraper:
- Attempts direct URL patterns for known anime streaming domains
- Falls back to page navigation and extraction
- Returns demo content if scraping fails

### How It Works

1. When you click play on an episode, the app calls `/api/video-sources/[animeId]/[episode]`
2. The server uses Playwright to scrape video URLs from supported sources
3. Video URLs are proxied through `/api/proxy-hls` to bypass CORS restrictions
4. The video player streams the content using hls.js

### Supported Video Types

- **HLS streams (.m3u8)**: Primary format, quality-adaptive
- **MP4 files**: Direct video playback
- **Demo fallback**: Sample video when sources unavailable

## Environment Configuration

### Optional Environment Variables

Create a `.env.local` file in the project root:

```env
# Application URL (for production deployments)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: External video API (built-in scraper used if not set)
# VIDEO_API_BASE_URL=http://localhost:3001

# Optional: AniList OAuth for user authentication
# NEXT_PUBLIC_ANILIST_CLIENT_ID=your-client-id
# ANILIST_CLIENT_SECRET=your-client-secret
```

### Default Behavior

Without any configuration:
- Discovery features work fully (trending, search, anime details)
- Video playback uses built-in scraper
- User data stored locally (favorites, watchlist, history)

## Development Scripts

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run smoke tests
npm run test:smoke

# Run end-to-end tests
npm run test:e2e

# Run tests in UI mode
npm run test:e2e:ui
```

## Project Structure Overview

```
anime-stream/
├── app/                    # Next.js App Router pages
│   ├── api/               # API endpoints
│   ├── anime/[id]/        # Anime detail pages
│   ├── watch/             # Video player pages
│   └── ...
├── components/            # React components
├── lib/                   # Utilities and API clients
├── store/                 # Zustand state management
├── types/                 # TypeScript definitions
└── public/                # Static assets
```

## Troubleshooting

### Port Already in Use

If port 3000 is occupied:
```bash
# Windows (Command Prompt)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

### Build Errors

If you encounter build errors:
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### Video Playback Issues

If videos won't play:
1. Check browser console for errors
2. Verify HLS is supported (modern browsers)
3. Try a different anime/episode
4. Check server logs for scraper errors

### Playwright Issues

If E2E tests fail:
```bash
# Install Playwright browsers
npx playwright install

# Run tests in headed mode for debugging
npx playwright test --headed
```

## Production Deployment

### Build the Application

```bash
npm run build
```

### Start the Production Server

```bash
npm start
```

The app will be available at port 3000 (or configured `PORT`).

### Environment Variables for Production

Set these before building:
- `NEXT_PUBLIC_APP_URL`: Your production URL
- Any other required configuration

## Available Features

Once running, you have access to:

- **Discovery**: Trending, popular, seasonal anime
- **Search**: Full-text search with filters
- **Playback**: HLS video streaming with proxy
- **Tracking**: Watch history, favorites, watchlist
- **Stats**: Viewing statistics and achievements
- **Custom Lists**: Create personalized collections
- **Keyboard Shortcuts**: Full player control
- **Responsive Design**: Works on all devices

## Data Sources

- **AniList API**: Primary metadata source
- **Jikan API**: MyAnimeList fallback
- **Built-in Scraper**: Video source fetching

## Need Help?

Check the main [README.md](./README.md) for more detailed documentation.
