/**
 * Centralized SSRF Protection Module
 * Shared across proxy-hls, proxy-subtitle, and download-hls routes
 *
 * Provides:
 * - isUrlAllowed(): hostname-level private IP checks + DNS resolution validation
 * - getAllowedOrigin(): CORS origin validation
 */

import { NextRequest } from 'next/server';
import * as dns from 'dns';

// ===================================
// Private IP Checks
// ===================================

/**
 * Check if a hostname string is a private/reserved IP
 */
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Block localhost
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
    return true;
  }

  // Block private IPv4 ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = h.match(ipv4Regex);
  if (match) {
    const octets = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
    // 10.0.0.0/8
    if (octets[0] === 10) return true;
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 127.0.0.0/8 (loopback)
    if (octets[0] === 127) return true;
    // 0.0.0.0/8
    if (octets[0] === 0) return true;
  }

  // Block IPv6 private ranges (simplified check)
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h === '::1') {
    return true;
  }

  return false;
}

/**
 * Check if a resolved IP address string is private
 */
function isPrivateIP(ip: string): boolean {
  return isPrivateHostname(ip);
}

/**
 * Resolve DNS for a hostname with a timeout
 */
function resolveHostname(hostname: string, timeoutMs: number = 3000): Promise<string[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve([]);
    }, timeoutMs);

    dns.resolve4(hostname, (err, addresses) => {
      clearTimeout(timer);
      if (err) {
        // If resolution fails, return empty — caller should deny
        resolve([]);
        return;
      }
      resolve(addresses);
    });
  });
}

// ===================================
// Public API
// ===================================

/**
 * SSRF protection: check if a URL targets a private/reserved IP or localhost.
 * Performs both hostname-level checks AND DNS resolution to verify resolved IPs
 * are not private.
 *
 * @param url - The URL to validate
 * @param skipDns - Skip DNS resolution check (for testing or non-Node runtimes)
 */
export async function isUrlAllowed(url: string, skipDns: boolean = false): Promise<boolean> {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check hostname string against known private patterns
    if (isPrivateHostname(hostname)) {
      return false;
    }

    // DNS resolution check: resolve the hostname and verify resolved IPs
    if (!skipDns && typeof dns !== 'undefined') {
      const resolvedIPs = await resolveHostname(hostname, 3000);
      if (resolvedIPs.length === 0) {
        // Could not resolve — deny to prevent DNS rebinding
        // Exception: allow if hostname looks like a public domain
        // but we can't verify. Be conservative.
        return false;
      }
      for (const ip of resolvedIPs) {
        if (isPrivateIP(ip)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous version for backwards compatibility with routes that
 * only need hostname-level checks (no DNS resolution).
 * Use the async isUrlAllowed() for full protection.
 */
export function isUrlAllowedSync(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (isPrivateHostname(hostname)) {
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
export function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || '';
  // Allow same-origin or known production URLs
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (originHost === 'localhost' || originHost === '127.0.0.1' || originHost.endsWith('.animeverse.app') || originHost === host.split(':')[0]) {
        return origin;
      }
    } catch {}
  }
  // Fallback to request host
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
