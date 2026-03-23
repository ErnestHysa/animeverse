/**
 * HLS Proxy API
 * Proxies HLS manifest and segment requests to avoid CORS/403 errors from external servers
 *
 * This enables streaming from servers that block direct browser requests (like vault-16.owocdn.top)
 * by routing all requests through the Next.js server which isn't subject to CORS restrictions.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_MANIFEST_SIZE = 10 * 1024 * 1024; // 10MB for manifests
const MAX_SEGMENT_SIZE = 50 * 1024 * 1024; // 50MB for individual segments
const TIMEOUT_MS = 30000; // 30 second timeout for video segments

/**
 * GET /api/proxy-hls?url=<encoded_url>&type=<manifest|segment>
 * Proxies HLS content requests to bypass CORS and hotlink protection
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get("url");
    const type = searchParams.get("type") || "manifest";

    if (!encodedUrl) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    const targetUrl = decodeURIComponent(encodedUrl);

    // Validate URL
    let refererOrigin = "";
    let contentType = "application/vnd.apple.mpegurl";

    try {
      const parsedUrl = new URL(targetUrl);
      refererOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;

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
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Set timeout based on content type
    const timeout = type === "segment" ? TIMEOUT_MS : 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Fetch with proper headers to mimic browser
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": refererOrigin,
        "Origin": refererOrigin,
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`HLS proxy error: ${response.status} ${response.statusText} for ${targetUrl}`);
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Check content length for segments
    const contentLength = response.headers.get("content-length");
    const maxSize = type === "segment" ? MAX_SEGMENT_SIZE : MAX_MANIFEST_SIZE;

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
        const requestUrl = new URL(request.url);
        const proxyBaseUrl = `${requestUrl.protocol}//${requestUrl.host}/api/proxy-hls`;

        // Helper function to rewrite a URL to go through the proxy
        const rewriteUrl = (urlMatch: string): string => {
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
            // Relative URL - make it absolute
            absoluteUrl = baseUrlString + urlMatch;
          }

          // Now encode and route through proxy
          return `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}&type=segment`;
        };

        // Rewrite segment URLs (.ts, .m4s, .mp4)
        rewrittenManifest = manifestText
          .split("\n")
          .map(line => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith("#") || !trimmed) {
              return line;
            }

            // Check if this line is a segment URL
            if (
              trimmed.endsWith(".ts") ||
              trimmed.endsWith(".m4s") ||
              trimmed.endsWith(".mp4") ||
              trimmed.includes(".ts?") ||
              trimmed.includes(".m4s?") ||
              trimmed.includes(".mp4?")
            ) {
              // Extract the URL part (in case there are params after)
              const urlMatch = trimmed.split("?")[0];
              const params = trimmed.includes("?") ? "?" + trimmed.split("?")[1] : "";
              return rewriteUrl(urlMatch) + params;
            }

            // Check for .m3u8 (sub-manifests) - also proxy these
            if (
              trimmed.endsWith(".m3u8") ||
              trimmed.includes(".m3u8?")
            ) {
              const urlMatch = trimmed.split("?")[0];
              const params = trimmed.includes("?") ? "?" + trimmed.split("?")[1] : "";
              return rewriteUrl(urlMatch) + params;
            }

            return line;
          })
          .join("\n");
      } catch (e) {
        // If URL rewriting fails, return original manifest
        console.error("Failed to rewrite manifest URLs:", e);
      }

      return new NextResponse(rewrittenManifest, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
          "Cache-Control": "public, max-age=300", // 5 minutes for manifests
        },
      });
    }

    // For segments, stream the response
    const contentLengthHeader = response.headers.get("content-length");
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Cache-Control": "public, max-age=86400", // 24 hours for segments
      "Accept-Ranges": "bytes",
    };

    if (contentLengthHeader) {
      headers["Content-Length"] = contentLengthHeader;
    }

    // Handle Range requests for seeking
    const rangeHeader = request.headers.get("range");
    if (rangeHeader && type === "segment") {
      const range = response.headers.get("content-range");
      if (range) {
        headers["Content-Range"] = range;
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

    console.error("HLS proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}
