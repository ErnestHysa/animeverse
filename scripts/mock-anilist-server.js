#!/usr/bin/env node
/**
 * Mock AniList GraphQL Server for E2E Testing
 * Runs on port 4000 and returns realistic mock data
 */

const http = require('http');
const POSTER_PLACEHOLDER = 'http://localhost:3000/images/anime-placeholder.svg';
const BANNER_PLACEHOLDER = 'http://localhost:3000/images/anime-banner-placeholder.svg';

const mockMedia = (id = 21459, title = 'One Punch Man') => ({
  id,
  idMal: id + 1000,
  title: {
    romaji: title,
    english: title,
    native: 'ワンパンマン',
    userPreferred: title,
  },
  description: 'The story of Saitama, a hero who can defeat any enemy with a single punch after training so hard his hair fell out.',
  coverImage: {
    extraLarge: POSTER_PLACEHOLDER,
    large: POSTER_PLACEHOLDER,
    medium: POSTER_PLACEHOLDER,
    color: '#f1a150',
  },
  bannerImage: BANNER_PLACEHOLDER,
  format: 'TV',
  type: 'ANIME',
  status: 'FINISHED',
  episodes: 12,
  duration: 24,
  genres: ['Action', 'Comedy', 'Sci-Fi'],
  tags: [],
  studios: { nodes: [{ id: 1, name: 'Madhouse', isAnimationStudio: true }] },
  averageScore: 87,
  meanScore: 87,
  popularity: 400000,
  favourites: 150000,
  trending: 5000,
  seasonYear: 2015,
  season: 'FALL',
  seasonInt: 20154,
  startDate: { year: 2015, month: 10, day: 5 },
  endDate: { year: 2015, month: 12, day: 21 },
  source: 'MANGA',
  countryOfOrigin: 'JP',
  isAdult: false,
  isLicensed: true,
  synonyms: [],
  relations: { edges: [] },
  characters: { edges: [] },
  externalLinks: [],
  nextAiringEpisode: null,
  streamingEpisodes: [],
  trailer: null,
  recommendations: {
    nodes: Array.from({ length: 5 }, (_, i) => ({
      mediaRecommendation: {
        id: 100 + i,
        idMal: 200 + i,
        title: { romaji: `Recommendation ${i + 1}`, english: `Recommendation ${i + 1}`, native: null, userPreferred: `Recommendation ${i + 1}` },
        coverImage: { extraLarge: '', large: '', medium: '', color: null },
        format: 'TV',
        status: 'FINISHED',
        episodes: 12,
        averageScore: 80 + i,
        genres: ['Action'],
        seasonYear: 2020 + i,
      }
    }))
  }
});

const mediaList = Array.from({ length: 48 }, (_, i) =>
  mockMedia(21459 + i, i === 0 ? 'One Punch Man' : `Anime Title ${i + 1}`)
);

const pageInfo = {
  total: 48,
  currentPage: 1,
  lastPage: 1,
  hasNextPage: false,
  perPage: 48,
};

function buildResponse(query = '') {
  // Single media by ID
  if (query.includes('Media(id:') || (query.includes('Media') && query.includes('$id') && !query.includes('Page('))) {
    return { data: { Media: mockMedia() } };
  }

  // Recommendations
  if (query.includes('recommendations')) {
    return { data: { Media: mockMedia() } };
  }

  // Airing schedules
  if (query.includes('airingSchedules')) {
    return {
      data: {
        Page: {
          pageInfo: { ...pageInfo, total: 12, perPage: 12 },
          airingSchedules: Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            airingAt: Math.floor(Date.now() / 1000) + 3600 * (i + 1),
            timeUntilAiring: 3600 * (i + 1),
            episode: i + 1,
            media: mediaList[i],
          })),
        }
      }
    };
  }

  // Studios query
  if (query.includes('studios(')) {
    return {
      data: {
        Page: {
          studios: {
            nodes: Array.from({ length: 10 }, (_, i) => ({
              id: i + 1,
              name: `Studio ${i + 1}`,
              isAnimationStudio: true,
              media: {
                nodes: mediaList.slice(i * 4, (i + 1) * 4).map(m => ({
                  id: m.id,
                  title: m.title,
                  coverImage: m.coverImage,
                  averageScore: m.averageScore,
                  format: m.format,
                }))
              }
            }))
          }
        }
      }
    };
  }

  // Default: media page list
  return {
    data: {
      Page: {
        pageInfo,
        media: mediaList.slice(0, 24),
      }
    }
  };
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const query = parsed.query || '';
        const response = buildResponse(query);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: 'Invalid request' }] }));
      }
    });
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.MOCK_PORT || 4000;
server.listen(PORT, () => {
  console.log(`Mock AniList server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
