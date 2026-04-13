/**
 * WebSocket Server for Multi-Device Watch Party
 * Enables real-time synchronization across different devices
 *
 * Phase 11: Production Deployment - Multi-Device Watch Party
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextRequest } from 'next/server';

// ===================================
// Types
// ===================================

export interface WatchPartyRoom {
  id: string;
  name: string;
  hostId: string;
  animeId: number;
  episodeNumber: number;
  isPublic: boolean;
  password?: string;
  createdAt: number;
  lastActivity: number;
  viewers: Map<string, WatchPartyViewer>;
}

export interface WatchPartyViewer {
  id: string;
  username: string;
  socketId: string;
  joinedAt: number;
  lastSeen: number;
  isHost: boolean;
}

export interface PlaybackSyncState {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  type?: 'text' | 'reaction' | 'system';
}

export interface TimelineReaction {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: number; // Video timestamp in seconds
  createdAt: number;
}

// ===================================
// Room Manager
// ===================================

class WatchPartyRoomManager {
  private rooms: Map<string, WatchPartyRoom> = new Map();
  private userToRoom: Map<string, string> = new Map(); // userId -> roomId
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private readonly ROOM_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly VIEWER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ROOMS = 100;
  private readonly MAX_MESSAGES_PER_ROOM = 200;
  private messagesPerRoom: Map<string, number> = new Map();
  private io: SocketIOServer | null = null;

  constructor() {
    // Clean up inactive rooms every 5 minutes
    setInterval(() => this.cleanupInactiveRooms(), 5 * 60 * 1000);
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer): void {
    if (this.io) {
      console.warn('[WatchParty] Socket.IO server already initialized');
      return;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupEventHandlers();
    console.log('[WatchParty] Socket.IO server initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('[WatchParty] Client connected:', socket.id);

      // Join room
      socket.on('join_room', (data: { roomId: string; username: string; password?: string }) => {
        this.handleJoinRoom(socket, data);
      });

      // Leave room
      socket.on('leave_room', () => {
        this.handleLeaveRoom(socket);
      });

      // Playback sync from host
      socket.on('sync_playback', (data: PlaybackSyncState) => {
        this.handlePlaybackSync(socket, data);
      });

      // Chat message
      socket.on('send_message', (data: { message: string }) => {
        this.handleChatMessage(socket, data);
      });

      // Timeline reaction
      socket.on('send_reaction', (data: { emoji: string; timestamp: number }) => {
        this.handleTimelineReaction(socket, data);
      });

      // Request sync state (newly joined viewer)
      socket.on('request_sync', () => {
        this.handleSyncRequest(socket);
      });

      // Viewer activity update
      socket.on('update_activity', () => {
        this.handleActivityUpdate(socket);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Error handling
      socket.on('error', (error) => {
        console.error('[WatchParty] Socket error:', error);
      });
    });
  }

  /**
   * Handle join room request
   */
  private handleJoinRoom(
    socket: any,
    data: { roomId: string; username: string; password?: string }
  ): void {
    const { roomId, username, password } = data;
    const room = this.rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check password if private
    if (!room.isPublic && room.password !== password) {
      socket.emit('error', { message: 'Invalid room password' });
      return;
    }

    // Check if user is already in room
    const existingRoomId = this.userToRoom.get(socket.id);
    if (existingRoomId) {
      socket.emit('error', { message: 'Already in a room' });
      return;
    }

    // Create viewer
    const viewerId = `viewer-${socket.id}`;
    const viewer: WatchPartyViewer = {
      id: viewerId,
      username,
      socketId: socket.id,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      isHost: socket.id === room.hostId,
    };

    // Add to room
    room.viewers.set(socket.id, viewer);
    this.userToRoom.set(socket.id, roomId);
    this.socketToUser.set(socket.id, viewerId);
    room.lastActivity = Date.now();

    // Join socket room
    socket.join(roomId);

    // Send success with room info
    socket.emit('room_joined', {
      roomId: room.id,
      name: room.name,
      animeId: room.animeId,
      episodeNumber: room.episodeNumber,
      isHost: viewer.isHost,
      viewers: Array.from(room.viewers.values()).map((v) => ({
        id: v.id,
        username: v.username,
        isHost: v.isHost,
      })),
    });

    // Notify others in room
    socket.to(roomId).emit('viewer_joined', {
      viewerId: viewer.id,
      username: viewer.username,
      isHost: viewer.isHost,
    });

    // Send system message
    this.broadcastToRoom(roomId, {
      type: 'system',
      message: `${username} joined the watch party`,
    });

    console.log(`[WatchParty] ${username} joined room ${roomId}`);
  }

  /**
   * Handle leave room request
   */
  private handleLeaveRoom(socket: any): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (!viewer) return;

    // Remove viewer from room
    room.viewers.delete(socket.id);
    this.userToRoom.delete(socket.id);
    this.socketToUser.delete(socket.id);
    room.lastActivity = Date.now();

    // Leave socket room
    socket.leave(roomId);

    // Notify others
    socket.to(roomId).emit('viewer_left', {
      viewerId: viewer.id,
      username: viewer.username,
    });

    // Send system message
    this.broadcastToRoom(roomId, {
      type: 'system',
      message: `${viewer.username} left the watch party`,
    });

    socket.emit('room_left', { roomId });

    console.log(`[WatchParty] ${viewer.username} left room ${roomId}`);
  }

  /**
   * Handle playback sync from host
   */
  private handlePlaybackSync(socket: any, data: PlaybackSyncState): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return; // Only host can sync

    room.lastActivity = Date.now();

    // Broadcast to all viewers except host
    socket.to(roomId).emit('playback_synced', {
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      playbackRate: data.playbackRate,
      timestamp: data.timestamp,
    });
  }

  /**
   * Handle chat message
   */
  private handleChatMessage(socket: any, data: { message: string }): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (!viewer) return;

    room.lastActivity = Date.now();
    viewer.lastSeen = Date.now();

    // Enforce max messages per room
    const msgCount = this.messagesPerRoom.get(roomId) || 0;
    if (msgCount >= this.MAX_MESSAGES_PER_ROOM) {
      socket.emit('error', { message: 'Room message limit reached' });
      return;
    }
    this.messagesPerRoom.set(roomId, msgCount + 1);

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      roomId,
      userId: viewer.id,
      username: viewer.username,
      message: data.message.replace(/<[^>]*>/g, ''),
      timestamp: Date.now(),
      type: 'text',
    };

    // Broadcast to all in room (including sender)
    this.io?.to(roomId).emit('new_message', message);
  }

  /**
   * Handle timeline reaction
   */
  private handleTimelineReaction(socket: any, data: { emoji: string; timestamp: number }): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (!viewer) return;

    room.lastActivity = Date.now();
    viewer.lastSeen = Date.now();

    const reaction: TimelineReaction = {
      id: `reaction-${Date.now()}-${Math.random()}`,
      roomId,
      userId: viewer.id,
      username: viewer.username,
      emoji: data.emoji,
      timestamp: data.timestamp,
      createdAt: Date.now(),
    };

    // Broadcast to all in room
    this.io?.to(roomId).emit('new_reaction', reaction);

    // Also show as temporary chat message
    this.io?.to(roomId).emit('new_message', {
      id: `msg-react-${Date.now()}`,
      roomId,
      userId: viewer.id,
      username: viewer.username,
      message: `reacted with ${data.emoji} at ${this.formatTimestamp(data.timestamp)}`,
      timestamp: Date.now(),
      type: 'reaction',
    });
  }

  /**
   * Handle sync request from newly joined viewer
   */
  private handleSyncRequest(socket: any): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Request current state from host
    const hostSocket = this.io?.sockets.sockets.get(room.hostId);
    if (hostSocket) {
      hostSocket.emit('sync_requested', {
        requesterSocketId: socket.id,
      });
    }
  }

  /**
   * Handle activity update
   */
  private handleActivityUpdate(socket: any): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (viewer) {
      viewer.lastSeen = Date.now();
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: any): void {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (viewer) {
      // Mark as potentially disconnected but keep in room for timeout
      viewer.lastSeen = Date.now();

      // Notify others
      socket.to(roomId).emit('viewer_disconnected', {
        viewerId: viewer.id,
        username: viewer.username,
      });
    }
  }

  /**
   * Create a new room
   */
  createRoom(data: {
    name: string;
    hostId: string;
    hostUsername: string;
    animeId: number;
    episodeNumber: number;
    isPublic: boolean;
    password?: string;
  }): WatchPartyRoom | null {
    // Enforce max rooms limit
    if (this.rooms.size >= this.MAX_ROOMS) {
      console.warn('[WatchParty] Max rooms limit reached, cannot create new room');
      return null;
    }

    const roomId = this.generateRoomId();

    const room: WatchPartyRoom = {
      id: roomId,
      name: data.name,
      hostId: data.hostId,
      animeId: data.animeId,
      episodeNumber: data.episodeNumber,
      isPublic: data.isPublic,
      password: data.password,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      viewers: new Map(),
    };

    this.rooms.set(roomId, room);
    console.log(`[WatchParty] Room created: ${roomId} (${data.name})`);

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): WatchPartyRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get public rooms
   */
  getPublicRooms(limit = 50): Array<{
    id: string;
    name: string;
    animeId: number;
    episodeNumber: number;
    viewerCount: number;
    createdAt: number;
  }> {
    return Array.from(this.rooms.values())
      .filter((room) => room.isPublic)
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, limit)
      .map((room) => ({
        id: room.id,
        name: room.name,
        animeId: room.animeId,
        episodeNumber: room.episodeNumber,
        viewerCount: room.viewers.size,
        createdAt: room.createdAt,
      }));
  }

  /**
   * Clean up inactive rooms and viewers
   */
  private cleanupInactiveRooms(): void {
    const now = Date.now();

    for (const [roomId, room] of this.rooms.entries()) {
      // Remove inactive viewers
      for (const [socketId, viewer] of room.viewers.entries()) {
        if (now - viewer.lastSeen > this.VIEWER_TIMEOUT) {
          room.viewers.delete(socketId);
          this.userToRoom.delete(socketId);

          // Notify others
          this.io?.to(roomId).emit('viewer_removed', {
            viewerId: viewer.id,
            username: viewer.username,
          });
        }
      }

      // Remove empty rooms or old rooms
      if (room.viewers.size === 0 || now - room.lastActivity > this.ROOM_TIMEOUT) {
        this.rooms.delete(roomId);
        this.messagesPerRoom.delete(roomId);
        console.log(`[WatchParty] Room removed: ${roomId}`);
      }
    }
  }

  /**
   * Broadcast system message to room
   */
  private broadcastToRoom(roomId: string, data: { type: string; message: string }): void {
    const message: ChatMessage = {
      id: `sys-${Date.now()}`,
      roomId,
      userId: 'system',
      username: 'System',
      message: data.message,
      timestamp: Date.now(),
      type: data.type as any,
    };

    this.io?.to(roomId).emit('new_message', message);
  }

  /**
   * Generate random room ID with uniqueness check
   */
  private generateRoomId(): string {
    let id: string;
    do {
      id = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(id));
    return id;
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

// ===================================
// Singleton Instance
// ===================================

const watchPartyRoomManager = new WatchPartyRoomManager();

export default watchPartyRoomManager;

// Export for Next.js API route usage
export { WatchPartyRoomManager };

