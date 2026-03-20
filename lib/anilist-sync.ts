/**
 * AniList OAuth & Synchronization
 * Allows users to sync their watch list and progress with AniList
 */

const ANILIST_API_URL = "https://graphql.anilist.co";
const ANILIST_OAUTH_URL = "https://anilist.co/api/v2/oauth/authorize";
const ANILIST_TOKEN_URL = "https://anilist.co/api/v2/oauth/token";

// OAuth Configuration - for a production app, these should be in environment variables
// For client ID, register at: https://anilist.co/api/v2/oauth/authorize
const OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID || "16500", // Demo client ID
  redirectUri: typeof window !== "undefined"
    ? `${window.location.origin}/auth/anilist/callback`
    : "http://localhost:3000/auth/anilist/callback",
};

// ===================================
// Types
// ===================================

export interface AnilistUser {
  id: number;
  name: string;
  avatar: { large: string; medium: string };
  options: { displayAdultContent: boolean };
  mediaListOptions: {
    scoreFormat: string;
    rowOrder: string;
  };
}

export interface AnilistMediaList {
  id: number;
  mediaId: number;
  status: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
  score: number;
  progress: number;
  repeat: number;
  private: boolean;
  notes: string;
  startedAt: { year: number; month: number; day: number };
  completedAt: { year: number; month: number; day: number };
  media: {
    id: number;
    idMal: number;
    title: { romaji: string; english: string; native: string };
    coverImage: { large: string; extraLarge: string };
    status: string;
    episodes: number;
    format: string;
    averageScore: number;
  };
}

export interface AnilistAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
}

// ===================================
// OAuth Functions
// ===================================

/**
 * Generate OAuth authorization URL
 */
export function getAnilistAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
  });

  return `${ANILIST_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * Note: This typically requires a client secret and should be done server-side
 * For demo purposes, we're using PKCE or implicit flow
 */
export async function exchangeCodeForToken(code: string): Promise<AnilistAuthResponse | null> {
  try {
    const response = await fetch(ANILIST_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: OAUTH_CONFIG.clientId,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      console.error("Token exchange failed:", await response.text());
      return null;
    }

    const data = await response.json();

    // Add expiration timestamp
    return {
      ...data,
      expires_at: Date.now() + data.expires_in * 1000,
    };
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return null;
  }
}

// ===================================
// Token Storage
// =================================**

const TOKEN_KEY = "anilist_access_token";
const USER_KEY = "anilist_user_info";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(TOKEN_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data) as AnilistAuthResponse;

    // Check if token is expired
    if (parsed.expires_at && Date.now() > parsed.expires_at) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }

    return parsed.access_token;
  } catch {
    return null;
  }
}

export function storeToken(tokenData: AnilistAuthResponse): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AnilistUser | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: AnilistUser): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ===================================
// API Functions
// ===================================

/**
 * Fetch current user info
 */
export async function getCurrentUser(): Promise<AnilistUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const query = `
      query {
        Viewer {
          id
          name
          avatar {
            large
            medium
          }
          options {
            displayAdultContent
          }
          mediaListOptions {
            scoreFormat
            rowOrder
          }
        }
      }
    `;

    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredAuth();
      }
      return null;
    }

    const data = await response.json();
    const user = data.data?.Viewer;

    if (user) {
      storeUser(user);
    }

    return user || null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

/**
 * Fetch user's anime list
 */
export async function getUserAnimeList(
  status?: string
): Promise<AnilistMediaList[]> {
  const token = getStoredToken();
  if (!token) return [];

  try {
    const statusFilter = status ? `, status: ${status}` : "";

    const query = `
      query {
        MediaListCollection(type: ANIME, userName: null${statusFilter}) {
          lists {
            entries {
              id
              mediaId
              status
              score
              progress
              repeat
              private
              notes
              startedAt { year month day }
              completedAt { year month day }
              media {
                id
                idMal
                title { romaji english native }
                coverImage { large extraLarge }
                status
                episodes
                format
                averageScore
              }
            }
          }
        }
      }
    `;

    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) return [];

    const data = await response.json();

    // Flatten the lists structure
    const lists = data.data?.MediaListCollection?.lists || [];
    const entries: AnilistMediaList[] = [];

    for (const list of lists) {
      if (list.entries) {
        entries.push(...list.entries);
      }
    }

    return entries;
  } catch (error) {
    console.error("Error fetching anime list:", error);
    return [];
  }
}

/**
 * Update anime entry on user's list
 */
export async function updateAnimeEntry(params: {
  mediaId: number;
  status?: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
  score?: number;
  progress?: number;
  repeat?: number;
  private?: boolean;
  notes?: string;
  startedAt?: { year: number; month: number; day: number };
  completedAt?: { year: number; month: number; day: number };
}): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const mutations: string[] = [];

    if (params.status !== undefined) mutations.push(`status: ${params.status}`);
    if (params.score !== undefined) mutations.push(`scoreRaw: ${params.score}`);
    if (params.progress !== undefined) mutations.push(`progress: ${params.progress}`);
    if (params.repeat !== undefined) mutations.push(`repeat: ${params.repeat}`);
    if (params.private !== undefined) mutations.push(`private: ${params.private}`);

    if (params.startedAt) {
      mutations.push(`startedAt: { year: ${params.startedAt.year}, month: ${params.startedAt.month}, day: ${params.startedAt.day} }`);
    }

    if (params.completedAt) {
      mutations.push(`completedAt: { year: ${params.completedAt.year}, month: ${params.completedAt.month}, day: ${params.completedAt.day} }`);
    }

    if (params.notes !== undefined) {
      mutations.push(`notes: "${params.notes.replace(/"/g, '\\"')}"`);
    }

    const query = `
      mutation ($mediaId: Int) {
        SaveMediaListEntry(mediaId: $mediaId, ${mutations.join(", ")}) {
          id
          mediaId
          status
          score
          progress
        }
      }
    `;

    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { mediaId: params.mediaId },
      }),
    });

    if (!response.ok) {
      console.error("Update failed:", await response.text());
      return false;
    }

    const data = await response.json();
    return !!data.data?.SaveMediaListEntry;
  } catch (error) {
    console.error("Error updating anime entry:", error);
    return false;
  }
}

/**
 * Delete anime entry from user's list
 */
export async function deleteAnimeEntry(entryId: number): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const query = `
      mutation ($id: Int) {
        DeleteMediaListEntry(id: $id) { deletedId }
      }
    `;

    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { id: entryId },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error deleting anime entry:", error);
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

/**
 * Sign out from AniList
 */
export function signOut(): void {
  clearStoredAuth();
}
