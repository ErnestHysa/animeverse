/**
 * Unit tests for webtorrent-manager.ts
 *
 * Tests:
 * - Session creation and management
 * - Session retrieval and cleanup
 * - Quality selection
 * - Error handling
 * - Singleton pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, getSession, destroySession, selectBestQuality } from '../../lib/webtorrent-manager';
import type { WebTorrentSession } from '../../lib/webtorrent-manager';

describe('webtorrent-manager', () => {
  beforeEach(() => {
    // Clear any existing sessions
    const session = getSession('test-session');
    if (session) {
      destroySession('test-session');
    }
  });

  describe('createSession', () => {
    it('should create a new session with valid magnet', () => {
      const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';
      const infoHash = '1234567890abcdef1234567890abcdef12345678';

      const session = createSession(magnet, infoHash);

      expect(session).toBeDefined();
      expect(session.infoHash).toBe(infoHash);
      expect(session.magnet).toBe(magnet);
      expect(session.isActive).toBe(true);
      expect(session.progress).toBe(0);
    });

    it('should create unique session IDs', () => {
      const magnet1 = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678';
      const infoHash1 = '1234567890abcdef1234567890abcdef12345678';
      const magnet2 = 'magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef';
      const infoHash2 = 'abcdef1234567890abcdef1234567890abcdef';

      const session1 = createSession(magnet1, infoHash1);
      const session2 = createSession(magnet2, infoHash2);

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', () => {
      const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678';
      const infoHash = '1234567890abcdef1234567890abcdef12345678';

      const createdSession = createSession(magnet, infoHash);
      const retrievedSession = getSession(createdSession.id);

      expect(retrievedSession).toBe(createdSession);
    });

    it('should return undefined for non-existent session', () => {
      const result = getSession('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('destroySession', () => {
    it('should remove session', () => {
      const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678';
      const infoHash = '1234567890abcdef1234567890abcdef12345678';

      const session = createSession(magnet, infoHash);
      destroySession(session.id);

      expect(getSession(session.id)).toBeUndefined();
    });

    it('should handle destroying non-existent session', () => {
      expect(() => {
        destroySession('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('selectBestQuality', () => {
    it('should select magnet with highest score', () => {
      const magnets = [
        { magnet: 'magnet:1', infoHash: '1', title: 'Test 1080p', quality: '1080p', size: 1000, seeders: 50, leechers: 10, provider: 'test' },
        { magnet: 'magnet:2', infoHash: '2', title: 'Test 720p', quality: '720p', size: 800, seeders: 100, leechers: 20, provider: 'test' },
      ];

      const best = selectBestQuality(magnets);

      expect(best).toBeDefined();
      expect(best?.quality).toBe('720p'); // Higher seed count wins
    });

    it('should return null for empty array', () => {
      const best = selectBestQuality([]);

      expect(best).toBeNull();
    });
  });
});
