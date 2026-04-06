/**
 * Watch Party Rooms API
 * POST /api/watch-party/rooms - Create new room
 * GET /api/watch-party/rooms - List public rooms
 *
 * Phase 11: Production Deployment - Multi-Device Watch Party
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

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

// In-memory room storage (TODO: Move to Redis/Database in production)
const rooms = new Map<string, {
  id: string;
  name: string;
  hostId: string;
  hostUsername: string;
  animeId: number;
  episodeNumber: number;
  isPublic: boolean;
  password?: string;
  createdAt: number;
  lastActivity: number;
  viewers: Set<string>;
}>();

/**
 * POST - Create new watch party room
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateRoomBody = await request.json();
    const { name, animeId, episodeNumber, isPublic = true, password } = body;

    // Validate input
    if (!name || !animeId || !episodeNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: name, animeId, episodeNumber' },
        { status: 400 }
      );
    }

    // Get user info (from auth header or session)
    const authHeader = request.headers.get('authorization');
    const userId = authHeader?.replace('Bearer ', '') || `guest-${Date.now()}`;
    const username = request.headers.get('x-username') || 'Anonymous';

    // Generate room ID
    const roomId = nanoid(8).toUpperCase();

    // Create room
    const room = {
      id: roomId,
      name: name.trim(),
      hostId: userId,
      hostUsername: username,
      animeId,
      episodeNumber,
      isPublic,
      password: isPublic ? undefined : password,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      viewers: new Set([userId]),
    };

    rooms.set(roomId, room);

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

    // Filter rooms
    let publicRooms = Array.from(rooms.values())
      .filter(room => room.isPublic);

    // Filter by anime if specified
    if (animeId) {
      publicRooms = publicRooms.filter(room => room.animeId === parseInt(animeId, 10));
    }

    // Sort by last activity and limit
    publicRooms = publicRooms
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, limit);

    const response: RoomResponse[] = publicRooms.map(room => ({
      id: room.id,
      name: room.name,
      animeId: room.animeId,
      episodeNumber: room.episodeNumber,
      isPublic: room.isPublic,
      viewerCount: room.viewers.size,
      createdAt: room.createdAt,
    }));

    return NextResponse.json({
      rooms: response,
      count: response.length,
    });
  } catch (error) {
    console.error('[Watch Party] Error listing rooms:', error);
    return NextResponse.json(
      { error: 'Failed to list rooms' },
      { status: 500 }
    );
  }
}
