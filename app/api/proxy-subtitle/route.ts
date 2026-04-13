/**
 * Subtitle Proxy API
 * Proxies subtitle file requests to avoid CORS/403 errors from external servers
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { isUrlAllowedSync, getAllowedOrigin } from "@/lib/ssrf-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max for subtitle files
const TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Auth check: require valid JWT OR valid referer from app's own domain
 */
async function isProxyAuthenticated(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const token = extractTokenFromHeader(authHeader);
  if (token) {
    const payload = verifyToken(token);
    if (payload) return true;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).hostname;
      const host = request.headers.get("host")?.split(":")[0] || "";
      if (
        refererHost === "localhost" ||
        refererHost === "127.0.0.1" ||
        refererHost.endsWith(".animeverse.app") ||
        refererHost === host
      ) {
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * GET /api/proxy-subtitle?url=<encoded_url>
 * Proxies subtitle file requests to bypass CORS and hotlink protection
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check: require valid JWT or app-domain referer
    if (!(await isProxyAuthenticated(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get("url");

    if (!encodedUrl) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    const subtitleUrl = decodeURIComponent(encodedUrl);

    // SSRF protection: block private IPs and localhost
    if (!isUrlAllowedSync(subtitleUrl)) {
      return NextResponse.json(
        { error: "URL not allowed: private/internal addresses are blocked" },
        { status: 403 }
      );
    }

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
        "Access-Control-Allow-Origin": getAllowedOrigin(request),
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
