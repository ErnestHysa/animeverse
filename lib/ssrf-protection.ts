/**
 * Centralized SSRF Protection Module
 * Shared across proxy-hls, proxy-subtitle, and download-hls routes
 *
 * Provides:
 * - isUrlAllowed(): hostname-level private IP checks + DNS resolution validation
 * - fetchWithSSRFProtection(): safe fetch with redirect validation and DNS rebinding mitigation
 * - getAllowedOrigin(): CORS origin validation (whitelist-based)
 */

import { NextRequest } from 'next/server';
import * as dns from 'dns';

// ===================================
// Configuration
// ===================================

const MAX_REDIRECT_HOPS = 5;

/**
 * Allowed CORS origins whitelist.
 * Can be extended via ALLOWED_ORIGINS env var (comma-separated).
 */
function getAllowedOriginsList(): string[] {
  const defaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://animeverse.stream',
    'https://www.animeverse.stream',
    'https://animeverse.app',
    'https://www.animeverse.app',
  ];
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return [...defaults, ...envOrigins.split(',').map((s) => s.trim())];
  }
  return defaults;
}

// ===================================
// Hostname Normalization (Fix C1)
// ===================================

/**
 * Normalize a hostname that may use decimal, octal, hex, or IPv6-mapped IPv4
 * representations into a standard dotted-decimal or plain IPv6 string.
 * Returns null if the input cannot be normalized.
 */
function normalizeHostname(hostname: string): string | null {
  let h = hostname.toLowerCase();

  // Step 1: Strip bracket wrapping for IPv6 literals like [::ffff:127.0.0.1]
  if (h.startsWith('[') && h.endsWith(']')) {
    h = h.slice(1, -1);
  }

  // Step 2: Handle IPv6-mapped IPv4 like ::ffff:127.0.0.1 or ::ffff:7f00:1
  const ipv6MappedV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;
  const ipv6MappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;
  let mappedMatch: RegExpMatchArray | null;

  mappedMatch = h.match(ipv6MappedV4);
  if (mappedMatch) {
    return mappedMatch[1]; // Extract the embedded IPv4
  }

  mappedMatch = h.match(ipv6MappedHex);
  if (mappedMatch) {
    // Combine two 16-bit hex parts into a 32-bit IPv4
    const high = parseInt(mappedMatch[1], 16);
    const low = parseInt(mappedMatch[2], 16);
    const ip = ((high >>> 16) & 0xff) + '.' + ((high >>> 0) & 0xff) + '.' + ((low >>> 16) & 0xff) + '.' + ((low >>> 0) & 0xff);
    return ip;
  }

  // Step 3: Try to parse as a single decimal integer (e.g., 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(h)) {
    const num = parseInt(h, 10);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return (
        ((num >>> 24) & 0xff) +
        '.' +
        ((num >>> 16) & 0xff) +
        '.' +
        ((num >>> 8) & 0xff) +
        '.' +
        (num & 0xff)
      );
    }
  }

  // Step 4: Try to parse as a hex integer (e.g., 0x7f000001)
  if (/^0x[0-9a-f]+$/.test(h)) {
    const num = parseInt(h, 16);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return (
        ((num >>> 24) & 0xff) +
        '.' +
        ((num >>> 16) & 0xff) +
        '.' +
        ((num >>> 8) & 0xff) +
        '.' +
        (num & 0xff)
      );
    }
  }

  // Step 5: Try to parse as dotted notation with octal/hex octets (e.g., 0177.0.0.1)
  const dottedParts = h.split('.');
  if (dottedParts.length === 4) {
    let allNormalOctets = true;
    let needsNormalization = false;

    for (const part of dottedParts) {
      if (/^0x[0-9a-f]+$/.test(part) || (/^0[0-7]+$/.test(part) && part.length > 1)) {
        needsNormalization = true;
      } else if (!/^\d{1,3}$/.test(part)) {
        allNormalOctets = false;
        break;
      }
    }

    if (allNormalOctets && needsNormalization) {
      const octets = dottedParts.map((part) => {
        if (/^0x[0-9a-f]+$/.test(part)) return parseInt(part, 16);
        if (/^0[0-7]+$/.test(part) && part.length > 1) return parseInt(part, 8);
        return parseInt(part, 10);
      });
      // Validate octet range
      if (octets.every((o) => o >= 0 && o <= 255)) {
        return octets.join('.');
      }
    }
  }

  // Return as-is (could be a regular domain name or standard IPv6)
  return h;
}

// ===================================
// Private IP Checks
// ===================================

/**
 * Check if a hostname string is a private/reserved IP.
 * Applies normalization first to catch decimal/octal/hex representations.
 */
function isPrivateHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true; // If we can't normalize, deny

  const h = normalized;

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
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
    // 198.18.0.0/15 (benchmark testing)
    if (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) return true;
  }

  // Block IPv6 private ranges
  if (isPrivateIPv6(h)) {
    return true;
  }

  return false;
}

/**
 * Check if an IPv6 address string is private/reserved.
 * Handles: ::1, fc00::/7, fe80::/10, :: (unspecified), fd00::/8,
 *          IPv6-mapped loopback ::ffff:127.0.0.1, etc.
 */
