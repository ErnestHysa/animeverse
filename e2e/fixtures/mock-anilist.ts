/**
 * Mock AniList API responses for E2E testing
 * These replace real API calls so tests work without network access
 */

export const mockMedia = {
  id: 21459,
  idMal: 31964,
  title: {
    romaji: "One Punch Man",
    english: "One Punch Man",
    native: "ワンパンマン",
    userPreferred: "One Punch Man",
  },
  description: "The story of Saitama, a hero who has trained so hard that his hair has fallen out and can defeat any enemy with a single punch.",
  coverImage: {
    extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21459-f6FltM9omHMD.jpg",
    large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21459-f6FltM9omHMD.jpg",
    medium: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx21459-f6FltM9omHMD.jpg",
    color: "#f1a150",
  },
  bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21459-wB5QpMQhfbwH.jpg",
  format: "TV",
  status: "FINISHED",
  episodes: 12,
  duration: 24,
  genres: ["Action", "Comedy", "Sci-Fi", "Superhero"],
  averageScore: 87,
  seasonYear: 2015,
  season: "FALL",
  popularity: 400000,
  recommendations: {
    nodes: [],
  },
};

export const mockMediaList = Array.from({ length: 24 }, (_, i) => ({
  ...JSON.parse(JSON.stringify(mockMedia)), // deep clone to avoid shared references
  id: 21459 + i,
  idMal: 31964 + i,
  title: {
    romaji: `Anime ${i + 1}`,
    english: `Anime ${i + 1}`,
    native: `アニメ${i + 1}`,
    userPreferred: `Anime ${i + 1}`,
  },
  popularity: 400000 - i * 1000,
}));

export const mockPageResponse = {
  data: {
    Page: {
      pageInfo: {
        total: 24,
        currentPage: 1,
        lastPage: 1,
        hasNextPage: false,
        perPage: 24,
      },
      media: mockMediaList,
    },
  },
};

export const mockMediaResponse = {
  data: {
    Media: mockMedia,
  },
};

export const mockAiringResponse = {
  data: {
    Page: {
      pageInfo: { total: 12, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 12 },
      airingSchedules: Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        episode: i + 1,
        timeUntilAiring: 3600 * (i + 1),
        media: mockMediaList[i],
      })),
    },
  },
};

/**
 * Setup AniList API mocking for a Playwright page
 */
export async function mockAniListAPI(page: import('@playwright/test').Page) {
  await page.route("https://graphql.anilist.co", async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();
    const query = postData?.query || "";

    // Single media query (by ID)
    if (query.includes("media(id:") || query.includes("Media(id:") ||
        (query.includes("Media") && query.includes("id") && !query.includes("Page"))) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockMediaResponse),
      });
      return;
    }

    // Airing schedules query
    if (query.includes("airingSchedules") || query.includes("AiringSchedule")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAiringResponse),
      });
      return;
    }

    // Default: page list query
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockPageResponse),
    });
  });
}
