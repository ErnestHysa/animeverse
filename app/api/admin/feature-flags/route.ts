/**
 * API endpoint for managing feature flags
 *
 * GET /api/admin/feature-flags - Get all feature flags (admin only)
 * PUT /api/admin/feature-flags - Update feature flag phase (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { featureFlagManager, FEATURE_FLAGS } from '@/lib/feature-flags';

// Admin check (replace with your auth logic)
function isAdmin(request: NextRequest): boolean {
  // TODO: Implement proper admin authentication
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.ADMIN_API_KEY}`;
}

export async function GET(request: NextRequest) {
  // Check admin access
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const flags = featureFlagManager.getAllFlags();

    // Add current phase info to each flag
    const flagsWithPhase = Object.entries(flags).map(([key, flag]) => ({
      key,
      ...flag,
      currentPhase: featureFlagManager.getFeaturePhase(key as keyof typeof FEATURE_FLAGS),
    }));

    return NextResponse.json({
      flags: flagsWithPhase,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Feature Flags API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Check admin access
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { featureKey, phase, enabled, addUser, removeUser } = body;

    if (!featureKey) {
      return NextResponse.json(
        { error: 'featureKey is required' },
        { status: 400 }
      );
    }

    // Update phase
    if (phase) {
      featureFlagManager.updateFeaturePhase(
        featureKey,
        phase
      );
    }

    // Enable/disable
    if (typeof enabled === 'boolean') {
      featureFlagManager.setFeatureEnabled(
        featureKey,
        enabled
      );
    }

    // Add user to allowed list
    if (addUser) {
      featureFlagManager.addUserToAllowedList(
        featureKey,
        addUser
      );
    }

    // Remove user from allowed list
    if (removeUser) {
      featureFlagManager.removeUserFromAllowedList(
        featureKey,
        removeUser
      );
    }

    // Return updated flag
    const flag = featureFlagManager.getAllFlags()[featureKey];
    const phaseInfo = featureFlagManager.getFeaturePhase(featureKey as keyof typeof FEATURE_FLAGS);

    return NextResponse.json({
      flag: {
        key: featureKey,
        ...flag,
        currentPhase: phaseInfo,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Feature Flags API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}
