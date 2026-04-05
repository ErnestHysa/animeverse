# Anime Stream Services

This directory contains background services for the anime streaming application.

## Services

### 1. Seed Server (`seed-server.js`)
WebTorrent seed server that provides seeding capacity for popular content.

**Features:**
- Seeds popular anime torrents
- HTTP status endpoint for monitoring
- PM2 process management support

**Usage:**
```bash
# Start directly
npm run start

# Start with PM2
npm run pm2:start

# View logs
npm run pm2:logs

# Check status
npm run pm2:status
```

### 2. Anime Scraper (`anime-scraper.js`)
Automated daily scraper for new anime releases from Nyaa.si.

**Features:**
- Fetches currently airing anime from AniList
- Scrapes Nyaa.si for new episodes
- Stores magnet links in database
- Runs daily via cron

**Usage:**
```bash
# Run scraper manually
npm run scrape

# Start with PM2 (runs daily at 2 AM)
npm run pm2:start-scraper

# View logs
npm run pm2:scraper-logs
```

**Configuration:**
Edit `anime-scraper.js` to customize:
- `daysToLookBack`: Number of days to look back for new episodes
- `maxEpisodesPerAnime`: Maximum episodes to scrape per anime
- `delayBetweenRequests`: Delay between HTTP requests

## Data Storage

Services store data in the `../data` directory:

- `magnets.json`: Magnet links database
- `scrape-log.json`: Scraper execution logs
- `torrent-cache.json`: Torrent search cache

## PM2 Process Management

### Start all services:
```bash
npm run pm2:start          # Start seed server
npm run pm2:start-scraper  # Start scraper
```

### Stop all services:
```bash
npm run pm2:stop           # Stop seed server
npm run pm2:stop-scraper   # Stop scraper
```

### Monitor services:
```bash
pm2 status                 # Show all services
pm2 logs                   # Show all logs
pm2 monit                  # Real-time monitoring
```

## Environment Variables

No environment variables required. All services use local file storage.

## Troubleshooting

### Seed server not seeding:
1. Check if torrent files have seeders
2. Verify network connectivity
3. Check PM2 logs: `npm run pm2:logs`

### Scraper not finding torrents:
1. Verify AniList API is accessible
2. Check Nyaa.si is accessible
3. Review scraper logs: `npm run pm2:scraper-logs`
4. Try running manually: `npm run scrape`

### Database locked:
```bash
# Remove lock files
rm -f ../data/.lock ../data/.scraping
```

## Development

To run services in development mode with auto-reload:

```bash
npm install -g nodemon
npm run dev
```

## Production Deployment

For production, use PM2 with the ecosystem file:

```bash
pm2 start ecosystem.config.js
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'anime-seed-server',
      script: './seed-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'anime-scraper',
      script: './anime-scraper.js',
      cron_restart: '0 2 * * *', // Daily at 2 AM
      autorestart: false,
    }
  ]
};
```
