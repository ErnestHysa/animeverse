/**
 * Public API endpoint for checking feature flags
 *
 * GET /api/feature-flags?feature=WEBTORRENT_STREAMING
 *
 * Returns whether a feature is enabled for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { featureFlagManager } from '@/lib/feature-flags';

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

    // Get user context from session (replace with your auth logic)
    const userContext = {
      userId: request.headers.get('x-user-id') ? parseInt(request.headers.get('x-user-id')!) : undefined,
      email: request.headers.get('x-user-email') || undefined,
      isAdmin: request.headers.get('x-user-role') === 'admin',
      isBetaTester: request.headers.get('x-user-beta') === 'true',
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
