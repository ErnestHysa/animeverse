/**
 * MyAnimeList (MAL) API v2 Client
 * Handles OAuth PKCE flow + bidirectional anime list sync.
 *
 * MAL uses PKCE (Proof Key for Code Exchange):
 *  - No client_secret needed for public clients
 *  - code_verifier stored in httpOnly cookie before OAuth redirect
 *  - Token exchange done server-side in /auth/mal/callback route
 */

export const MAL_API_BASE = "https://api.myanimelist.net/v2";
export const MAL_AUTH_URL = "https://myanimelist.net/v1/oauth2/authorize";
export const MAL_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";

export type MALStatus =
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch";

export interface MALListEntry {
  node: {
    id: number;
    title: string;
    main_picture?: { medium: string; large: string };
    num_episodes?: number;
  };
  list_status: {
    status: MALStatus;
    score: number;
    num_episodes_watched: number;
    is_rewatching: boolean;
    updated_at: string;
  };
}

export interface MALUser {
  id: number;
  name: string;
  picture: string;
  joined_at: string;
}

// ===================================
// PKCE Helpers (used by initiate route)
// ===================================

/** Generates a cryptographically random code_verifier (43-128 chars) */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Builds code_challenge = BASE64URL(SHA-256(verifier)) */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ===================================
// API Calls
// ===================================

/**
 * Fetch the authenticated user's full anime list.
 * Handles pagination to get all entries.
 */
export async function getMALAnimeList(token: string): Promise<MALListEntry[]> {
  const entries: MALListEntry[] = [];
  let nextUrl: string | null =
    `${MAL_API_BASE}/users/@me/animelist?fields=list_status,num_episodes&limit=500&nsfw=true`;

  const MAX_PAGES = 50;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      console.warn(`[MAL] Reached max pages (${MAX_PAGES}), stopping pagination`);
      break;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!resp.ok) {
        if (resp.status === 401) throw new Error("MAL token expired");
        throw new Error(`MAL API error: ${resp.status}`);
      }

      const pageData: { data: MALListEntry[]; paging?: { next?: string } } = await resp.json();
      entries.push(...(pageData.data ?? []));
      nextUrl = pageData.paging?.next ?? null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return entries;
}

/**
 * Update an anime entry on the user's MAL list.
 * Creates the entry if it doesn't exist yet.
 */
export async function updateMALEntry(
  token: string,
  malId: number,
  status: MALStatus,
  numEpisodesWatched: number,
  score?: number
): Promise<void> {
  const body = new URLSearchParams({
    status,
    num_watched_episodes: String(numEpisodesWatched),
  });
  if (score !== undefined && score > 0) {
    body.set("score", String(score));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${MAL_API_BASE}/anime/${malId}/my_list_status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: controller.signal,
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`MAL update failed: ${response.status}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch the currently authenticated MAL user's profile.
 */
export async function getMALUser(token: string): Promise<MALUser> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${MAL_API_BASE}/users/@me?fields=id,name,picture,joined_at`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );

    if (!response.ok) throw new Error(`MAL user fetch failed: ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Map AniList status to MAL status string.
 */
export function anilistStatusToMAL(anilistStatus: string): MALStatus {
  switch (anilistStatus) {
    case "CURRENT":
      return "watching";
    case "COMPLETED":
      return "completed";
    case "PAUSED":
      return "on_hold";
    case "DROPPED":
      return "dropped";
    case "PLANNING":
      return "plan_to_watch";
    default:
      return "watching";
  }
}

/**
 * Map MAL status to AniList status string.
 */
export function malStatusToAniList(malStatus: MALStatus): string {
  switch (malStatus) {
    case "watching":
      return "CURRENT";
    case "completed":
      return "COMPLETED";
    case "on_hold":
      return "PAUSED";
    case "dropped":
      return "DROPPED";
    case "plan_to_watch":
      return "PLANNING";
    default:
      return "CURRENT";
  }
}
