/**
 * Episode Comments Component
 * Display and add comments for specific episodes with timestamp support
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useEpisodeComments, formatTimestamp, parseTimestamp } from "@/lib/episode-comments";
import {
  MessageSquare,
  Send,
  Trash2,
  ThumbsUp,
  Edit2,
  X,
  Eye,
  EyeOff,
  Clock,
  User,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface EpisodeCommentsProps {
  animeId: number;
  episodeNumber: number;
  currentTimestamp?: number; // Current video playback position in seconds
  onSeekToTimestamp?: (timestamp: number) => void;
  className?: string;
}

export function EpisodeComments({
  animeId,
  episodeNumber,
  currentTimestamp,
  onSeekToTimestamp,
  className = "",
}: EpisodeCommentsProps) {
  const {
    getCommentsForEpisode,
    addComment,
    updateComment,
    deleteComment,
    toggleLike,
  } = useEpisodeComments();

  const [comments, setComments] = useState(getCommentsForEpisode(animeId, episodeNumber));
  const [newComment, setNewComment] = useState("");
  const [timestampMode, setTimestampMode] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showSpoilerComments, setShowSpoilerComments] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setComments(getCommentsForEpisode(animeId, episodeNumber));
  }, [animeId, episodeNumber, getCommentsForEpisode]);

  const handleSubmit = () => {
    if (!newComment.trim()) return;

    const timestamp = timestampMode && currentTimestamp !== undefined
      ? Math.floor(currentTimestamp)
      : null;

    addComment({
      animeId,
      episodeNumber,
      userId: "local",
      userName: "You",
      content: newComment,
      timestamp,
      isSpoiler,
    });

    setNewComment("");
    setTimestampMode(false);
    setIsSpoiler(false);
    setComments(getCommentsForEpisode(animeId, episodeNumber));
  };

  const handleEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };

  const handleSaveEdit = () => {
    if (editingId && editContent.trim()) {
      updateComment(editingId, editContent);
      setEditingId(null);
      setEditContent("");
      setComments(getCommentsForEpisode(animeId, episodeNumber));
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this comment?")) {
      deleteComment(id);
      setComments(getCommentsForEpisode(animeId, episodeNumber));
    }
  };

  // Filter comments based on spoiler settings
  const visibleComments = comments.filter((c) =>
    showSpoilerComments ? true : !c.isSpoiler
  );

  // Separate timestamp comments from general comments
  const timestampComments = visibleComments.filter((c) => c.timestamp !== null);
  const generalComments = visibleComments.filter((c) => c.timestamp === null);

  const CommentItem = ({
    comment,
    showTimestamp = true,
  }: {
    comment: typeof comments[0];
    showTimestamp?: boolean;
  }) => {
    const isEditing = editingId === comment.id;

    return (
      <div className={`p-4 rounded-lg ${comment.isSpoiler ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/5"}`}>
        <div className="flex items-start gap-3">
          {comment.userAvatar ? (
            <img
              src={comment.userAvatar}
              alt={comment.userName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{comment.userName}</span>
              {comment.isSpoiler && (
                <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded">
                  Spoiler
                </span>
              )}
              {showTimestamp && comment.timestamp !== null && (
                <button
                  onClick={() => onSeekToTimestamp?.(comment.timestamp!)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(comment.timestamp)}
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>

            {isEditing ? (
              <div className="mt-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none resize-none"
                  rows={3}
                  autoFocus
                  suppressHydrationWarning
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditContent("");
                    }}
                    className="px-3 py-1 bg-white/10 rounded-lg text-sm hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : comment.isSpoiler && !showSpoilerComments ? (
              <p className="text-sm text-muted-foreground italic mt-1">
                This comment contains spoilers
              </p>
            ) : (
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleLike(comment.id)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-primary"
              >
                <ThumbsUp className="w-4 h-4" />
                {comment.likes > 0 && (
                  <span className="text-xs ml-1">{comment.likes}</span>
                )}
              </button>
              <button
                onClick={() => handleEdit(comment.id, comment.content)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-primary"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(comment.id)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Comment Input */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Add a Comment</h3>
        </div>

        <textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts about this episode..."
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none resize-none"
          rows={3}
          suppressHydrationWarning
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {currentTimestamp !== undefined && (
              <button
                onClick={() => setTimestampMode(!timestampMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  timestampMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <Clock className="w-4 h-4" />
                {timestampMode ? formatTimestamp(currentTimestamp) : "Add Timestamp"}
              </button>
            )}
            <button
              onClick={() => setIsSpoiler(!isSpoiler)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isSpoiler
                  ? "bg-yellow-500/20 text-yellow-500"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {isSpoiler ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Spoiler
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!newComment.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            Post
          </button>
        </div>
      </GlassCard>

      {/* Toggle Spoiler Comments */}
      {comments.some((c) => c.isSpoiler) && (
        <button
          onClick={() => setShowSpoilerComments(!showSpoilerComments)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSpoilerComments ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showSpoilerComments ? "Hide" : "Show"} spoiler comments
        </button>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {/* Timestamp Comments */}
        {timestampComments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timestamped Comments ({timestampComments.length})
            </h4>
            <div className="space-y-2">
              {timestampComments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} showTimestamp />
              ))}
            </div>
          </div>
        )}

        {/* General Comments */}
        {generalComments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              All Comments ({generalComments.length})
            </h4>
            <div className="space-y-2">
              {generalComments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {visibleComments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        )}
      </div>
    </div>
  );
}
