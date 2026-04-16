/**
 * Authentication Library
 * Handles JWT tokens, password hashing, and user authentication
 *
 * Phase 11: Production Deployment - Security Implementation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// ===================================
// Types
// ===================================

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'superadmin';
  createdAt: number;
  lastLogin?: number;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: string;
  jti?: string;      // Fix H10: JWT ID for token blacklisting
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// ===================================
// Configuration
// ===================================

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in .env');
}
const JWT_EXPIRES_IN = '1h'; // Access token expires in 1 hour
const BCRYPT_ROUNDS = 12;

// ===================================
// Fix H10: Token Blacklist
// ===================================

// In-memory set of blacklisted JWT IDs (jti claims)
const blacklistedTokens = new Map<string, number>(); // jti -> expiration timestamp

/**
 * Blacklist a token by its jti claim so it can no longer be used.
 * The token remains blacklisted until its original expiration time passes.
 */
export function blacklistToken(jti: string, exp: number): void {
  if (!jti) return;
  blacklistedTokens.set(jti, exp);
}

/**
 * Check if a token's jti is in the blacklist.
 */
export function isTokenBlacklisted(jti: string | undefined): boolean {
  if (!jti) return false;
  return blacklistedTokens.has(jti);
}

/**
 * Periodic cleanup: remove expired tokens from the blacklist every 10 minutes.
 * This prevents unbounded memory growth since tokens naturally expire.
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now() / 1000;
    let cleaned = 0;
    for (const [jti, exp] of blacklistedTokens) {
      if (exp < now) {
        blacklistedTokens.delete(jti);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[Auth] Cleaned ${cleaned} expired tokens from blacklist (remaining: ${blacklistedTokens.size})`);
    }
  }, 10 * 60 * 1000).unref?.(); // .unref() so the timer doesn't keep the process alive
}

// ===================================
// Token Management
// ===================================

/**
 * Generate JWT access token
 * Fix H10: Includes jti (JWT ID) for token blacklisting on logout
 */
export function generateAccessToken(user: AdminUser): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    jti: randomUUID(),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify JWT token
 * Fix H10: Also checks the token blacklist
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    // Fix H10: Reject blacklisted tokens
    if (isTokenBlacklisted(decoded.jti)) {
      console.warn('[Auth] Rejected blacklisted token:', decoded.jti);
      return null;
    }
    return decoded;
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

/**
 * Get token from cookie
 */
export async function getTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('auth_token')?.value || null;
  } catch {
    return null;
  }
}

// ===================================
// Password Management
// ===================================

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===================================
// User Management
// ===================================

// Note: In production, use PostgreSQL database via ADMIN_USERS table
// For development/testing, in-memory storage is used
// See docs/DEPLOYMENT_GUIDE.md for production database setup
const ADMIN_USERS: Map<string, AdminUser & { passwordHash: string }> = new Map();

// Initialize default admin user if not exists
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME!;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD!;
if (!DEFAULT_ADMIN_USERNAME || !DEFAULT_ADMIN_PASSWORD) {
  throw new Error('DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD environment variables are required. Set them in .env');
}

/**
 * Initialize default admin user
 */
export async function initializeDefaultAdmin(): Promise<void> {
  if (ADMIN_USERS.size === 0) {
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    ADMIN_USERS.set(DEFAULT_ADMIN_USERNAME, {
      id: 'admin-1',
      username: DEFAULT_ADMIN_USERNAME,
      email: 'admin@animeverse.local',
      role: 'superadmin',
      passwordHash,
      createdAt: Date.now(),
    });
    console.log('[Auth] Default admin user initialized');
  }
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): (AdminUser & { passwordHash: string }) | undefined {
  return ADMIN_USERS.get(username);
}

/**
 * Create new admin user
 */
export async function createAdminUser(
  username: string,
  email: string,
  password: string,
  role: 'admin' | 'superadmin' = 'admin'
): Promise<{ success: boolean; error?: string; user?: AdminUser }> {
  // Check if user already exists
  if (ADMIN_USERS.has(username)) {
    return { success: false, error: 'Username already exists' };
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.errors.join(', ') };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user: AdminUser & { passwordHash: string } = {
    id: `admin-${Date.now()}`,
    username,
    email,
    role,
    passwordHash,
    createdAt: Date.now(),
  };

  ADMIN_USERS.set(username, user);

  // Return user without password hash
  const { passwordHash: _, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword };
}

/**
 * Authenticate user with credentials
 * Fix H9: Constant-time comparison — always calls bcrypt.compare to prevent
 * username enumeration via timing side-channel attacks.
 */
