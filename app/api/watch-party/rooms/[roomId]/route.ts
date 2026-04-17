/**
 * Watch Party Room Details API
 * GET /api/watch-party/rooms/[roomId] - Get room details
 * DELETE /api/watch-party/rooms/[roomId] - Delete room (host only)
 *
 * Phase 11: Production Deployment - Multi-Device Watch Party
 * Updated to use global WebSocket room manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader, getUserByUsername } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RoomDetails {
  id: string;
  name: string;
  animeId: number;
  episodeNumber: number;
  isPublic: boolean;
  hasPassword: boolean;
  viewerCount: number;
  createdAt: number;
  viewers: Array<{
    id: string;
    username: string;
    isHost: boolean;
  }>;
}

/**
 * Get the global watch party room manager
 */
function getRoomManager() {
  // @ts-ignore - Global is set by custom server
  return globalThis.__WATCH_PARTY_MANAGER__;
}

/**
 * GET - Get room details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get room manager
    const roomManager = getRoomManager();
    if (!roomManager) {
      return NextResponse.json(
        { error: 'Watch party service not available. Please use the custom server.' },
        { status: 503 }
      );
    }

    // Get room from WebSocket manager
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    const roomDetails: RoomDetails = {
      id: room.id,
      name: room.name,
      animeId: room.animeId,
      episodeNumber: room.episodeNumber,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      viewerCount: room.viewers.size,
      createdAt: room.createdAt,
      viewers: Array.from(room.viewers.values()).map((v: any) => ({
        id: v.id,
        username: v.username,
        isHost: v.isHost,
      })),
    };

    return NextResponse.json({
      room: roomDetails,
    });
  } catch (error) {
    console.error('[Watch Party] Error getting room:', error);
    return NextResponse.json(
      { error: 'Failed to get room details' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete room (host only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Get user info from auth — proper JWT verification
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify user exists in store
    const userRecord = getUserByUsername(payload.username);
    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    const userId = payload.userId;

    // Get room manager
    const roomManager = getRoomManager();
    if (!roomManager) {
      return NextResponse.json(
        { error: 'Watch party service not available. Please use the custom server.' },
        { status: 503 }
      );
    }

    // Get room to verify host
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Verify user is host
    if (room.hostId !== userId) {
      return NextResponse.json(
        { error: 'Only the host can delete this room' },
        { status: 403 }
      );
    }

    // Delete room
    const deleted = roomManager.deleteRoom(roomId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete room' },
        { status: 500 }
      );
    }

    // Notify all connected viewers via WebSocket
    const io = roomManager.getIO();
    if (io) {
      io.to(roomId).emit('room_deleted', {
        roomId,
        message: 'This room has been closed by the host',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Room deleted',
    });
  } catch (error) {
    console.error('[Watch Party] Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
}
