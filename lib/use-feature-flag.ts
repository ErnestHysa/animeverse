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
        // Get user context from localStorage (set by your auth system)
        const userId = localStorage.getItem('userId');
        const email = localStorage.getItem('userEmail');
        const isAdmin = localStorage.getItem('userRole') === 'admin';
        const isBetaTester = localStorage.getItem('isBetaTester') === 'true';

        const response = await fetch(
          `/api/feature-flags?feature=${featureKey}`,
          {
            headers: {
              'x-user-id': userId || '',
              'x-user-email': email || '',
              'x-user-role': isAdmin ? 'admin' : 'user',
              'x-user-beta': isBetaTester ? 'true' : 'false',
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
