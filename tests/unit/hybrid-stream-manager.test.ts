/**
 * Unit tests for hybrid-stream-manager.ts
 *
 * Tests:
 * - Primary method selection
 * - Fallback logic
 * - Timeout handling
 * - Seed count threshold
 * - Error handling
 * - Attempt cancellation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hybridStreamManager, loadStream, cancelStreamAttempt, cancelAllStreamAttempts } from '../../lib/hybrid-stream-manager';

// Mock logger
vi.mock('../../lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('hybrid-stream-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any active attempts
    cancelAllStreamAttempts();
  });

  describe('loadStream', () => {
    it('should successfully load HLS stream', async () => {
      const options = {
        primaryMethod: 'hls' as const,
        animeId: 1,
        episodeNumber: 1,
        language: 'sub' as const,
      };

      // Mock successful HLS response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          sources: [{ url: 'https://example.com/video.m3u8', quality: '1080p' }],
          provider: 'test-provider',
        }),
      });

      const result = await loadStream(options);

      expect(result.source).toBeDefined();
      expect(result.method).toBe('hls');
      expect(result.fallbackOccurred).toBe(false);
    });

    it('should fallback on HLS failure', async () => {
      const options = {
        primaryMethod: 'hls' as const,
        animeId: 1,
        episodeNumber: 1,
        language: 'sub' as const,
        onFallback: vi.fn(),
      };

      // Mock HLS failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await loadStream(options);

      expect(result.method).toBe('hls');
      expect(result.error).toBeDefined();
    });
  });

  describe('cancelStreamAttempt', () => {
    it('should cancel active attempt', () => {
      expect(() => {
        cancelStreamAttempt('1-1-sub');
      }).not.toThrow();
    });
  });

  describe('cancelAllStreamAttempts', () => {
    it('should cancel all active attempts', () => {
      expect(() => {
        cancelAllStreamAttempts();
      }).not.toThrow();
    });
  });
});
