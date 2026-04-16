/**
 * Client-side hook for checking feature flags
 *
 * Usage:
 * const { isEnabled, isLoading } = useFeatureFlag('WEBTORRENT_STREAMING');
 */

import { useState, useEffect } from 'react';

export type FeatureKey =
  | 'WEBTORRENT_STREAMING'
  | 'HYBRID_STREAMING'
  | 'TORRENT_PRELOADING'
  | 'BANDWIDTH_THROTTLING'
  | 'SEED_TRACKING';

interface UseFeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  error?: string;
  phase?: {
    phase: string;
    percentage: number;
    description: string;
  };
}

export function useFeatureFlag(featureKey: FeatureKey): UseFeatureFlagResult {
  const [state, setState] = useState<{
    isEnabled: boolean;
    isLoading: boolean;
    error?: string;
    phase?: {
      phase: string;
      percentage: number;
      description: string;
    };
  }>({
    isEnabled: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        // WARNING: Reading role from localStorage is NOT secure — an attacker can
        // set `localStorage.setItem('userRole', 'admin')` to bypass feature gates.
        // These headers are sent as "client-claimed" hints only and MUST NOT be
        // trusted by any server-side logic. The server-side feature flag API (if one
        // exists) MUST validate the user's role against the authenticated session
        // (e.g. JWT token) and ignore these headers entirely.
        //
        // TODO: Implement server-side /api/feature-flags route that resolves the
        // user's actual role from the session/token and do NOT rely on these
        // client-provided headers for authorization decisions.
        const userId = localStorage.getItem('userId');
        const email = localStorage.getItem('userEmail');
        const isAdmin = localStorage.getItem('userRole') === 'admin';
        const isBetaTester = localStorage.getItem('isBetaTester') === 'true';

        const response = await fetch(
          `/api/feature-flags?feature=${featureKey}`,
          {
            headers: {
              // Client-claimed identity — NOT authoritative. Server must validate via session/token.
              'x-client-claimed-user-id': userId || '',
              'x-client-claimed-email': email || '',
              'x-client-claimed-role': isAdmin ? 'admin' : 'user',
              'x-client-claimed-beta': isBetaTester ? 'true' : 'false',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to check feature flag');
        }

        const data = await response.json();

        setState({
          isEnabled: data.enabled,
          isLoading: false,
          phase: data.phase,
        });
      } catch (error) {
        console.error('[useFeatureFlag] Error:', error);
        setState({
          isEnabled: false,
          isLoading: false,
          error: 'Failed to check feature flag',
        });
      }
    };

    checkFeatureFlag();
  }, [featureKey]);

  return state;
}

/**
 * Server-side function to check feature flags
 * Use in API routes or getServerSideProps
 *
 * WARNING: The caller MUST derive userContext from the authenticated session
 * (e.g. JWT token or server-side cookie), NOT from client-provided headers or
 * localStorage. Passing client-controlled values here would bypass role checks.
 */
export async function checkFeatureFlagServer(
  featureKey: FeatureKey,
  userContext: {
    userId?: number;
    email?: string;
    isAdmin?: boolean;
    isBetaTester?: boolean;
  }
): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/feature-flags?feature=${featureKey}`,
      {
        headers: {
          // These are server-to-server headers; the caller is responsible for
          // ensuring userContext comes from an authenticated session, not client input.
          'x-user-id': userContext.userId?.toString() || '',
          'x-user-email': userContext.email || '',
          'x-user-role': userContext.isAdmin ? 'admin' : 'user',
          'x-user-beta': userContext.isBetaTester ? 'true' : 'false',
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.enabled;
  } catch (error) {
    console.error('[checkFeatureFlagServer] Error:', error);
    return false;
  }
}
