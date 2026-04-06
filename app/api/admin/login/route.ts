/**
 * Admin Login API Route
 * POST /api/admin/login - Authenticate admin user
 *
 * Phase 11: Production Deployment - Security Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import {
  authenticateUser,
  isUsernameLocked,
  recordFailedLogin,
  clearLoginAttempts,
  getRemainingAttempts,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  remainingAttempts?: number;
}

/**
 * POST handler for admin login
 */
export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequestBody = await request.json();
    const { username, password, remember = false } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check for rate limiting
    if (isUsernameLocked(username)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many failed login attempts. Please try again later.',
          remainingAttempts: 0,
        },
        { status: 429 }
      );
    }

    // Attempt authentication
    const result = await authenticateUser({ username, password });

    if (!result.success) {
      // Record failed attempt
      recordFailedLogin(username);
      const remaining = getRemainingAttempts(username);

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Authentication failed',
          remainingAttempts: remaining,
        },
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    clearLoginAttempts(username);

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

    // Set refresh token cookie
    response.cookies.set('refresh_token', result.tokens!.refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });

  // Clear auth cookies
  response.cookies.delete('auth_token');
  response.cookies.delete('refresh_token');

  return response;
}
