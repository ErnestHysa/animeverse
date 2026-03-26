# AnimeVerse Stream

AnimeVerse Stream is a Next.js 16 / React 19 anime web app focused on discovery, tracking, and resilient playback. It uses AniList for metadata and search, then layers on watch history, favorites, watchlists, schedule views, AI recommendations, downloads, comments, achievements, AniList sync, and a feature-rich watch page.

## Current App State

- Discovery: home hero, trending, popular, seasonal, studios, genres, schedule, coming soon, random
- Playback: watch page, server/language switching, HLS proxying, subtitle proxying, download packaging, keyboard shortcuts
- User tools: continue watching, favorites, watchlist, custom lists, batch actions, history, stats, achievements
- Connected features: AniList OAuth callback and AniList-backed metadata/search
- UX extras: PWA support, installable manifest, responsive layouts, AI recommendation surface, comments

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand for local state
- Playwright for end-to-end coverage

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file if needed:

```bash
copy .env.local.example .env.local
```

3. Start the app:

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Environment Notes

`npm run dev` starts the Next.js app only. It does not boot a separate video API for you.

`VIDEO_API_BASE_URL` should point at your own provider or deployment if you want live source fetching. When that API is unavailable, the app keeps the discovery surface working and falls back gracefully for local verification instead of crashing.

Important env vars:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
VIDEO_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_ANILIST_CLIENT_ID=your-client-id
ANILIST_CLIENT_SECRET=your-client-secret
```

## Quality Checks

Run the same checks used during this production-readiness pass:

```bash
npm run lint
npm run build
npm run test:smoke
```

Representative Playwright slices:

```bash
npx playwright test e2e/home-page.spec.ts --project=chromium
npx playwright test e2e/video-player.spec.ts --project=chromium
npx playwright test e2e/real-user-flow.spec.ts --project=chromium
```

## Production Commands

```bash
npm run build
npm start
```

## Notable Routes

- `/` home, trending, continue watching, AI recommendations
- `/anime/[id]` anime detail, episodes, related recommendations
- `/watch/[animeId]/[episode]` playback, downloads, navigation, comments, watch utilities
- `/search`, `/trending`, `/popular`, `/seasonal`, `/schedule`, `/genres`, `/studios`
- `/favorites`, `/watchlist`, `/lists`, `/history`, `/stats`, `/achievements`
- `/about`, `/faq`, `/privacy`, `/terms`, `/dmca`

## API Surface

- `/api/health`
- `/api/search-suggestions`
- `/api/video-sources/[animeId]/[episode]`
- `/api/proxy-hls`
- `/api/proxy-subtitle`
- `/api/download-hls`
- `/api/filler/[malId]`
- `/api/aniskip/[malId]/[episode]`
- `/api/scrape`

## Troubleshooting

If playback is unavailable locally:

- verify `VIDEO_API_BASE_URL` points to a reachable service
- use `/api/health` to confirm the app itself is up
- run `npm run test:smoke` to check discovery, search, watch routes, and source fallback wiring

If Playwright behaves inconsistently:

- stop any manually running dev servers on ports `3000` or `4000`
- rerun the targeted spec instead of the full browser matrix first

## References

- [Next.js docs](https://nextjs.org/docs)
- [AniList API docs](https://docs.anilist.co)
- [Playwright docs](https://playwright.dev/docs/intro)
