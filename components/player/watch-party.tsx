/**
 * Watch Party Feature
 * Real-time synchronized viewing with chat
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Copy, Check, Send, X, Info } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { safeGetItem, safeSetItem, safeRemoveItem, getItemWithFallback } from "@/lib/storage";

// ===================================
// Types
// ===================================

export interface WatchPartyRoom {
  id: string;
  name: string;
  host: string;
  viewers: number;
  animeId: number;
  episodeNumber: number;
  isPublic: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface WatchPartyState {
  roomId: string | null;
  isHost: boolean;
  currentTime: number;
  isPlaying: boolean;
  viewers: string[];
  chat: ChatMessage[];
}

// ===================================
// Watch Party Hook
// ===================================

const STORAGE_KEY = "animeverse-watchparty";

export function useWatchParty(animeId: number, episodeNumber: number) {
  const [state, setState] = useState<WatchPartyState>({
    roomId: null,
    isHost: false,
    currentTime: 0,
    isPlaying: false,
    viewers: [],
    chat: [],
  });
  const [userName, setUserNameState] = useState(() => {
    return getItemWithFallback<string>(`${STORAGE_KEY}-username`, `User${Math.floor(Math.random() * 10000)}`);
  });

  // Refs for values needed in callbacks to avoid stale closures (Fix L7)
  const stateRef = useRef(state);
  stateRef.current = state;
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  // Generate room ID
  const generateRoomId = useCallback(() => {
    return crypto.randomUUID().substring(0, 8).toUpperCase();
  }, []);

  // Create a new watch party room
  const createRoom = useCallback((roomName?: string) => {
    const roomId = generateRoomId();
    const room: WatchPartyRoom = {
      id: roomId,
      name: roomName || "Watch Party",
      host: userNameRef.current,
      viewers: 1,
      animeId,
      episodeNumber,
      isPublic: true,
      createdAt: Date.now(),
    };

    // Store room (in production, use backend)
    safeSetItem(`${STORAGE_KEY}-room-${roomId}`, room);
    safeSetItem(`${STORAGE_KEY}-current`, { roomId, isHost: true });

    setState({
      roomId,
      isHost: true,
      currentTime: 0,
      isPlaying: false,
      viewers: [userNameRef.current],
      chat: [],
    });

    toast.success(`Room created: ${roomId}`);
    return roomId;
  }, [animeId, episodeNumber, generateRoomId]);

  // Helper: atomic-ish localStorage read-modify-write with retry (Fix H8)
  const atomicRoomUpdate = useCallback(
    (roomId: string, mutate: (room: WatchPartyRoom) => void, retries = 1): boolean => {
      try {
        const result = safeGetItem<WatchPartyRoom>(`${STORAGE_KEY}-room-${roomId}`);
        if (!result.success || !result.data) return false;
        const room = result.data;
        mutate(room);
        safeSetItem(`${STORAGE_KEY}-room-${roomId}`, room);
        return true;
      } catch {
        if (retries > 0) {
          // Small random delay to reduce collision probability, then retry once
          const delay = 50 + Math.floor(Math.random() * 100);
          const start = Date.now();
          while (Date.now() - start < delay) { /* busy-wait is fine for <150ms */ }
          try {
            const result = safeGetItem<WatchPartyRoom>(`${STORAGE_KEY}-room-${roomId}`);
            if (!result.success || !result.data) return false;
            const room = result.data;
            mutate(room);
            safeSetItem(`${STORAGE_KEY}-room-${roomId}`, room);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
    },
    [],
  );

  // Join an existing room
  const joinRoom = useCallback((roomId: string) => {
    const result = safeGetItem<WatchPartyRoom>(`${STORAGE_KEY}-room-${roomId}`);

    if (!result.success || !result.data) {
      toast.error("Room not found");
      return false;
    }

    const room = result.data;

    if (room.animeId !== animeId || room.episodeNumber !== episodeNumber) {
      toast.error("This room is for a different episode");
      return false;
    }

    try {
      safeSetItem(`${STORAGE_KEY}-current`, { roomId, isHost: false });

      // Add viewer to room with retry (Fix H8)
      const updated = atomicRoomUpdate(roomId, (r) => { r.viewers++; });
      if (!updated) {
        // Write failed after retry — still join but warn
        console.warn("Failed to update room viewer count after retry");
      }

      setState({
        roomId,
        isHost: false,
        currentTime: 0,
        isPlaying: false,
        viewers: [],
        chat: [],
      });

      toast.success(`Joined room: ${roomId}`);
      return true;
    } catch {
      toast.error("Failed to join room. Please try again.");
      return false;
    }
  }, [animeId, episodeNumber, atomicRoomUpdate]);

  // Leave current room — uses refs to avoid stale closure (Fix L7)
  const leaveRoom = useCallback(() => {
    const { roomId } = stateRef.current;
    if (!roomId) return;

    try {
      const updated = atomicRoomUpdate(roomId, (room) => {
        if (room.viewers > 0) {
          room.viewers--;
        }
      });
      if (!updated) {
        console.warn("Failed to decrement room viewer count after retry");
      }

      safeRemoveItem(`${STORAGE_KEY}-current`);
      setState({
        roomId: null,
        isHost: false,
        currentTime: 0,
        isPlaying: false,
        viewers: [],
        chat: [],
      });

      toast.success("Left watch party");
    } catch {
      // Best-effort: still clear local state even if localStorage write fails
      safeRemoveItem(`${STORAGE_KEY}-current`);
      setState({
        roomId: null,
        isHost: false,
        currentTime: 0,
        isPlaying: false,
        viewers: [],
        chat: [],
      });
      toast.success("Left watch party");
    }
  }, [atomicRoomUpdate]);

  // Sync playback state — uses refs to avoid stale closure (Fix L7)
  const syncPlayback = useCallback((currentTime: number, isPlaying: boolean) => {
    const { roomId, isHost } = stateRef.current;
    if (!roomId || !isHost) return;

    // Update room state (in production, broadcast to all viewers via WebSocket)
    const result = safeGetItem<WatchPartyRoom>(`${STORAGE_KEY}-room-${roomId}`);
    if (result.success && result.data) {
      safeSetItem(`${STORAGE_KEY}-sync-${roomId}`, {
        currentTime,
        isPlaying,
        timestamp: Date.now(),
      });
    }

    setState((prev) => ({ ...prev, currentTime, isPlaying }));
  }, []);

  // Send chat message — uses refs to avoid stale closure (Fix L7)
  const sendChat = useCallback((message: string) => {
    const { roomId } = stateRef.current;
    if (!roomId) return;

    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: userNameRef.current,
      username: userNameRef.current,
      message,
      timestamp: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      chat: [...prev.chat, chatMessage],
    }));

    // Store in room chat (in production, send via WebSocket)
    const chatKey = `${STORAGE_KEY}-chat-${roomId}`;
    const existingChat = getItemWithFallback<ChatMessage[]>(chatKey, []);
    existingChat.push(chatMessage);
    safeSetItem(chatKey, existingChat.slice(-50)); // Keep last 50 messages
  }, []);

  // Poll for chat and sync state in a single interval to avoid race conditions
  useEffect(() => {
    const { roomId, isHost } = state;
    if (!roomId) return;

    const chatKey = `${STORAGE_KEY}-chat-${roomId}`;
    const syncKey = `${STORAGE_KEY}-sync-${roomId}`;

    // Initial chat load
    const initialChat = safeGetItem<ChatMessage[]>(chatKey);
    if (initialChat.success && initialChat.data) {
      setState((prev) => ({ ...prev, chat: initialChat.data! }));
    }

    // Single merged polling interval handles both chat + sync
    const interval = setInterval(() => {
      // Chat poll (every cycle = 2s)
      const chatResult = safeGetItem<ChatMessage[]>(chatKey);
      if (chatResult.success && chatResult.data) {
        setState((prev) => ({ ...prev, chat: chatResult.data! }));
      }

      // Sync poll (non-hosts only, every cycle)
      if (!isHost) {
        const syncResult = safeGetItem<{ currentTime: number; isPlaying: boolean; timestamp: number }>(syncKey);
        if (syncResult.success && syncResult.data) {
          const sync = syncResult.data;
          // Only sync if recent (within 5 seconds)
          if (Date.now() - sync.timestamp < 5000) {
            setState((prev) => ({
              ...prev,
              currentTime: sync.currentTime,
              isPlaying: sync.isPlaying,
            }));
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state.roomId, state.isHost]);

  return {
    state,
    userName,
    setUserName: (name: string) => {
      safeSetItem(`${STORAGE_KEY}-username`, name);
      setUserNameState(name);
    },
    createRoom,
    joinRoom,
    leaveRoom,
    syncPlayback,
    sendChat,
  };
}

// ===================================
// Components
// ===================================

interface WatchPartyControlsProps {
  animeId: number;
  episodeNumber: number;
  onSync?: (currentTime: number, isPlaying: boolean) => void;
  onSyncState?: (data: { currentTime: number; isPlaying: boolean }) => void;
  currentTime?: number;
  isPlaying?: boolean;
}

export function WatchPartyControls({
  animeId,
  episodeNumber,
  onSync,
  onSyncState,
  currentTime = 0,
  isPlaying = false,
}: WatchPartyControlsProps) {
  const {
    state,
    userName,
    setUserName,
    createRoom,
    joinRoom,
    leaveRoom,
    syncPlayback,
    sendChat,
  } = useWatchParty(animeId, episodeNumber);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // BroadcastChannel for real cross-tab sync
  useEffect(() => {
    if (!state.roomId) return;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channelRef.current = new BroadcastChannel(`watch-party-${state.roomId}`);
      channelRef.current.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === "SYNC_STATE") {
          if (onSyncState) onSyncState(data);
        } else if (type === "CHAT_MESSAGE") {
          // Messages from other tabs arrive here; the localStorage poll handles dedup
        }
      };
    }

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [state.roomId, onSyncState]);

  // Sync playback when current time changes — also broadcast to other tabs
  useEffect(() => {
    if (state.isHost && onSync) {
      onSync(currentTime, isPlaying);
    }
    if (state.isHost && state.roomId && channelRef.current) {
      channelRef.current.postMessage({
        type: "SYNC_STATE",
        data: { currentTime, isPlaying },
      });
    }
  }, [currentTime, isPlaying, state.isHost, state.roomId, onSync]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    }
  }, [state.chat]);

  // Cleanup copied timer on unmount (Fix L5)
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopyRoomId = async () => {
    if (state.roomId) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(state.roomId);
        }
        setCopied(true);
        toast.success("Room ID copied!");
      } catch {
        // Fallback: create a temporary textarea for clipboard copy
        // Note: document.execCommand('copy') is deprecated but remains necessary
        // as a fallback when the Clipboard API is unavailable (e.g. non-HTTPS contexts)
        try {
          const textarea = document.createElement('textarea');
          textarea.value = state.roomId;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          setCopied(true);
          toast.success("Room ID copied!");
        } catch (fallbackErr) {
          toast.error("Failed to copy room ID");
        }
      }
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      sendChat(chatInput);
      setChatInput("");
    }
  };

  if (!state.roomId) {
    return (
      <>
        <Button
          onClick={() => setShowJoinModal(true)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Watch Party
        </Button>

        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <GlassCard className="max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Watch Party</h2>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      createRoom();
                      setShowJoinModal(false);
                    }}
                    className="w-full"
                  >
                    Create Room
                  </Button>
                  <Button
                    onClick={() => {
                      if (roomIdInput.trim()) {
                        joinRoom(roomIdInput.trim());
                        setShowJoinModal(false);
                      }
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Join Room
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Room ID</label>
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    placeholder="Enter Room ID"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Watch together with friends in real-time sync
              </p>
            </GlassCard>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative">
      {/* Chat Sidebar */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Watch Party</h3>
                <p className="text-xs text-muted-foreground">Room: {state.roomId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyRoomId}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy Room ID"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowChat(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Same-device notice */}
          <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 flex gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300 leading-snug">
              Watch Party works between tabs in the same browser. For multi-device sync, connect with friends and manually coordinate playback.
            </p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={chatEndRef}>
            {state.chat.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No messages yet. Say hi!
              </p>
            ) : (
              state.chat.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${msg.userId === userName ? "items-end" : "items-start"}`}
                >
                  <span className="text-xs text-muted-foreground px-1">
                    {msg.username}
                  </span>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg ${
                      msg.userId === userName
                        ? "bg-primary text-white"
                        : "bg-white/10"
                    }`}
                  >
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className="p-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="flex items-center gap-2">
        {!showChat && (
          <Button
            onClick={() => setShowChat(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Chat ({state.chat.length})
          </Button>
        )}

        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 rounded-lg">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{state.roomId}</span>
          {state.isHost && (
            <span className="text-xs bg-primary px-2 py-0.5 rounded">HOST</span>
          )}
        </div>

        <Button
          onClick={leaveRoom}
          variant="outline"
          size="sm"
        >
          Leave
        </Button>
      </div>

      {/* Chat Toggle Button (when chat is hidden) */}
      {!showChat && state.chat.length > 0 && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-24 right-4 p-3 bg-primary text-white rounded-full shadow-lg z-30"
        >
          <Users className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
