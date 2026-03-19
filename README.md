# Anime Stream

A modern anime streaming application built with Next.js 16, featuring AniList integration for anime metadata and video playback.

## Quick Start

The project includes a local Consumet API setup for video playback. Simply run:

```bash
npm run dev
```

This will start:
1. **Consumet API** on `http://localhost:3001` - Provides video sources
2. **Next.js App** on `http://localhost:3000` - Main application

Your browser will automatically open when both servers are ready.

## What's Included

- ✅ **Local Consumet API** - Pre-configured and starts automatically
- ✅ **AnimeKai Provider** - Working video source provider
- ✅ **AniList Integration** - Anime metadata, search, trending
- ✅ **Unified Dev Script** - One command to start everything
- ✅ **Auto Browser Open** - Opens when servers are ready

## Project Structure

```
~/DEVPROJECTS/
├── anime-stream/          # Main Next.js application
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── scripts/dev.js    # Unified dev server script
│   └── .env.local        # Config (points to localhost:3001)
└── consumet/             # Local Consumet API
    ├── src/              # API source code
    └── .env              # API config (runs on port 3001)
```

## Development

### Start Both Servers
```bash
npm run dev
```

### Start Only Next.js (if API is already running)
```bash
npm run dev:next
```

### Build for Production
```bash
npm run build
```

## Configuration

The `.env.local` file is already configured to use the local API:

```env
VIDEO_API_BASE_URL=http://localhost:3001
```

### Using a Different API

If you want to use a different Consumet deployment:

1. Update `.env.local`:
   ```env
   VIDEO_API_BASE_URL=https://your-api-url.com
   ```

2. Restart the dev server

## Troubleshooting

**Videos not playing?**
- Make sure both servers are running (check for API and NEXT logs)
- Verify `http://localhost:3001` returns "Welcome to consumet api!"
- Check the browser console for errors

**Port already in use?**
- The Consumet API uses port 3001
- Next.js uses port 3000
- Kill existing processes: `pkill -f "next dev"` and `pkill -f "nodemon"`

## Getting Started (Original)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