export async function authenticateUser(
  credentials: LoginCredentials
): Promise<{ success: boolean; error?: string; user?: AdminUser; tokens?: { access: string } }> {
  const { username, password } = credentials;

  // Fix H9: Dummy hash ensures bcrypt.compare always runs, even when user doesn't exist
  const DUMMY_HASH = '$2b$12$abcdefghijklmnopqrstuvwxymnoABCDEFGHIJ1234567890abcdefghijklm';

  // Get user (may be undefined)
  const userRecord = getUserByUsername(username);
  const hashToCompare = userRecord ? userRecord.passwordHash : DUMMY_HASH;

  // Always compare — takes ~100ms regardless of whether user exists
  const passwordValid = await bcrypt.compare(password, hashToCompare);

  if (!userRecord || !passwordValid) {
    return { success: false, error: 'Invalid username or password' };
  }

  // Update last login
  userRecord.lastLogin = Date.now();

  // Generate tokens
  const user: AdminUser = {
    id: userRecord.id,
    username: userRecord.username,
    email: userRecord.email,
    role: userRecord.role,
    createdAt: userRecord.createdAt,
    lastLogin: userRecord.lastLogin,
  };

  const accessToken = generateAccessToken(user);

  return {
    success: true,
    user,
    tokens: {
      access: accessToken,
    },
  };
}

// ===================================
// Middleware Helpers
// ===================================

/**
 * Check if request is from authenticated admin
 * Supports both Bearer token and cookie-based auth
 */
export async function isAdminRequest(request: Request): Promise<boolean> {
  // First try Authorization header
  const authHeader = request.headers.get('authorization');
  let token = extractTokenFromHeader(authHeader);

  // Fall back to cookie
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value || null;
    } catch {
      return false;
    }
  }

  if (!token) return false;

  const payload = verifyToken(token);
  if (!payload) return false;

  // Verify user exists in the admin store
  const userRecord = getUserByUsername(payload.username);
  if (!userRecord) return false;

  // Check if user has admin role
  return payload.role === 'admin' || payload.role === 'superadmin';
}

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(request: Request): Promise<AdminUser | null> {
  // First try Authorization header
  const authHeader = request.headers.get('authorization');
  let token = extractTokenFromHeader(authHeader);

  // Fall back to cookie
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value || null;
    } catch {
      return null;
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const userRecord = getUserByUsername(payload.username);
  if (!userRecord) return null;

  return {
    id: userRecord.id,
    username: userRecord.username,
    email: userRecord.email,
    role: userRecord.role,
    createdAt: userRecord.createdAt,
    lastLogin: userRecord.lastLogin,
  };
}

/**
 * Require superadmin role
 * Fix L2: Also verify user still exists in the admin store
 */
export async function isSuperAdminRequest(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  let token = extractTokenFromHeader(authHeader);

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value || null;
    } catch {
      return false;
    }
  }

  if (!token) return false;

  const payload = verifyToken(token);
  if (!payload) return false;

  // Verify user still exists in the admin store (same pattern as isAdminRequest)
  const userRecord = getUserByUsername(payload.username);
  if (!userRecord) return false;

  return payload.role === 'superadmin';
}

/**
 * Proxy authentication check: require valid JWT only (no referer fallback)
 * Fix C1 + H2: Removed referer-based auth bypass
 */
export async function isProxyAuthenticated(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  if (!token) return false;

  const payload = verifyToken(token);
  return payload !== null;
}

// ===================================
// Session Management
// ===================================

// Track active sessions for rate limiting
// TODO (M11): In-memory rate limiting resets on server restart. For production,
// migrate to Redis-backed rate limiting (e.g. using `rate-limiter-flexible` or
// Upstash Ratelimit) so limits persist across deployments and scale with
// multiple instances. See: https://github.com/wyattjoh/rate-limiter-flexible
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION = 60 * 1000; // 1 minute

/**
 * Check if username is locked due to failed login attempts
 */
export function isUsernameLocked(username: string): boolean {
  const attempts = loginAttempts.get(username);
  if (!attempts) return false;

  if (Date.now() > attempts.resetTime) {
    loginAttempts.delete(username);
    return false;
  }

  return attempts.count >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Record failed login attempt
 */
export function recordFailedLogin(username: string): void {
  const attempts = loginAttempts.get(username);

  if (!attempts) {
    loginAttempts.set(username, {
      count: 1,
      resetTime: Date.now() + LOCKOUT_DURATION,
    });
  } else if (Date.now() < attempts.resetTime) {
    attempts.count++;
  } else {
    // Reset window expired, start fresh
    loginAttempts.set(username, {
      count: 1,
      resetTime: Date.now() + LOCKOUT_DURATION,
    });
  }
}

/**
 * Clear failed login attempts (on successful login)
 */
export function clearLoginAttempts(username: string): void {
  loginAttempts.delete(username);
}

/**
 * Get remaining login attempts
 */
export function getRemainingAttempts(username: string): number {
  const attempts = loginAttempts.get(username);
  if (!attempts || Date.now() > attempts.resetTime) {
    return MAX_LOGIN_ATTEMPTS;
  }
  return Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);
}

// ===================================
// Initialization
// ===================================

// Auto-initialize default admin on module load
initializeDefaultAdmin().catch(console.error);

export default {
  generateAccessToken,
  verifyToken,
  extractTokenFromHeader,
  getTokenFromCookie,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  authenticateUser,
  createAdminUser,
  getUserByUsername,
  isAdminRequest,
  getAuthenticatedUser,
  isSuperAdminRequest,
  isProxyAuthenticated,
  isUsernameLocked,
  recordFailedLogin,
  clearLoginAttempts,
  getRemainingAttempts,
  blacklistToken,
  isTokenBlacklisted,
};
