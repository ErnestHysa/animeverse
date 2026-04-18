/**
 * Feature Flag System for Gradual Rollout
 *
 * Phase 8: Gradual rollout configuration
 * - Phase 1: Admin-only access
 * - Phase 2: 10% of users (beta)
 * - Phase 3: 50% of users
 * - Phase 4: 100% rollout
 */

// ===================================
// Types
// ===================================

export type RolloutPhase = 'admin-only' | 'beta-10' | 'beta-50' | 'full';

export interface FeatureFlagConfig {
  featureName: string;
  enabled: boolean;
  phase: RolloutPhase;
  percentage: number;
  allowedUserIds?: number[];
  allowedEmails?: string[];
  adminOnly: boolean;
}

export interface UserContext {
  userId?: number;
  email?: string;
  isAdmin?: boolean;
  isBetaTester?: boolean;
}

// ===================================
// Feature Flag Configuration
// ===================================

const FEATURE_FLAGS: Record<string, FeatureFlagConfig> = {
  WEBTORRENT_STREAMING: {
    featureName: 'WebTorrent P2P Streaming',
    enabled: true,
    phase: 'admin-only', // Start with admin-only, change as rollout progresses
    percentage: 0, // Will be calculated based on phase
    allowedUserIds: [], // Add admin user IDs here
    allowedEmails: [], // Add admin emails here
    adminOnly: true,
  },
  HYBRID_STREAMING: {
    featureName: 'Hybrid Streaming (auto-switch)',
    enabled: true,
    phase: 'admin-only',
    percentage: 0,
    allowedUserIds: [],
    allowedEmails: [],
    adminOnly: true,
  },
  TORRENT_PRELOADING: {
    featureName: 'Torrent Preloading',
    enabled: true,
    phase: 'admin-only',
    percentage: 0,
    allowedUserIds: [],
    allowedEmails: [],
    adminOnly: true,
  },
  BANDWIDTH_THROTTLING: {
    featureName: 'Bandwidth Throttling',
    enabled: true,
    phase: 'admin-only',
    percentage: 0,
    allowedUserIds: [],
    allowedEmails: [],
    adminOnly: true,
  },
  SEED_TRACKING: {
    featureName: 'Seed Tracking & Rewards',
    enabled: true,
    phase: 'admin-only',
    percentage: 0,
    allowedUserIds: [],
    allowedEmails: [],
    adminOnly: false, // Available to all once enabled
  },
};

// ===================================
// Rollout Phase Configuration
// ===================================

const ROLLOUT_PHASES: Record<RolloutPhase, { percentage: number; description: string }> = {
  'admin-only': { percentage: 0, description: 'Admin access only' },
  'beta-10': { percentage: 10, description: '10% of users (beta)' },
  'beta-50': { percentage: 50, description: '50% of users' },
  'full': { percentage: 100, description: '100% rollout' },
};

// ===================================
// Feature Flag Manager
// ===================================

import { createScopedLogger } from '@/lib/logger';
const logger = createScopedLogger('FeatureFlag');

class FeatureFlagManager {
  private static instance: FeatureFlagManager;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Check if a feature is enabled for a user
   */
  isFeatureEnabled(featureKey: keyof typeof FEATURE_FLAGS, userContext: UserContext): boolean {
    const flag = FEATURE_FLAGS[featureKey];

    if (!flag || !flag.enabled) {
      return false;
    }

    // Admin always has access
    if (userContext.isAdmin) {
      return true;
    }

    // Admin-only features
    if (flag.adminOnly && !userContext.isAdmin) {
      return false;
    }

    // Check explicit user access
    if (userContext.userId && flag.allowedUserIds?.includes(userContext.userId)) {
      return true;
    }

    if (userContext.email && flag.allowedEmails?.includes(userContext.email)) {
      return true;
    }

    // Beta tester access
    if (userContext.isBetaTester && this.isBetaPhase(flag.phase)) {
      return true;
    }

    // Percentage-based rollout
    if (this.shouldUserSeeFeature(userContext, flag)) {
      return true;
    }

    return false;
  }

