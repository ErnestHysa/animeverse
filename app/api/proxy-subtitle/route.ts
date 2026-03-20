/**
 * Subtitle Proxy API
 * Proxies subtitle file requests to avoid CORS/403 errors from external servers
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max for subtitle files
const TIMEOUT_MS = 10000; // 10 second timeout

/**
 * GET /api/proxy-subtitle?url=<encoded_url>
 * Proxies subtitle file requests to bypass CORS and hotlink protection
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get("url");

    if (!encodedUrl) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    const subtitleUrl = decodeURIComponent(encodedUrl);

    // Validate URL
    let refererOrigin = "";
    try {
      const parsedUrl = new URL(subtitleUrl);
      refererOrigin = parsedUrl.origin;
      // Only allow http/https protocols
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { error: "Invalid URL protocol" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Fetch subtitle file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(subtitleUrl, {
      headers: {
        // Common browser headers to avoid blocking
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": refererOrigin,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch subtitle: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Check file size
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Subtitle file too large" },
        { status: 400 }
      );
    }

    // Get subtitle content
    const content = await response.text();

    // Limit content size
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Subtitle file too large" },
        { status: 400 }
      );
    }

    // Return subtitle content with proper headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout" },
        { status: 504 }
      );
    }

    console.error("Subtitle proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
