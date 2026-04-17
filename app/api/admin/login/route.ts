/**
 * Admin Login API Route
 * POST /api/admin/login - Authenticate admin user
 *
 * Phase 11: Production Deployment - Security Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  isUsernameLocked,
  recordFailedLogin,
  clearLoginAttempts,
  verifyToken,
  blacklistToken,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// IP-based rate limiting
// TODO (M11): In-memory rate limiting resets on server restart. For production,
// migrate to Redis-backed rate limiting so limits persist across restarts.
const ipLoginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION = 60 * 1000; // 1 minute

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of ipLoginAttempts.entries()) {
    if (now > attempts.resetTime) {
      ipLoginAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

function isIpLocked(ip: string): boolean {
  const attempts = ipLoginAttempts.get(ip);
  if (!attempts) return false;
  if (Date.now() > attempts.resetTime) {
    ipLoginAttempts.delete(ip);
    return false;
  }
  return attempts.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedIpLogin(ip: string): void {
  const attempts = ipLoginAttempts.get(ip);
  if (!attempts) {
    ipLoginAttempts.set(ip, { count: 1, resetTime: Date.now() + LOCKOUT_DURATION });
  } else if (Date.now() < attempts.resetTime) {
    attempts.count++;
  } else {
    ipLoginAttempts.set(ip, { count: 1, resetTime: Date.now() + LOCKOUT_DURATION });
  }
}

function clearIpAttempts(ip: string): void {
  ipLoginAttempts.delete(ip);
}

interface LoginRequestBody {
  username: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    createdAt: number;
    lastLogin?: number;
  };
}

/**
 * POST handler for admin login
 */
export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    // Body size check
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 1048576) {
      return NextResponse.json(
        { success: false, error: 'Request too large' },
        { status: 413 }
      );
    }

    const body: LoginRequestBody = await request.json();
    const { username, password, remember = false } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    // Check IP-based rate limiting
    if (isIpLocked(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many failed login attempts from your IP. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Check username-based rate limiting
    if (isUsernameLocked(username)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many failed login attempts. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Attempt authentication
    const result = await authenticateUser({ username, password });

    if (!result.success) {
      // Record failed attempt for both username and IP
      recordFailedLogin(username);
      recordFailedIpLogin(clientIp);

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Invalid credentials',
        },
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    clearLoginAttempts(username);
    clearIpAttempts(clientIp);

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: result.user,
    });

    // Set auth cookie
    const maxAge = remember ? 7 * 24 * 60 * 60 : 60 * 60; // 7 days or 1 hour
    response.cookies.set('auth_token', result.tokens!.access, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Check if currently authenticated
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { getAuthenticatedUser } = await import('@/lib/auth');
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('[Admin Login] GET error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - Logout
 * Fix H10: Blacklists the JWT token so it cannot be reused after logout
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // Fix H10: Extract and blacklist the token before clearing cookie
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    try {
      const { cookies: getCookies } = await import('next/headers');
      const cookieStore = await getCookies();
      token = cookieStore.get('auth_token')?.value || null;
    } catch {
      // Cookie not available
    }
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload?.jti && payload.exp) {
      blacklistToken(payload.jti, payload.exp);
    }
  }

  const response = NextResponse.json({ success: true });

  // Clear auth cookies
  response.cookies.delete('auth_token');

  return response;
}
