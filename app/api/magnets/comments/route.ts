/**
 * Magnet Comments API Endpoint
 *
 * Phase 10: Community Feedback System
 * POST /api/magnets/comments - Submit a comment
 * GET /api/magnets/comments?magnetHash=xxx - Get comments for a magnet
 * PUT /api/magnets/comments/:id - Update a comment
 * DELETE /api/magnets/comments/:id - Delete a comment
 */

import { NextRequest, NextResponse } from "next/server";
import type { MagnetComment } from "@/types/magnet-ratings";

// In-memory storage (replace with database in production)
const commentsStore: Map<string, MagnetComment[]> = new Map();

/**
 * POST /api/magnets/comments
 * Submit a comment for a magnet source
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { magnetHash, animeId, episodeNumber, userId, username, comment } = body;

    // Validation
    if (!magnetHash || !animeId || !episodeNumber || !userId || !comment) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (comment.length > 1000) {
      return NextResponse.json({ error: "Comment too long (max 1000 characters)" }, { status: 400 });
    }

    // Create new comment
    const newComment: MagnetComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      magnetHash,
      animeId,
      episodeNumber,
      userId,
      username: username || "Anonymous",
      comment,
      isFlagged: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store comment
    if (!commentsStore.has(magnetHash)) {
      commentsStore.set(magnetHash, []);
    }
    commentsStore.get(magnetHash)!.push(newComment);

    return NextResponse.json({ comment: newComment, message: "Comment submitted" }, { status: 201 });
  } catch (error) {
    console.error("[MagnetCommentsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/magnets/comments
 * Get comments for a magnet source
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const magnetHash = searchParams.get("magnetHash");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!magnetHash) {
      return NextResponse.json({ error: "magnetHash parameter is required" }, { status: 400 });
    }

    const comments = commentsStore.get(magnetHash) || [];

    // Filter out flagged comments (unless user is admin)
    const visibleComments = comments.filter((c) => !c.isFlagged);

    // Sort by date (newest first)
    visibleComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const paginatedComments = visibleComments.slice(offset, offset + limit);

    return NextResponse.json({
      magnetHash,
      comments: paginatedComments,
      total: visibleComments.length,
      hasMore: offset + limit < visibleComments.length,
    });
  } catch (error) {
    console.error("[MagnetCommentsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/magnets/comments
 * Update a comment (uses query parameters instead of dynamic route)
 */
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const body = await request.json();
    const { comment, userId } = body;

    if (!id || !comment || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (comment.length > 1000) {
      return NextResponse.json({ error: "Comment too long (max 1000 characters)" }, { status: 400 });
    }

    // Find comment
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [magnetHash, comments] of commentsStore.entries()) {
      const commentIndex = comments.findIndex((c) => c.id === id);

      if (commentIndex !== -1) {
        const existingComment = comments[commentIndex];

        // Check ownership
        if (existingComment.userId !== userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Update comment
        existingComment.comment = comment;
        existingComment.updatedAt = new Date().toISOString();

        return NextResponse.json({ comment: existingComment, message: "Comment updated" });
      }
    }

    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  } catch (error) {
    console.error("[MagnetCommentsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/magnets/comments
 * Delete a comment (uses query parameters instead of dynamic route)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Find and delete comment
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [magnetHash, comments] of commentsStore.entries()) {
      const commentIndex = comments.findIndex((c) => c.id === id);

      if (commentIndex !== -1) {
        const existingComment = comments[commentIndex];

        // Check ownership
        if (existingComment.userId !== userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        comments.splice(commentIndex, 1);

        return NextResponse.json({ message: "Comment deleted" });
      }
    }

    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  } catch (error) {
    console.error("[MagnetCommentsAPI] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
