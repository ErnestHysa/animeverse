import http from "node:http";
import next from "next";

const POSTER_PLACEHOLDER = "http://127.0.0.1:3000/images/anime-placeholder.svg";
const BANNER_PLACEHOLDER = "http://127.0.0.1:3000/images/anime-banner-placeholder.svg";

function createMockMedia(id = 21459, title = "One Punch Man") {
  return {
    id,
    idMal: id + 1000,
    title: {
      romaji: title,
      english: title,
      native: "Wanpanman",
      userPreferred: title,
    },
    description:
      "The story of Saitama, a hero who can defeat any enemy with a single punch after training so hard his hair fell out.",
    coverImage: {
      extraLarge: POSTER_PLACEHOLDER,
      large: POSTER_PLACEHOLDER,
      medium: POSTER_PLACEHOLDER,
      color: "#f1a150",
    },
    bannerImage: BANNER_PLACEHOLDER,
    format: "TV",
    type: "ANIME",
    status: "FINISHED",
    episodes: 12,
    duration: 24,
    genres: ["Action", "Comedy", "Sci-Fi"],
    tags: [],
    studios: { nodes: [{ id: 1, name: "Madhouse", isAnimationStudio: true }] },
    averageScore: 87,
    meanScore: 87,
    popularity: 400000,
    favourites: 150000,
    trending: 5000,
    seasonYear: 2015,
    season: "FALL",
    seasonInt: 20154,
    startDate: { year: 2015, month: 10, day: 5 },
    endDate: { year: 2015, month: 12, day: 21 },
    source: "MANGA",
    countryOfOrigin: "JP",
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
      nodes: Array.from({ length: 5 }, (_, index) => ({
        mediaRecommendation: {
          id: 100 + index,
          idMal: 200 + index,
          title: {
            romaji: `Recommendation ${index + 1}`,
            english: `Recommendation ${index + 1}`,
            native: null,
            userPreferred: `Recommendation ${index + 1}`,
          },
          coverImage: { extraLarge: "", large: "", medium: "", color: null },
          format: "TV",
          status: "FINISHED",
          episodes: 12,
          averageScore: 80 + index,
          genres: ["Action"],
          seasonYear: 2020 + index,
        },
      })),
    },
  };
}

const mediaList = Array.from({ length: 48 }, (_, index) =>
  createMockMedia(
    21459 + index,
    index === 0 ? "One Punch Man" : `Anime Title ${index + 1}`
  )
);

const pageInfo = {
  total: 48,
  currentPage: 1,
  lastPage: 1,
  hasNextPage: false,
  perPage: 48,
};

function buildMockResponse(query = "") {
  if (
    query.includes("Media(id:") ||
    (query.includes("Media") && query.includes("$id") && !query.includes("Page("))
  ) {
    return { data: { Media: createMockMedia() } };
  }

  if (query.includes("recommendations")) {
    return { data: { Media: createMockMedia() } };
  }

  if (query.includes("airingSchedules")) {
    return {
      data: {
        Page: {
          pageInfo: { ...pageInfo, total: 12, perPage: 12 },
          airingSchedules: Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            airingAt: Math.floor(Date.now() / 1000) + 3600 * (index + 1),
            timeUntilAiring: 3600 * (index + 1),
            episode: index + 1,
            media: mediaList[index],
          })),
        },
      },
    };
  }

  if (query.includes("studios(")) {
    return {
      data: {
        Page: {
          studios: {
            nodes: Array.from({ length: 10 }, (_, index) => ({
              id: index + 1,
              name: `Studio ${index + 1}`,
              isAnimationStudio: true,
              media: {
                nodes: mediaList.slice(index * 4, (index + 1) * 4).map((media) => ({
                  id: media.id,
                  title: media.title,
                  coverImage: media.coverImage,
                  averageScore: media.averageScore,
                  format: media.format,
                })),
              },
            })),
          },
        },
      },
    };
  }

  return {
    data: {
      Page: {
        pageInfo,
        media: mediaList.slice(0, 24),
      },
    },
  };
}

async function startMockServer(port) {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const response = buildMockResponse(parsed.query || "");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ errors: [{ message: "Invalid request" }] }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return server;
}

async function startNextServer(port) {
  process.env.ANILIST_GRAPHQL_URL = "http://127.0.0.1:4000";

  const app = next({
    dev: true,
    dir: process.cwd(),
    hostname: "127.0.0.1",
    port,
    webpack: true,
  });

  await app.prepare();
  const handle = app.getRequestHandler();
  const server = http.createServer((req, res) => handle(req, res));
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return server;
}

async function assertRoute(baseUrl, path, expectedText) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  if (expectedText && !body.includes(expectedText)) {
    throw new Error(`${path} did not include expected text: ${expectedText}`);
  }

  console.log(`OK ${path}`);
}

async function assertSearchSuggestions(baseUrl) {
  const response = await fetch(`${baseUrl}/api/search-suggestions?q=one`);
  const data = await response.json();

  if (!response.ok || !Array.isArray(data.suggestions) || data.suggestions.length === 0) {
    throw new Error("search suggestions API returned no results");
  }

  console.log("OK /api/search-suggestions");
}

async function assertVideoSources(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      `${baseUrl}/api/video-sources/21459/1?title=One%20Punch%20Man&malId=22459&language=sub`,
      { signal: controller.signal }
    );
    const data = await response.json();

    if (!response.ok || !Array.isArray(data.sources) || data.sources.length === 0) {
      throw new Error("video sources API returned no playable sources");
    }

    console.log("OK /api/video-sources");
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const mockServer = await startMockServer(4000);
  const nextServer = await startNextServer(3000);
  const baseUrl = "http://127.0.0.1:3000";

  try {
    await assertRoute(baseUrl, "/", "Trending Now");
    await assertRoute(baseUrl, "/anime/21459", "One Punch Man");
    await assertRoute(baseUrl, "/watch/21459/1", "One Punch Man");
    await assertRoute(baseUrl, "/search?q=one", "Search");
    await assertRoute(baseUrl, "/about", "About");
    await assertRoute(baseUrl, "/history", "Watch History");
    await assertRoute(baseUrl, "/stats", "Viewing Statistics");
    await assertSearchSuggestions(baseUrl);
    await assertVideoSources(baseUrl);
    console.log("SMOKE_TEST_OK");
  } finally {
    await new Promise((resolve) => nextServer.close(resolve));
    await new Promise((resolve) => mockServer.close(resolve));
    process.exit(0);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
