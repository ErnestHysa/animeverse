/**
 * HLS Proxy API
 * Proxies HLS manifest and segment requests to avoid CORS/403 errors from external servers
 *
 * This enables streaming from servers that block direct browser requests (like vault-16.owocdn.top)
 * by routing all requests through the Next.js server which isn't subject to CORS restrictions.
 */

import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { isProxyAuthenticated } from "@/lib/auth";
import { isUrlAllowed, buildCorsHeaders } from "@/lib/ssrf-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MANIFEST_SIZE = 10 * 1024 * 1024; // 10MB for manifests
const MAX_SEGMENT_SIZE = 50 * 1024 * 1024; // 50MB for individual segments
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB for full video files
const TIMEOUT_MS = 60000; // CRITICAL: Increased from 30s to 60s for slow upstream servers (segments take ~10s each)
const MANIFEST_TIMEOUT_MS = 60000; // CRITICAL: 60s timeout for manifest loading

/**
 * GET /api/proxy-hls?url=<encoded_url>&type=<manifest|segment|video>&referer=<optional_referer>
 * Proxies video content requests to bypass CORS and hotlink protection
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check: require valid JWT (no referer bypass)
    if (!(await isProxyAuthenticated(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get("url");
    const type = searchParams.get("type") || "manifest";
    const customReferer = searchParams.get("referer");

    if (!encodedUrl) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    const targetUrl = decodeURIComponent(encodedUrl);

    // SSRF protection: block private IPs and localhost (with DNS resolution)
    if (!(await isUrlAllowed(targetUrl))) {
      return NextResponse.json(
        { error: "URL not allowed: private/internal addresses are blocked" },
        { status: 403 }
      );
    }

    // Validate URL and determine referer
    let refererOrigin = "";
    let refererHeader = "";
    let contentType = "application/vnd.apple.mpegurl";

    try {
      const parsedUrl = new URL(targetUrl);
      refererOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;

      // Use custom referer if provided, otherwise use the origin
      if (customReferer) {
        refererHeader = decodeURIComponent(customReferer);
      } else {
        refererHeader = refererOrigin;
      }

      // Only allow http/https protocols
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { error: "Invalid URL protocol" },
          { status: 400 }
        );
      }

      // Determine content type based on file extension
      const pathname = parsedUrl.pathname.toLowerCase();
      if (pathname.endsWith(".m3u8") || pathname.includes("m3u8")) {
        contentType = "application/vnd.apple.mpegurl; charset=utf-8";
      } else if (pathname.endsWith(".ts") || pathname.includes(".ts")) {
        contentType = "video/mp2t";
      } else if (pathname.endsWith(".m4s") || pathname.includes(".m4s")) {
        contentType = "video/mp4";
      } else if (pathname.endsWith(".mp4")) {
        contentType = "video/mp4";
      } else if (pathname.endsWith(".key") || pathname.includes(".key")) {
        // DRM encryption key files
        contentType = "application/octet-stream";
      } else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg") || pathname.includes(".jpg")) {
        // Thumbnail/preview images in HLS streams
        contentType = "image/jpeg";
      } else if (pathname.endsWith(".png") || pathname.includes(".png")) {
        // Thumbnail/preview images in HLS streams
        contentType = "image/png";
      } else if (pathname.endsWith(".webp") || pathname.includes(".webp")) {
        // Thumbnail/preview images in HLS streams
        contentType = "image/webp";
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Set timeout based on content type
    const timeout = type === "segment" || type === "video" ? TIMEOUT_MS : MANIFEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Fetch with proper headers to mimic browser
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": refererHeader,
        "Origin": refererOrigin,
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error(`HLS proxy error: ${response.status} ${response.statusText} for ${targetUrl}`);
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Check content length for segments (skip for video files to allow streaming)
    const contentLength = response.headers.get("content-length");
    const maxSize = type === "video" ? MAX_VIDEO_SIZE : (type === "segment" ? MAX_SEGMENT_SIZE : MAX_MANIFEST_SIZE);

    if (contentLength && parseInt(contentLength) > maxSize) {
      return NextResponse.json(
        { error: `Content too large (${contentLength} bytes)` },
        { status: 400 }
      );
    }

    // For manifests, rewrite ALL URLs to go through the proxy
    // This is essential for Safari's native HLS which doesn't use hls.js
    if (type === "manifest" && contentType.includes("mpegurl")) {
      const manifestText = await response.text();

      if (manifestText.length > MAX_MANIFEST_SIZE) {
        return NextResponse.json(
          { error: "Manifest too large" },
          { status: 400 }
        );
      }

      // Rewrite ALL URLs (both relative and absolute) to go through proxy
      let rewrittenManifest = manifestText;
      try {
        const baseUrl = new URL(targetUrl);
        const baseUrlString = baseUrl.origin + baseUrl.pathname.replace(/[^/]+$/, "");

        // Get the proxy base URL (relative to work on both localhost and production)
        // Use the Host header to get the correct host from the browser's perspective
        const requestUrl = new URL(request.url);
        const hostHeader = request.headers.get("host") || requestUrl.host;
        const proxyBaseUrl = `${requestUrl.protocol}//${hostHeader}/api/proxy-hls`;

        // Helper function to rewrite a URL to go through the proxy
        // urlType controls whether the proxy rewrites URLs inside the response ("manifest") or streams it ("segment")
        const rewriteUrl = (urlMatch: string, urlType: string = "segment"): string => {
          // Skip comments and empty lines
          if (urlMatch.startsWith("#") || !urlMatch.trim()) {
            return urlMatch;
          }

          // Skip if already a proxy URL
          if (urlMatch.includes("/api/proxy-hls")) {
            return urlMatch;
          }

          // Convert relative URLs to absolute first
          let absoluteUrl = urlMatch;
          if (!urlMatch.startsWith("http://") && !urlMatch.startsWith("https://")) {
            if (urlMatch.startsWith("/")) {
              // Root-relative URL (e.g. /segments/001.ts) - prepend origin only
              absoluteUrl = baseUrl.origin + urlMatch;
            } else {
              // Path-relative URL (e.g. segment001.ts) - prepend base path
              absoluteUrl = baseUrlString + urlMatch;
            }
          }

          // Build proxy URL with referer if available
          // NOTE: pass the full URL (including any query params) encoded in the `url` param
          let proxyUrl = `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}&type=${urlType}`;
          if (customReferer) {
            proxyUrl += `&referer=${encodeURIComponent(customReferer)}`;
          }
          return proxyUrl;
        };

        // Step 1: Rewrite URI attributes in #EXT-X-KEY tags (DRM encryption keys)
        // This is CRITICAL for encrypted streams! Key files are specified as:
        // #EXT-X-KEY:METHOD=AES-128,URI="mon.key",IV=0x...
        rewrittenManifest = manifestText.replace(
          /(#EXT-X-KEY[^]*URI=)("([^"]+)"|'([^']+)')/gi,
          (match, quote, uriWithSingleQuote, uriWithDoubleQuote) => {
            const uri = uriWithSingleQuote || uriWithDoubleQuote;
            const rewritten = rewriteUrl(uri);
            logger.log(`[HLS Proxy] Rewrote key URI: ${uri} -> ${rewritten}`);
            return `#EXT-X-KEY${match.split(/URI=/)[0]}URI="${rewritten}"`;
          }
        );

        // Step 2: Rewrite segment URLs (.ts, .m4s, .mp4, .key) and sub-manifests (.m3u8)
        rewrittenManifest = rewrittenManifest
          .split("\n")
          .map(line => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith("#") || !trimmed) {
              return line;
            }

            // Check for .m3u8 sub-manifests first - proxy as "manifest" so their
            // internal segment URLs also get rewritten (prevents CORS failures)
            if (trimmed.endsWith(".m3u8") || trimmed.includes(".m3u8?")) {
              return rewriteUrl(trimmed, "manifest");
            }

            // Check if this line is a segment URL or key file
            // CRITICAL: Must include .key files for DRM-encrypted streams!
            // CRITICAL: Must include image files (.jpg, .png, .webp) for thumbnail segments!
            // Pass the full line (including any query-string tokens) so they're
            // encoded inside the proxy `url` param, not appended after it.
            const segmentPattern = /(\.ts|\.m4s|\.mp4|\.key|\.jpg|\.jpeg|\.png|\.webp)(\?|$)/;
            if (segmentPattern.test(trimmed)) {
              return rewriteUrl(trimmed);
            }

            return line;
          })
          .join("\n");
      } catch (e) {
        // If URL rewriting fails, return original manifest
        logger.error("Failed to rewrite manifest URLs:", e);
      }

      return new NextResponse(rewrittenManifest, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          ...buildCorsHeaders(request, 'GET, OPTIONS', 'Range, Content-Type'),
          "Cache-Control": "public, max-age=300", // 5 minutes for manifests
        },
      });
    }

    // For segments and videos, stream the response
    const contentLengthHeader = response.headers.get("content-length");
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      ...buildCorsHeaders(request, 'GET, OPTIONS', 'Range, Content-Type'),
      "Cache-Control": type === "video" ? "public, max-age=3600" : "public, max-age=86400", // 1 hour for videos, 24 hours for segments
      "Accept-Ranges": "bytes",
    };

    if (contentLengthHeader) {
      headers["Content-Length"] = contentLengthHeader;
    }

    // Log segment requests for debugging
    if (type === "segment") {
      logger.log(`[HLS Proxy] Segment: ${targetUrl.substring(0, 70)}... Size: ${contentLengthHeader || 'unknown'}`);
    }

    // Handle Range requests for seeking (supports both segments and videos)
    const rangeHeader = request.headers.get("range");
    if (rangeHeader && (type === "segment" || type === "video")) {
      const range = response.headers.get("content-range");
      if (range) {
        headers["Content-Range"] = range;
        logger.log(`[HLS Proxy] Range request: ${rangeHeader} -> ${range}`);
        return new NextResponse(response.body, {
          status: 206, // Partial Content
          headers,
        });
      }
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout" },
        { status: 504 }
      );
    }

    logger.error("HLS proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...buildCorsHeaders(request, 'GET, OPTIONS', 'Range, Content-Type'),
    },
  });
}