function isPrivateIPv6(ip: string): boolean {
  // Expand :: shorthand for comparison
  const h = ip.toLowerCase();

  // Loopback
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
  // Unspecified
  if (h === '::' || h === '0:0:0:0:0:0:0:0') return true;
  // Unique local addresses fc00::/7 (fc00:: and fd00::)
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  // Link-local fe80::/10
  if (h.startsWith('fe80') || h.startsWith('fe90') || h.startsWith('fea0') || h.startsWith('feb0')) return true;
  // IPv4-mapped addresses — extract and check embedded IPv4
  const mappedV4Match = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedV4Match) {
    return isPrivateHostname(mappedV4Match[1]);
  }
  // IPv4-mapped hex form ::ffff:xxxx:xxxx
  const mappedHexMatch = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHexMatch) {
    const high = parseInt(mappedHexMatch[1], 16);
    const low = parseInt(mappedHexMatch[2], 16);
    const v4 = ((high >>> 16) & 0xff) + '.' + ((high >>> 0) & 0xff) + '.' + ((low >>> 16) & 0xff) + '.' + ((low >>> 0) & 0xff);
    return isPrivateHostname(v4);
  }
  // Node-local multicast ff01::/16, link-local multicast ff02::/16
  if (h.startsWith('ff01') || h.startsWith('ff02')) return true;
  // ::ffff:0:0/96 (IPv4-compatible, deprecated)
  if (h.startsWith('::ffff:0')) return true;

  return false;
}

/**
 * Check if a resolved IP address string is private
 */
function isPrivateIP(ip: string): boolean {
  return isPrivateHostname(ip);
}

// ===================================
// DNS Resolution (Fix M1: dual-stack)
// ===================================

interface ResolvedIPs {
  v4: string[];
  v6: string[];
}

/**
 * Resolve DNS for a hostname with a timeout.
 * Tries both A (IPv4) and AAAA (IPv6) records.
 */
function resolveHostname(hostname: string, timeoutMs: number = 3000): Promise<ResolvedIPs> {
  return new Promise((resolve) => {
    const result: ResolvedIPs = { v4: [], v6: [] };
    let pending = 2;

    const timer = setTimeout(() => {
      resolve(result);
    }, timeoutMs);

    const done = () => {
      pending--;
      if (pending === 0) {
        clearTimeout(timer);
        resolve(result);
      }
    };

    dns.resolve4(hostname, (err, addresses) => {
      if (!err && addresses) result.v4 = addresses;
      done();
    });

    dns.resolve6(hostname, (err, addresses) => {
      if (!err && addresses) result.v6 = addresses;
      done();
    });
  });
}

/**
 * Resolve hostname and return all IPs (v4 + v6 combined) for backward compat.
 */
async function resolveAllIPs(hostname: string, timeoutMs: number = 3000): Promise<string[]> {
  const { v4, v6 } = await resolveHostname(hostname, timeoutMs);
  return [...v4, ...v6];
}

// ===================================
// Public API
// ===================================

/**
 * SSRF protection: check if a URL targets a private/reserved IP or localhost.
 * Performs both hostname-level checks AND DNS resolution to verify resolved IPs
 * are not private. Supports IPv6 resolution.
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

    // Normalize and check hostname against known private patterns
    const normalized = normalizeHostname(hostname);
    if (!normalized) {
      return false;
    }

    if (isPrivateHostname(normalized)) {
      return false;
    }

    // DNS resolution check: resolve the hostname and verify resolved IPs (both v4 and v6)
    if (!skipDns && typeof dns !== 'undefined') {
      const resolved = await resolveHostname(hostname, 3000);
      const allIPs = [...resolved.v4, ...resolved.v6];

      if (allIPs.length === 0) {
        // Could not resolve — deny to prevent DNS rebinding
        return false;
      }
      for (const ip of allIPs) {
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

    const normalized = normalizeHostname(hostname);
    if (!normalized) {
      return false;
    }

    if (isPrivateHostname(normalized)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ===================================
// Protected Fetch (Fixes C2 + C3)
// ===================================

/**
 * Fetch with SSRF protection including:
 * - DNS rebinding mitigation (C3): resolves DNS, validates IPs, pins resolved IP
 * - Redirect validation (C2): manually follows redirects with SSRF checks
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (redirect option will be overridden)
 * @param hopCount - Internal: current redirect hop count
 */
