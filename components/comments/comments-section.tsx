/**
 * Comments Section Component
 * User comments and ratings for anime
 */

"use client";

import { useState, useEffect } from "react";
import { MessageSquare, ThumbsUp, ThumbsDown, Reply, User, Star } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { useAniListAuth } from "@/store";
import { safeGetItem, safeSetItem } from "@/lib/storage";

interface Comment {
  id: string;
  animeId: number;
  user: {
    name: string;
    avatar?: string;
  };
  content: string;
  rating?: number;
  timestamp: number;
  likes: number;
  dislikes: number;
  replies?: Comment[];
}

// Custom hook to get current time with periodic updates (every minute)
function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    // Update every minute to refresh relative time displays
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return currentTime;
}

interface CommentsSectionProps {
  animeId: number;
  animeTitle: string;
}

export function CommentsSection({ animeId, animeTitle }: CommentsSectionProps) {
  const storageKey = `comments-${animeId}`;
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [dislikedComments, setDislikedComments] = useState<Set<string>>(new Set());
  const currentTime = useCurrentTime(); // Hook that updates every minute
  const { anilistUser, isAuthenticated } = useAniListAuth();

  useEffect(() => {
    const loadComments = () => {
      const stored = safeGetItem<Comment[]>(storageKey);
      if (stored.success && stored.data) {
        setComments(stored.data);
      }
    };

    loadComments();

    // Listen for comment updates
    const handleStorage = () => loadComments();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  const handleSubmit = () => {
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    const comment: Comment = {
      id: Date.now().toString(),
      animeId,
      user: {
        name: isAuthenticated && anilistUser ? anilistUser.name : "Anonymous",
        avatar: isAuthenticated && anilistUser ? anilistUser.avatar?.medium : undefined,
      },
      content: newComment,
      rating: userRating || undefined,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
    };

    const updatedComments = replyTo
      ? comments.map((c) =>
          c.id === replyTo
            ? {
                ...c,
                replies: [...(c.replies || []), comment],
              }
            : c
        )
      : [comment, ...comments];

    setComments(updatedComments);
    safeSetItem(storageKey, updatedComments);
    setNewComment("");
    setUserRating(0);
    setReplyTo(null);
    toast.success("Comment posted!");
  };

  const handleLike = (commentId: string) => {
    const isLiked = likedComments.has(commentId);
    const wasDisliked = dislikedComments.has(commentId);

    const updatedComments = comments.map((c) => {
      if (c.id === commentId) {
        let delta = isLiked ? -1 : 1;
        // If switching from dislike to like, undo the dislike
        let dislikeDelta = wasDisliked ? -1 : 0;
        return { ...c, likes: c.likes + delta, dislikes: c.dislikes + dislikeDelta };
      }
      return c;
    });
    setComments(updatedComments);
    safeSetItem(storageKey, updatedComments);

    setLikedComments((prev) => {
      const next = new Set(prev);
      if (isLiked) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });

    // Also remove from disliked if switching to like
    if (!isLiked && wasDisliked) {
      setDislikedComments((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const handleDislike = (commentId: string) => {
    const isDisliked = dislikedComments.has(commentId);
    const wasLiked = likedComments.has(commentId);

    const updatedComments = comments.map((c) => {
      if (c.id === commentId) {
        let delta = isDisliked ? -1 : 1;
        // If switching from like to dislike, undo the like
        let likeDelta = wasLiked ? -1 : 0;
        return { ...c, dislikes: c.dislikes + delta, likes: c.likes + likeDelta };
      }
      return c;
    });
    setComments(updatedComments);
    safeSetItem(storageKey, updatedComments);

    setDislikedComments((prev) => {
      const next = new Set(prev);
      if (isDisliked) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });

    // Also remove from liked if switching to dislike
    if (!isDisliked && wasLiked) {
      setLikedComments((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === "recent") {
      return b.timestamp - a.timestamp;
    }
    return b.likes - a.likes;
  });

  const formatTime = (timestamp: number) => {
    const diff = currentTime - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const averageRating =
    comments.filter((c) => c.rating).length > 0
      ? comments
          .filter((c) => c.rating)
          .reduce((sum, c) => sum + (c.rating || 0), 0) /
        comments.filter((c) => c.rating).length
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Comments & Reviews</h2>
        <div className="flex items-center gap-4 text-sm">
          {comments.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({comments.filter((c) => c.rating).length})</span>
              </div>
              <span className="text-muted-foreground">•</span>
              <span>{comments.length} comments</span>
            </>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "top")}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="recent">Recent</option>
            <option value="top">Top Rated</option>
          </select>
        </div>
      </div>

      {/* Write Comment */}
      <GlassCard className="p-4">
        <h3 className="font-medium mb-4">Leave a Review</h3>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Your rating:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setUserRating(star === userRating ? 0 : star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= userRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "fill-white/20"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Comment Input */}
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts about this anime..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 resize-none"
          rows={3}
          suppressHydrationWarning
        />

        {/* Reply indicator */}
        {replyTo && (
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
            <span>Replying to comment</span>
            <button
              onClick={() => {
                setReplyTo(null);
              }}
              className="text-primary hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Submit */}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim()}
            className="min-w-24"
          >
            {replyTo ? "Reply" : "Post Review"}
          </Button>
        </div>
      </GlassCard>

      {/* Comments List */}
      <div className="space-y-4">
        {sortedComments.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No comments yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to share your thoughts about {animeTitle}
            </p>
          </GlassCard>
        ) : (
          sortedComments.map((comment) => (
            <GlassCard key={comment.id} className="p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{comment.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(comment.timestamp)}
                    </span>
                  </div>

                  {/* Rating */}
                  {comment.rating && (
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < comment.rating!
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-white/20"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Comment Content */}
                  <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      onClick={() => handleLike(comment.id)}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        likedComments.has(comment.id)
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${likedComments.has(comment.id) ? "fill-primary" : ""}`} />
                      <span>{comment.likes}</span>
                    </button>
                    <button
                      onClick={() => handleDislike(comment.id)}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        dislikedComments.has(comment.id)
                          ? "text-red-400 font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ThumbsDown className={`w-4 h-4 ${dislikedComments.has(comment.id) ? "fill-red-400" : ""}`} />
                      <span>{comment.dislikes}</span>
                    </button>
                    <button
                      onClick={() => handleReply(comment.id)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </button>
                  </div>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4 pl-4 border-l border-white/10 space-y-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-2 text-sm">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{reply.user.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatTime(reply.timestamp)}
                            </span>
                            <p className="mt-1 whitespace-pre-wrap">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
