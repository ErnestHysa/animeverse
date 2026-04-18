/**
 * Public API endpoint for checking feature flags
 *
 * GET /api/feature-flags?feature=WEBTORRENT_STREAMING
 *
 * Returns whether a feature is enabled for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { featureFlagManager } from '@/lib/feature-flags';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

// Beta tester user IDs (configure as needed)
const BETA_TESTER_USER_IDS: string[] = [
  // Add beta tester user IDs here
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const featureKey = searchParams.get('feature');

    if (!featureKey) {
      return NextResponse.json(
        { error: 'feature parameter is required' },
        { status: 400 }
      );
    }

    // Get user context from verified JWT token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const payload = token ? verifyToken(token) : null;

    const userContext = {
      userId: (() => {
        if (!payload?.userId) return undefined;
        // Hash the userId string directly instead of stripping non-digits
        let hash = 0;
        for (let i = 0; i < payload.userId.length; i++) {
          hash = ((hash << 5) - hash) + payload.userId.charCodeAt(i);
          hash = hash | 0;
        }
        return hash;
      })(),
      email: undefined as string | undefined,
      isAdmin: payload?.role === 'admin' || payload?.role === 'superadmin',
      isBetaTester: payload ? BETA_TESTER_USER_IDS.includes(payload.userId) : false,
    };

    const isEnabled = featureFlagManager.isFeatureEnabled(
      featureKey as keyof typeof import('@/lib/feature-flags').FEATURE_FLAGS,
      userContext
    );

    const phaseInfo = featureFlagManager.getFeaturePhase(
      featureKey as keyof typeof import('@/lib/feature-flags').FEATURE_FLAGS
    );

    return NextResponse.json({
      feature: featureKey,
      enabled: isEnabled,
      phase: phaseInfo,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Feature Flag Check API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check feature flag' },
      { status: 500 }
    );
  }
}
