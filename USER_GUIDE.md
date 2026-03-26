# AnimeVerse User Guide

## Start the App

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Development mode gives you:

- hot reload
- detailed error output
- source maps
- graceful fallback behavior if `VIDEO_API_BASE_URL` is unavailable

## Main Areas

- Home: featured anime, trending, popular, continue watching, AI recommendations
- Anime detail: synopsis, metadata, episodes, related recommendations
- Watch page: playback, episode navigation, downloads, comments, share/report actions
- Library pages: trending, popular, seasonal, genres, studios, schedule, coming soon
- Personal pages: favorites, watchlist, custom lists, history, stats, achievements

## Watching Anime

From any anime detail page, open an episode from the episode list or use `Watch Now`.

The watch page includes:

- play/pause and seeking controls
- next/previous episode navigation
- subtitle and language controls when available
- download support for compatible sources
- keyboard shortcuts

Common shortcuts:

- `Space`: play/pause
- `Left` / `Right`: seek
- `Up` / `Down`: volume
- `M`: mute
- `F`: fullscreen
- `N`: next episode

## Downloads

To download:

1. Open a watch page.
2. Click the download button in the player controls.
3. Wait for packaging to complete.

Notes:

- download availability depends on the current provider/source
- some streams are view-only and will not offer download packaging

## AniList Sync

AnimeVerse does not require its own account system.

If you connect AniList, you can use:

- AniList-backed authentication
- synced anime data
- richer profile and stats workflows

Without AniList, your favorites, watchlist, history, and preferences remain local to your device.

## Troubleshooting

If the app starts but playback is unavailable:

- confirm `VIDEO_API_BASE_URL` points to a working source API
- try another episode or server
- run `npm run test:smoke` to verify core routing and fallback behavior

If production validation is needed:

```bash
npm run lint
npm run build
npm run test:smoke
npx playwright test e2e/home-page.spec.ts --project=chromium
npx playwright test e2e/video-player.spec.ts --project=chromium
npx playwright test e2e/real-user-flow.spec.ts --project=chromium
```