export async function fetchWithSSRFProtection(
  url: string,
  options: RequestInit = {},
  hopCount: number = 0
): Promise<Response> {
  // Enforce max redirect hops
  if (hopCount > MAX_REDIRECT_HOPS) {
    throw new Error(`SSRF protection: max redirect hops (${MAX_REDIRECT_HOPS}) exceeded`);
  }

  // Validate the URL before fetching
  const parsed = new URL(url);

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF protection: disallowed protocol ${parsed.protocol}`);
  }

  const originalHostname = parsed.hostname.toLowerCase();
  const originalPort = parsed.port;
  const originalHostHeader = parsed.host; // hostname:port or just hostname

  // --- DNS Rebinding Mitigation (C3) ---
  // Resolve DNS, validate all IPs, then pin the IP for the actual request
  let fetchUrl = url;
  let extraHeaders: Record<string, string> = {};

  if (typeof dns !== 'undefined') {
    const resolved = await resolveHostname(originalHostname, 3000);
    const allIPs = [...resolved.v4, ...resolved.v6];

    if (allIPs.length === 0) {
      throw new Error(`SSRF protection: could not resolve hostname "${originalHostname}"`);
    }

    // Validate ALL resolved IPs
    for (const ip of allIPs) {
      if (isPrivateIP(ip)) {
        throw new Error(`SSRF protection: resolved IP ${ip} is private/reserved`);
      }
    }

    // Pin to the first resolved IP (v4 preferred, then v6)
    const pinnedIP = resolved.v4.length > 0 ? resolved.v4[0] : resolved.v6[0];

    // Reconstruct URL with pinned IP, preserving scheme, port, path, query, hash
    const portPart = originalPort ? `:${originalPort}` : '';
    // For IPv6 literals in URL, wrap in brackets
    const ipForUrl = pinnedIP.includes(':') ? `[${pinnedIP}]` : pinnedIP;
    const newOrigin = `${parsed.protocol}//${ipForUrl}${portPart}`;
    fetchUrl = url.replace(`${parsed.protocol}//${parsed.host}`, newOrigin);

    // Set Host header to original hostname so the server sees the correct virtual host
    extraHeaders['Host'] = originalHostHeader;
  } else {
    // No DNS module available — do hostname-level check only
    const normalized = normalizeHostname(originalHostname);
    if (!normalized || isPrivateHostname(normalized)) {
      throw new Error(`SSRF protection: hostname "${originalHostname}" is private/reserved`);
    }
  }

  // --- Perform fetch with redirect: 'manual' (C2) ---
  // Normalize incoming headers to a plain object
  let baseHeaders: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        baseHeaders[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers as [string, string][]) {
        baseHeaders[key] = value;
      }
    } else {
      baseHeaders = { ...(options.headers as Record<string, string>) };
    }
  }

  const fetchOptions: RequestInit = {
    ...options,
    redirect: 'manual',
    headers: {
      ...baseHeaders,
      ...extraHeaders,
    },
  };

  const response = await fetch(fetchUrl, fetchOptions);

  // --- Handle redirects manually (C2) ---
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      // No Location header on a redirect — return as-is
      return response;
    }

    // Resolve relative redirect URLs
    const redirectUrl = new URL(location, url).href;

    // Validate the redirect target with full SSRF protection
    const allowed = await isUrlAllowed(redirectUrl);
    if (!allowed) {
      throw new Error(`SSRF protection: redirect target "${redirectUrl}" is not allowed`);
    }

    // Recursively follow the redirect with incremented hop count
    return fetchWithSSRFProtection(redirectUrl, options, hopCount + 1);
  }

  return response;
}

// ===================================
// CORS Origin Validation (Fixes C4 + M6)
// ===================================

/**
 * Get allowed origin for CORS headers.
 * Uses a strict whitelist instead of trusting Host or x-forwarded-proto headers.
 *
 * Fix C4: Validates origin against a whitelist (env-configurable).
 * Fix M6: Never constructs an origin from attacker-controlled headers.
 *
 * @returns The allowed origin string, or null if no valid origin is matched.
 */
export function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }

  const allowedOrigins = getAllowedOriginsList();

  // Strict whitelist check: origin must exactly match an allowed origin
  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  // Also allow the origin if its hostname AND port match a whitelisted origin
  // (hostname-only matching allowed bypass via different ports)
  try {
    const originUrl = new URL(origin);
    const originHostname = originUrl.hostname.toLowerCase();
    const originPort = originUrl.port;
    for (const allowed of allowedOrigins) {
      try {
        const allowedUrl = new URL(allowed);
        if (allowedUrl.hostname.toLowerCase() === originHostname) {
          // Require port to match as well (handle default ports for http/https)
          const portsMatch =
            allowedUrl.port === originPort ||
            (!allowedUrl.port && !originPort) ||
            (allowedUrl.protocol === 'https:' && (allowedUrl.port === '443' || !allowedUrl.port) && (!originPort || originUrl.port === '443')) ||
            (allowedUrl.protocol === 'http:' && (allowedUrl.port === '80' || !allowedUrl.port) && (!originPort || originUrl.port === '80'));
          if (portsMatch) {
            return origin;
          }
        }
      } catch {
        // skip malformed allowed origins
      }
    }
  } catch {
    // malformed origin header
  }

  // No match — return null (no CORS header will be set)
  return null;
}

/**
 * Build CORS headers object for a request.
 * Returns headers only if a valid origin is found; empty object otherwise.
 * Safe to spread into response headers.
 */
export function buildCorsHeaders(
  request: NextRequest,
  methods: string = 'GET, OPTIONS',
  allowHeaders: string = 'Content-Type'
): Record<string, string> {
  const origin = getAllowedOrigin(request);
  if (!origin) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowHeaders,
  };
}
