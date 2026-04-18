/**
 * Unit tests for torrent-finder.ts
 *
 * Tests:
 * - Magnet link parsing
 * - Magnet link validation
 * - Quality extraction
 * - Fansub group extraction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseMagnetLink,
  isValidMagnetLink,
  extractQuality,
  extractFansubGroup,
} from '../../lib/torrent-finder';

describe('torrent-finder', () => {
  describe('parseMagnetLink', () => {
    it('should parse a valid magnet link with all fields', () => {
      const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test+Torrent&tr=udp://tracker.example.com:80';

      const result = parseMagnetLink(magnet);

      expect(result).not.toBeNull();
      expect(result?.infoHash).toBeDefined();
      expect(result?.title).toBe('Test Torrent');
      expect(result?.trackers).toBeDefined();
    });

    it('should parse magnet link with minimal infoHash', () => {
      const magnet = 'magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef';

      const result = parseMagnetLink(magnet);

      expect(result).not.toBeNull();
      expect(result?.infoHash).toBeDefined();
    });

    it('should return null for invalid magnet link', () => {
      const result = parseMagnetLink('not-a-magnet-link');

      expect(result).toBeNull();
    });

    it('should return null for magnet link without infoHash', () => {
      const magnet = 'magnet:?dn=Test+Torrent';

      const result = parseMagnetLink(magnet);

      expect(result).toBeNull();
    });

    it('should handle array name field', () => {
      const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';

      const result = parseMagnetLink(magnet);

      expect(result).not.toBeNull();
      expect(result?.title).toBeDefined();
    });
  });

  describe('isValidMagnetLink', () => {
    it('should validate correct magnet link format', () => {
      const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678';

      expect(isValidMagnetLink(magnet)).toBe(true);
    });

    it('should reject magnet link missing magnet:?', () => {
      expect(isValidMagnetLink('http://example.com')).toBe(false);
    });

    it('should reject magnet link without xt parameter', () => {
      expect(isValidMagnetLink('magnet:?dn=Test')).toBe(false);
    });

    it('should reject magnet link with invalid infoHash format', () => {
      expect(isValidMagnetLink('magnet:?xt=urn:btih:invalid')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidMagnetLink('')).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(isValidMagnetLink(null as any)).toBe(false);
      expect(isValidMagnetLink(undefined as any)).toBe(false);
    });
  });

  describe('extractQuality', () => {
    it('should extract 4K/2160p quality', () => {
      expect(extractQuality('[Test] 2160p')).toBe('2160p');
      expect(extractQuality('[Test] 4K')).toBe('2160p');
    });

    it('should extract 1080p quality', () => {
      expect(extractQuality('[Test] 1080p')).toBe('1080p');
      expect(extractQuality('[Test] Full HD')).toBe('1080p');
      expect(extractQuality('[Test] Full.HD')).toBe('1080p');
    });

    it('should extract 720p quality', () => {
      expect(extractQuality('[Test] 720p')).toBe('720p');
      expect(extractQuality('[Test] HD')).toBe('720p');
    });

    it('should extract 480p quality', () => {
      expect(extractQuality('[Test] 480p')).toBe('480p');
      expect(extractQuality('[Test] SD')).toBe('480p');
    });

    it('should extract 360p quality', () => {
      expect(extractQuality('[Test] 360p')).toBe('360p');
    });

    it('should return unknown for no quality', () => {
      expect(extractQuality('[Test] No Quality')).toBe('unknown');
    });
  });

  describe('extractFansubGroup', () => {
    it('should extract group from brackets', () => {
      expect(extractFansubGroup('[HorribleSubs] Test Episode 1')).toBe('HorribleSubs');
      expect(extractFansubGroup('[Erai-raws] Test Episode 1')).toBe('Erai-raws');
    });

    it('should extract group from text pattern', () => {
      expect(extractFansubGroup('Test Episode 1 - HorribleSubs')).toBe('HorribleSubs');
      expect(extractFansubGroup('Test Episode 1 - SubsPlease')).toBe('SubsPlease');
    });

    it('should return null for no group', () => {
      expect(extractFansubGroup('Test Episode 1')).toBeNull();
    });

    it('should handle multiple brackets', () => {
      expect(extractFansubGroup('[HorribleSubs][1080p] Test Episode 1')).toBe('HorribleSubs');
    });
  });
});