  /**
   * Check if user should see feature based on percentage rollout
   */
  private shouldUserSeeFeature(userContext: UserContext, flag: FeatureFlagConfig): boolean {
    if (!userContext.userId) {
      return false;
    }

    const percentage = ROLLOUT_PHASES[flag.phase].percentage;

    if (percentage === 0) {
      return false;
    }

    if (percentage === 100) {
      return true;
    }

    // Consistent hashing based on user ID
    const hash = this.hashUserId(userContext.userId);
    const threshold = (percentage / 100) * 100; // 0-100 scale

    return hash < threshold;
  }

  /**
   * Hash user ID to consistent number 0-100
   */
  private hashUserId(userId: number): number {
    // Simple hash function for consistent rollout
    const str = userId.toString();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return (hash >>> 0) % 101; // Unsigned right shift ensures non-negative
  }

  /**
   * Check if current phase is a beta phase
   */
  private isBetaPhase(phase: RolloutPhase): boolean {
    return phase === 'beta-10' || phase === 'beta-50';
  }

  /**
   * Update feature flag phase
   */
  updateFeaturePhase(
    featureKey: keyof typeof FEATURE_FLAGS,
    newPhase: RolloutPhase
  ): void {
    const flag = FEATURE_FLAGS[featureKey];
    if (flag) {
      flag.phase = newPhase;
      flag.percentage = ROLLOUT_PHASES[newPhase].percentage;

      // Update admin-only based on phase
      flag.adminOnly = newPhase === 'admin-only';

      logger.info(`${featureKey} phase updated to ${newPhase}`);
    }
  }

  /**
   * Get current phase info for a feature
   */
  getFeaturePhase(featureKey: keyof typeof FEATURE_FLAGS): {
    phase: RolloutPhase;
    percentage: number;
    description: string;
  } | null {
    const flag = FEATURE_FLAGS[featureKey];
    if (!flag) {
      return null;
    }

    const phaseConfig = ROLLOUT_PHASES[flag.phase];

    return {
      phase: flag.phase,
      percentage: phaseConfig.percentage,
      description: phaseConfig.description,
    };
  }

  /**
   * Get all feature flags (admin only)
   */
  getAllFlags(): Record<string, FeatureFlagConfig> {
    return JSON.parse(JSON.stringify({ ...FEATURE_FLAGS }));
  }

  /**
   * Enable/disable a feature
   */
  setFeatureEnabled(featureKey: keyof typeof FEATURE_FLAGS, enabled: boolean): void {
    const flag = FEATURE_FLAGS[featureKey];
    if (flag) {
      flag.enabled = enabled;
      logger.info(`${featureKey} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Add user to allowed list
   */
  addUserToAllowedList(
    featureKey: keyof typeof FEATURE_FLAGS,
    userId: number
  ): void {
    const flag = FEATURE_FLAGS[featureKey];
    if (flag) {
      if (!flag.allowedUserIds) {
        flag.allowedUserIds = [];
      }
      flag.allowedUserIds.push(userId);
      logger.info(`User ${userId} added to ${featureKey}`);
    }
  }

  /**
   * Remove user from allowed list
   */
  removeUserFromAllowedList(
    featureKey: keyof typeof FEATURE_FLAGS,
    userId: number
  ): void {
    const flag = FEATURE_FLAGS[featureKey];
    if (flag && flag.allowedUserIds) {
      flag.allowedUserIds = flag.allowedUserIds.filter(id => id !== userId);
      logger.info(`User ${userId} removed from ${featureKey}`);
    }
  }
}

// Export singleton instance
export const featureFlagManager = FeatureFlagManager.getInstance();

// Export types and config
export { FEATURE_FLAGS, ROLLOUT_PHASES };
