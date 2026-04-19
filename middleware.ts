/**
 * Next.js Middleware
 * Centralized request filtering, rate limiting, CORS, and security checks
 */

import { NextRequest, NextResponse } from 'next/server';

// ===================================
// Rate Limiter (in-memory, keyed by IP)
// ===================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60 seconds and cap map size
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    // Fix M1: Cap map size — if over 10000, delete oldest entries
    if (rateLimitStore.size > 10000) {
      const entriesToDelete = rateLimitStore.size - 10000;
      let deleted = 0;
      for (const key of rateLimitStore.keys()) {
        if (deleted >= entriesToDelete) break;
        rateLimitStore.delete(key);
        deleted++;
      }
    }
  }, 60 * 1000).unref();
}

interface RateLimitRule {
  pathPrefix: string;
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { pathPrefix: '/api/proxy', maxRequests: 20, windowMs: 60 * 1000 },
  { pathPrefix: '/api/community', maxRequests: 30, windowMs: 60 * 1000 },
  { pathPrefix: '/api/analytics', maxRequests: 60, windowMs: 60 * 1000 },
  { pathPrefix: '/api/admin/login', maxRequests: 10, windowMs: 60 * 1000 },
  { pathPrefix: '/api/search-suggestions', maxRequests: 30, windowMs: 60 * 1000 },
  // Fix H7: Rate limit rules for previously unprotected routes
  { pathPrefix: '/api/magnets', maxRequests: 30, windowMs: 60 * 1000 },
  { pathPrefix: '/api/scrape', maxRequests: 10, windowMs: 60 * 1000 },
  { pathPrefix: '/api/download-hls', maxRequests: 5, windowMs: 60 * 1000 },
  { pathPrefix: '/api/video-sources', maxRequests: 30, windowMs: 60 * 1000 },
  { pathPrefix: '/api/torrent-sources', maxRequests: 30, windowMs: 60 * 1000 },
];

function getClientIp(request: NextRequest): string {
  // Fix M9: Only trust the first (leftmost) IP in x-forwarded-for, as that's the client.
  // NOTE: In production, this should be configured with trusted proxy IPs to prevent spoofing.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  return (
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; rule?: RateLimitRule; remaining?: number; resetTime?: number } {
  for (const rule of RATE_LIMIT_RULES) {
    if (pathname.startsWith(rule.pathPrefix)) {
      const key = `${ip}:${rule.pathPrefix}`;
      const now = Date.now();
      const entry = rateLimitStore.get(key);

      if (!entry || now > entry.resetTime) {
        const resetTime = now + rule.windowMs;
        rateLimitStore.set(key, { count: 1, resetTime });
        return { allowed: true, rule, remaining: rule.maxRequests - 1, resetTime };
      }

      if (entry.count >= rule.maxRequests) {
        return { allowed: false, rule, remaining: 0, resetTime: entry.resetTime };
      }

      entry.count++;
      return { allowed: true, rule, remaining: rule.maxRequests - entry.count, resetTime: entry.resetTime };
    }
  }
  return { allowed: true };
}

// ===================================
// CORS for API routes
// ===================================

function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || '';
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const isDev = process.env.NODE_ENV !== 'production';
      const isProductionOrigin =
        originHost.endsWith('.animeverse.app') ||
        originHost === host.split(':')[0];
      const isDevLocalhost =
        isDev && (originHost === 'localhost' || originHost === '127.0.0.1');

      if (isDevLocalhost || isProductionOrigin) {
        return origin;
      }
    } catch (error) {
      // Fix M9: Log CORS validation errors instead of silently swallowing
      console.warn('CORS origin validation failed:', error);
    }
  }
  // Fix M8: Validate host against allowlist instead of blindly reflecting
  const allowedHosts = [process.env.NEXT_PUBLIC_APP_URL, 'localhost:3000'].filter(Boolean);
  const hostName = host.split(':')[0];
  if (allowedHosts.some(h => hostName === new URL(h!.startsWith('http') ? h! : `https://${h}`).hostname)) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${host}`;
  }
  return '';
}

// ===================================
// Middleware
// ===================================

const MAX_URL_LENGTH = 2048;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, _next, images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ttf') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  // Block malicious requests: no User-Agent
  const userAgent = request.headers.get('user-agent');
  if (!userAgent || userAgent.trim() === '') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Block extremely long URLs
  if (request.url.length > MAX_URL_LENGTH) {
    return new NextResponse('URL Too Long', { status: 414 });
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request);
    const { allowed, rule, remaining, resetTime } = checkRateLimit(ip, pathname);

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rule!.windowMs / 1000))),
          },
        }
      );
    }

    // Add CORS headers for API routes
    const response = NextResponse.next();
    const corsOrigin = getCorsOrigin(request);
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // Fix M5: Add rate limit headers to help clients adapt behavior
    if (rule) {
      response.headers.set('X-RateLimit-Limit', String(rule.maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(remaining ?? 0));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil((resetTime ?? 0) / 1000)));
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     */
    '/((?!_next/static|_next/image).*)',
  ],
};
