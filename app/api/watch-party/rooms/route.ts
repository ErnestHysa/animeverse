/**
 * Watch Party Rooms API
 * POST /api/watch-party/rooms - Create new room
 * GET /api/watch-party/rooms - List public rooms
 *
 * Phase 11: Production Deployment - Multi-Device Watch Party
 * Updated to use global WebSocket room manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { verifyToken, extractTokenFromHeader, getUserByUsername } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateRoomBody {
  name: string;
  animeId: number;
  episodeNumber: number;
  isPublic?: boolean;
  password?: string;
}

interface RoomResponse {
  id: string;
  name: string;
  animeId: number;
  episodeNumber: number;
  isPublic: boolean;
  viewerCount: number;
  createdAt: number;
}

/**
 * Get the global watch party room manager
 */
function getRoomManager() {
  // @ts-ignore - Global is set by custom server
  return globalThis.__WATCH_PARTY_MANAGER__;
}

/**
 * POST - Create new watch party room
 */
export async function POST(request: NextRequest) {
  try {
    // Body size check
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 1048576) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

    const body: CreateRoomBody = await request.json();
    const { name, animeId, episodeNumber, isPublic = true, password } = body;

    // Validate input
    if (!name || !animeId || !episodeNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: name, animeId, episodeNumber' },
        { status: 400 }
      );
    }

    // Get user info (from auth header or session) — proper JWT verification
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const payload = token ? verifyToken(token) : null;

    let hostId: string;
    let hostUsername: string;

    if (payload) {
      // Validate that the user exists in the admin store
      const userRecord = getUserByUsername(payload.username);
      if (!userRecord) {
        return NextResponse.json(
          { error: 'Invalid authentication: user not found' },
          { status: 401 }
        );
      }
      hostId = payload.userId;
      hostUsername = payload.username;
    } else {
      // Fallback for anonymous users — generate a random ID
      hostId = nanoid(10);
      hostUsername = 'Anonymous';
    }

    // Validate x-username header (non-empty, max length 50)
    const xUsername = request.headers.get('x-username');
    if (xUsername) {
      const trimmed = xUsername.trim();
      if (trimmed.length === 0 || trimmed.length > 50) {
        return NextResponse.json(
          { error: 'Invalid username' },
          { status: 400 }
        );
      }
      hostUsername = trimmed;
    }

    // Get room manager
    const roomManager = getRoomManager();
    if (!roomManager) {
      return NextResponse.json(
        { error: 'Watch party service not available. Please use the custom server.' },
        { status: 503 }
      );
    }

    // Create room via WebSocket manager
    const room = roomManager.createRoom({
      name: name.trim(),
      hostId,
      hostUsername,
      animeId,
      episodeNumber,
      isPublic,
      password: isPublic ? undefined : password,
    });

    const response: RoomResponse = {
      id: room.id,
      name: room.name,
      animeId: room.animeId,
      episodeNumber: room.episodeNumber,
      isPublic: room.isPublic,
      viewerCount: room.viewers.size,
      createdAt: room.createdAt,
    };

    return NextResponse.json({
      success: true,
      room: response,
    }, { status: 201 });
  } catch (error) {
    console.error('[Watch Party] Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

/**
 * GET - List public rooms
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const animeId = searchParams.get('animeId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const clampedLimit = Math.min(Math.max(limit, 1), 100);

    // Get room manager
    const roomManager = getRoomManager();
    if (!roomManager) {
      return NextResponse.json(
        { error: 'Watch party service not available. Please use the custom server.' },
        { status: 503 }
      );
    }

    // Get public rooms from WebSocket manager
    let publicRooms = roomManager.getPublicRooms(clampedLimit);

    // Filter by anime if specified
    if (animeId) {
      publicRooms = publicRooms.filter((room: any) => room.animeId === parseInt(animeId, 10));
    }

    return NextResponse.json({
      rooms: publicRooms,
      count: publicRooms.length,
    });
  } catch (error) {
    console.error('[Watch Party] Error listing rooms:', error);
    return NextResponse.json(
      { error: 'Failed to list rooms' },
      { status: 500 }
    );
  }
}
