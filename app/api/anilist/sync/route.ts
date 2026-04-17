import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Perform AniList sync using the httpOnly cookie token
 * Reads the token server-side and fetches the user's anime list from AniList API
 * Returns the data for the client to process
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('anilist_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Read user data from cookie to get the userId
    const userCookie = cookieStore.get('anilist_user')?.value;
    let userId: number | null = null;

    if (userCookie) {
      try {
        const userData = JSON.parse(userCookie);
        userId = userData?.id || null;
      } catch {
        // Malformed cookie
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User data not available. Please login again.' }, { status: 400 });
    }

    // Fetch user's anime list from AniList
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          query ($userId: Int) {
            MediaListCollection(userId: $userId, type: ANIME) {
              lists {
                entries {
                  mediaId
                  status
                  progress
                  score
                  startedAt { year month day }
                  completedAt { year month day }
                  media {
                    id
                    idMal
                    title { romaji english }
                    coverImage { large extraLarge }
                    status
                    episodes
                    genres
                    averageScore
                    format
                    duration
                    description
                    studios { nodes { name } }
                  }
                }
              }
            }
          }
        `,
        variables: { userId },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AniList Sync] API error:', errorText);
      return NextResponse.json({ error: 'AniList API error' }, { status: response.status });
    }

    const result = await response.json();
    const lists = result.data?.MediaListCollection?.lists || [];
    const allEntries = lists.flatMap((list: { entries: unknown[] }) => list.entries || []);

    return NextResponse.json({ entries: allEntries });
  } catch (error) {
    console.error('[AniList Sync] Error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
