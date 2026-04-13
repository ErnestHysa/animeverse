/**
 * Subtitle Proxy API
 * Proxies subtitle file requests to avoid CORS/403 errors from external servers
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSRF protection: check if a URL targets a private/reserved IP or localhost
 */
function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }

    // Block private IPv4 ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const octets = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
      if (octets[0] === 10) return false;
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      if (octets[0] === 192 && octets[1] === 168) return false;
      if (octets[0] === 169 && octets[1] === 254) return false;
      if (octets[0] === 127) return false;
    }

    // Block IPv6 private ranges (simplified check)
    if (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get allowed origin for CORS headers
 */
function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || "";
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (originHost === "localhost" || originHost === "127.0.0.1" || originHost.endsWith(".animeverse.app") || originHost === host.split(":")[0]) {
        return origin;
      }
    } catch {}
  }
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

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

    // SSRF protection: block private IPs and localhost
    if (!isUrlAllowed(subtitleUrl)) {
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
