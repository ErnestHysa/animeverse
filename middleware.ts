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

// Cleanup old entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60 * 1000);
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
];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; rule?: RateLimitRule } {
  for (const rule of RATE_LIMIT_RULES) {
    if (pathname.startsWith(rule.pathPrefix)) {
      const key = `${ip}:${rule.pathPrefix}`;
      const now = Date.now();
      const entry = rateLimitStore.get(key);

      if (!entry || now > entry.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + rule.windowMs });
        return { allowed: true, rule };
      }

      if (entry.count >= rule.maxRequests) {
        return { allowed: false, rule };
      }

      entry.count++;
      return { allowed: true, rule };
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
      if (
        originHost === 'localhost' ||
        originHost === '127.0.0.1' ||
        originHost.endsWith('.animeverse.app') ||
        originHost === host.split(':')[0]
      ) {
        return origin;
      }
    } catch {}
  }
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
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
    const { allowed, rule } = checkRateLimit(ip, pathname);

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
