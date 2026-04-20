import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * DELETE handler: clear MAL httpOnly cookies on logout
 * Similar to the AniList status DELETE endpoint
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('mal_token');
    cookieStore.delete('mal_refresh_token');
    cookieStore.delete('mal_token_expires');
    cookieStore.delete('mal_user');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MAL Status] Error clearing cookies:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
