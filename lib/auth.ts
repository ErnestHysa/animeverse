/**
 * Authentication Library
 * Handles JWT tokens, password hashing, and user authentication
 *
 * Phase 11: Production Deployment - Security Implementation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';

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

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN Production';
const JWT_EXPIRES_IN = '1h'; // Access token expires in 1 hour
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token expires in 7 days
const BCRYPT_ROUNDS = 12;

// ===================================
// Token Management
// ===================================

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: AdminUser): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(user: AdminUser): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
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
// User Management (In-Memory for Now)
// ===================================

// TODO: Move to database in production
const ADMIN_USERS: Map<string, AdminUser & { passwordHash: string }> = new Map();

// Initialize default admin user if not exists
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

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
 */
export async function authenticateUser(
  credentials: LoginCredentials
): Promise<{ success: boolean; error?: string; user?: AdminUser; tokens?: { access: string; refresh: string } }> {
  const { username, password } = credentials;

  // Get user
  const userRecord = getUserByUsername(username);
  if (!userRecord) {
    return { success: false, error: 'Invalid username or password' };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, userRecord.passwordHash);
  if (!passwordValid) {
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
  const refreshToken = generateRefreshToken(user);

  return {
    success: true,
    user,
    tokens: {
      access: accessToken,
      refresh: refreshToken,
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
  return payload?.role === 'superadmin' || false;
}

// ===================================
// Session Management
// ===================================

// Track active sessions for rate limiting
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
  generateRefreshToken,
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
  isUsernameLocked,
  recordFailedLogin,
  clearLoginAttempts,
  getRemainingAttempts,
};
