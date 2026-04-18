import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Check if the user has an active AniList connection
 * Reads the httpOnly cookie set during OAuth callback
 * Returns connection status and user display data
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('anilist_token')?.value;

    if (!token) {
      return NextResponse.json({ connected: false, user: null });
    }

    // Read the httpOnly user data cookie (has full user data including id)
    const userCookie = cookieStore.get('anilist_user')?.value;
    let user = null;

    if (userCookie) {
      try {
        user = JSON.parse(userCookie);
      } catch {
        // Malformed cookie, ignore
      }
    }

    return NextResponse.json({
      connected: true,
      user: user ? {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      } : null,
    });
  } catch (error) {
    console.error('[AniList Status] Error:', error);
    return NextResponse.json({ connected: false, user: null });
  }
}

/**
 * DELETE handler: clear AniList httpOnly cookies on logout
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('anilist_token');
    cookieStore.delete('anilist_user');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AniList Status] Error clearing cookies:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
