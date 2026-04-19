/**
 * Load Testing Configuration for Concurrent Streams
 *
 * Tests:
 * - 100+ concurrent WebTorrent streams
 * - CDN bandwidth reduction measurement
 * - Seed server capacity testing
 *
 * Run with: k6 run tests/load/concurrent-streams.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const streamSuccessRate = new Rate('stream_success_rate');
const p2pBandwidthRate = new Rate('p2p_bandwidth_rate');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },     // Ramp up to 50 users
    { duration: '2m', target: 100 },    // Ramp up to 100 users
    { duration: '2m', target: 100 },    // Stay at 100 users
    { duration: '1m', target: 0 },      // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<5000'], // 95% of requests under 5s
    'stream_success_rate': ['rate>0.95'],  // 95% success rate
    'p2p_bandwidth_rate': ['rate>0.3'],    // 30% P2P bandwidth
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const animeEpisodes = [
  { animeId: 1, episode: 1 },
  { animeId: 1, episode: 2 },
  { animeId: 2, episode: 1 },
  { animeId: 3, episode: 1 },
  { animeId: 4, episode: 1 },
];

export function setup() {
  // Setup: Create test users, initialize data
  console.log('Starting load test setup...');
  return { startTime: new Date().toISOString() };
}

export default function(data) {
  // Pick random anime episode
  const episode = animeEpisodes[Math.floor(Math.random() * animeEpisodes.length)];

  // Test 1: Fetch torrent sources
  const torrentResponse = http.get(
    `${BASE_URL}/api/torrent-sources/${episode.animeId}/${episode.episode}`
  );

  const torrentSuccess = check(torrentResponse, {
    'torrent sources status 200': (r) => r.status === 200,
    'torrent sources has magnets': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.magnets && body.magnets.length > 0;
      } catch {
        return false;
      }
    },
    'torrent response time < 5s': (r) => r.timings.duration < 5000,
  });

  streamSuccessRate.add(torrentSuccess);

  // Test 2: Simulate WebTorrent stream initiation
  if (torrentSuccess) {
    const streamResponse = http.post(
      `${BASE_URL}/api/stream/initiate`,
      JSON.stringify({
        method: 'webtorrent',
        animeId: episode.animeId,
        episode: episode.episode,
        magnet: JSON.parse(torrentResponse.body).magnets[0].magnet,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(streamResponse, {
      'stream initiation status 200': (r) => r.status === 200,
      'stream has sessionId': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.sessionId !== undefined;
        } catch {
          return false;
        }
      },
    });
  }

  // Test 3: Check P2P bandwidth statistics
  const statsResponse = http.get(`${BASE_URL}/api/stats/p2p`);

  check(statsResponse, {
    'stats status 200': (r) => r.status === 200,
    'p2p bandwidth > 30%': (r) => {
      try {
        const body = JSON.parse(r.body);
        const p2pRatio = body.totalBandwidth > 0 ? body.p2pBandwidth / body.totalBandwidth : 0;
        p2pBandwidthRate.add(p2pRatio > 0.3);
        return p2pRatio > 0.3;
      } catch {
        return false;
      }
    },
  });

  // Simulate user watching time
  sleep(Math.random() * 10 + 5); // 5-15 seconds
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Start time: ${data.startTime}`);
  console.log(`End time: ${new Date().toISOString()}`);
}
