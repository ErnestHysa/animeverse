/**
 * Custom Next.js Server with WebSocket Support
 * Initializes Socket.IO server for multi-device watch parties
 *
 * Phase 11: Production Deployment - WebSocket Server Integration
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');
const crypto = require('crypto');

// ===================================
// Configuration
// ===================================

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ===================================
// Watch Party Room Manager (Inline)
// ===================================

class WatchPartyRoomManager {
  constructor() {
    this.rooms = new Map();
    this.userToRoom = new Map();
    this.socketToUser = new Map();
    this.ROOM_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    this.VIEWER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    this.MAX_ROOMS = 100;
    this.MAX_MESSAGES_PER_ROOM = 200;
    this.MAX_VIEWERS_PER_ROOM = 50;
    this.messagesPerRoom = new Map();
    this.io = null;

    // Clean up inactive rooms every 5 minutes
    setInterval(() => this.cleanupInactiveRooms(), 5 * 60 * 1000);
  }

  initialize(httpServer) {
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

  setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('[WatchParty] Client connected:', socket.id);

      socket.on('join_room', (data) => {
        this.handleJoinRoom(socket, data);
      });

      socket.on('leave_room', () => {
        this.handleLeaveRoom(socket);
      });

      socket.on('sync_playback', (data) => {
        this.handlePlaybackSync(socket, data);
      });

      socket.on('send_message', (data) => {
        this.handleChatMessage(socket, data);
      });

      socket.on('send_reaction', (data) => {
        this.handleTimelineReaction(socket, data);
      });

      socket.on('request_sync', () => {
        this.handleSyncRequest(socket);
      });

      socket.on('update_activity', () => {
        this.handleActivityUpdate(socket);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('error', (error) => {
        console.error('[WatchParty] Socket error:', error);
      });
    });
  }

  handleJoinRoom(socket, data) {
    const { roomId, username, password } = data;

    // Validate username
    if (!username || typeof username !== 'string' || username.length > 30) {
      socket.emit('error', { message: 'Invalid username' });
      return;
    }

    const room = this.rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!room.isPublic && room.password) {
      if (!password) {
        socket.emit('error', { message: 'Invalid room password' });
        return;
      }
      try {
        // Always hash both inputs to fixed length before comparing to prevent timing leaks
        const aBuf = Buffer.from(String(room.password), 'utf-8');
        const bBuf = Buffer.from(String(password), 'utf-8');
        const aHash = crypto.createHash('sha256').update(aBuf).digest();
        const bHash = crypto.createHash('sha256').update(bBuf).digest();
        if (!crypto.timingSafeEqual(aHash, bHash)) {
          socket.emit('error', { message: 'Invalid room password' });
          return;
        }
      } catch {
        socket.emit('error', { message: 'Invalid room password' });
        return;
      }
    }

    const viewerId = `viewer-${socket.id}`;

    // Enforce room viewer limit
    if (room.viewers.size >= this.MAX_VIEWERS_PER_ROOM) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const viewer = {
      id: viewerId,
      username,
      socketId: socket.id,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      isHost: socket.id === room.hostId,
    };

    room.viewers.set(socket.id, viewer);
    this.userToRoom.set(socket.id, roomId);
    this.socketToUser.set(socket.id, viewerId);
    room.lastActivity = Date.now();

    socket.join(roomId);

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

    socket.to(roomId).emit('viewer_joined', {
      viewerId: viewer.id,
      username: viewer.username,
      isHost: viewer.isHost,
    });

    this.broadcastToRoom(roomId, {
      type: 'system',
      message: `${username} joined the watch party`,
    });

    console.log(`[WatchParty] ${username} joined room ${roomId}`);
  }

  handleLeaveRoom(socket) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (!viewer) return;

    room.viewers.delete(socket.id);
    this.userToRoom.delete(socket.id);
    this.socketToUser.delete(socket.id);
    room.lastActivity = Date.now();

    socket.leave(roomId);

    socket.to(roomId).emit('viewer_left', {
      viewerId: viewer.id,
      username: viewer.username,
    });

    this.broadcastToRoom(roomId, {
      type: 'system',
      message: `${viewer.username} left the watch party`,
    });

    socket.emit('room_left', { roomId });
    console.log(`[WatchParty] ${viewer.username} left room ${roomId}`);
  }

  handlePlaybackSync(socket, data) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;

    room.lastActivity = Date.now();

    socket.to(roomId).emit('playback_synced', {
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      playbackRate: data.playbackRate,
      timestamp: data.timestamp,
    });
  }

  handleChatMessage(socket, data) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (!viewer) return;

    room.lastActivity = Date.now();
    viewer.lastSeen = Date.now();

    // Validate message length
    if (!data.message || typeof data.message !== 'string' || data.message.length > 500) {
      return;
    }

    // Enforce max messages per room
    const msgCount = this.messagesPerRoom.get(roomId) || 0;
    if (msgCount >= this.MAX_MESSAGES_PER_ROOM) {
      socket.emit('error', { message: 'Room message limit reached' });
      return;
    }
    this.messagesPerRoom.set(roomId, msgCount + 1);

    const message = {
      id: `msg-${Date.now()}-${crypto.randomUUID()}`,
      roomId,
      userId: viewer.id,
      username: viewer.username,
      message: data.message ? data.message.replace(/<[^>]*>/g, '') : '',
      timestamp: Date.now(),
      type: 'text',
    };

    this.io.to(roomId).emit('new_message', message);
  }

  handleTimelineReaction(socket, data) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (!viewer) return;

    room.lastActivity = Date.now();
    viewer.lastSeen = Date.now();

    const reaction = {
      id: `reaction-${Date.now()}-${crypto.randomUUID()}`,
      roomId,
      userId: viewer.id,
      username: viewer.username,
      emoji: data.emoji,
      timestamp: data.timestamp,
      createdAt: Date.now(),
    };

    this.io.to(roomId).emit('new_reaction', reaction);

    this.io.to(roomId).emit('new_message', {
      id: `msg-react-${Date.now()}`,
      roomId,
      userId: viewer.id,
      username: viewer.username,
      message: `reacted with ${data.emoji} at ${this.formatTimestamp(data.timestamp)}`,
      timestamp: Date.now(),
      type: 'reaction',
    });
  }

  handleSyncRequest(socket) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const hostSocket = this.io.sockets.sockets.get(room.hostId);
    if (hostSocket) {
      hostSocket.emit('sync_requested', {
        requesterSocketId: socket.id,
      });
    }
  }

  handleActivityUpdate(socket) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (viewer) {
      viewer.lastSeen = Date.now();
    }
  }

  handleDisconnect(socket) {
    const roomId = this.userToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(socket.id);
    if (viewer) {
      viewer.lastSeen = Date.now();

      socket.to(roomId).emit('viewer_disconnected', {
        viewerId: viewer.id,
        username: viewer.username,
      });

      // Transfer host if the disconnecting user is the host
      if (socket.id === room.hostId) {
        const viewers = Array.from(room.viewers.values())
          .filter(v => v.socketId !== socket.id && v.lastSeen > 0)
          .sort((a, b) => a.joinedAt - b.joinedAt);
        if (viewers.length > 0) {
          room.hostId = viewers[0].socketId;
          viewers[0].isHost = true;
          this.broadcastToRoom(roomId, { type: 'system', message: `${viewers[0].username} is now the host` });
          this.io.to(roomId).emit('host_changed', { newHost: viewers[0].username });
        }
      }
    }
  }

  createRoom(data) {
    // Enforce max rooms limit
    if (this.rooms.size >= this.MAX_ROOMS) {
      console.warn('[WatchParty] Max rooms limit reached, cannot create new room');
      return null;
    }

    const roomId = this.generateRoomId();

    const room = {
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

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getPublicRooms(limit = 50) {
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

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    this.rooms.delete(roomId);
    console.log(`[WatchParty] Room deleted: ${roomId}`);
    return true;
  }

  cleanupInactiveRooms() {
    const now = Date.now();

    for (const [roomId, room] of this.rooms.entries()) {
      for (const [socketId, viewer] of room.viewers.entries()) {
        if (now - viewer.lastSeen > this.VIEWER_TIMEOUT) {
          room.viewers.delete(socketId);
          this.userToRoom.delete(socketId);

          this.io.to(roomId).emit('viewer_removed', {
            viewerId: viewer.id,
            username: viewer.username,
          });
        }
      }

      if (room.viewers.size === 0 || now - room.lastActivity > this.ROOM_TIMEOUT) {
        this.rooms.delete(roomId);
        this.messagesPerRoom.delete(roomId);
        console.log(`[WatchParty] Room removed: ${roomId}`);
      }
    }
  }

  broadcastToRoom(roomId, data) {
    const message = {
      id: `sys-${Date.now()}`,
      roomId,
      userId: 'system',
      username: 'System',
      message: data.message,
      timestamp: Date.now(),
      type: data.type,
    };

    this.io.to(roomId).emit('new_message', message);
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getIO() {
    return this.io;
  }
}

// Module-level room manager instance
const watchPartyManager = new WatchPartyRoomManager();

// Expose globally for API route access (standard Node.js pattern for cross-module sharing)
if (typeof globalThis !== 'undefined') {
  globalThis.__WATCH_PARTY_MANAGER__ = watchPartyManager;
}

// ===================================
// Server Initialization
// ===================================

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialize Socket.IO server
  watchPartyManager.initialize(httpServer);

  httpServer
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> WebSocket server initialized for watch parties');
    });
});
