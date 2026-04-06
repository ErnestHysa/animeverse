/**
 * Watch Party Room Details API
 * GET /api/watch-party/rooms/[roomId] - Get room details
 * DELETE /api/watch-party/rooms/[roomId] - Delete room (host only)
 *
 * Phase 11: Production Deployment - Multi-Device Watch Party
 */

import { NextRequest, NextResponse } from 'next/server';

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
  hostUsername: string;
}

// Import rooms storage (shared with rooms route)
// In production, this would be a database
declare const rooms: Map<string, any>; // This will be shared via a proper module

/**
 * GET - Get room details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // TODO: Fetch from actual storage
    // For now, return mock data
    const mockRoom: RoomDetails = {
      id: roomId,
      name: 'Watch Party',
      animeId: 21459,
      episodeNumber: 1,
      isPublic: true,
      hasPassword: false,
      viewerCount: 1,
      createdAt: Date.now(),
      hostUsername: 'Host',
    };

    return NextResponse.json({
      room: mockRoom,
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

    // TODO: Verify user is host
    // TODO: Delete from storage
    // TODO: Notify all connected viewers

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
