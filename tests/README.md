# Testing Documentation - Phase 8

This document describes the testing setup for the P2P/Torrent streaming feature.

## Test Categories

### 1. Unit Tests

Test individual modules in isolation.

**Location:** `tests/unit/`

**Files:**
- `torrent-finder.test.ts` - Magnet link parsing, validation, quality extraction
- `webtorrent-manager.test.ts` - Session management, client lifecycle
- `hybrid-stream-manager.test.ts` - Fallback logic, timeout handling

**Running:**
```bash
# Run all unit tests
npm run test

# Run with watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

**Framework:** Vitest
- Fast execution
- Built-in TypeScript support
- Mocking utilities
- Coverage reporting

### 2. Integration Tests

Test multiple components working together.

**Location:** `e2e/`

**Files:**
- `webtorrent-player.spec.ts` - Full E2E player tests
- `browser-compatibility.spec.ts` - Cross-browser tests

**Running:**
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run headed (see browser)
npm run test:e2e:headed

# Run in debug mode
npm run test:e2e:debug
```

**Framework:** Playwright
- Cross-browser support (Chrome, Firefox, Safari)
- Mobile testing
- Video recording on failure
- Screenshot capture

### 3. Load Tests

Test system performance under load.

**Location:** `tests/load/`

**Files:**
- `concurrent-streams.js` - 100+ concurrent stream simulation

**Running:**
```bash
# Install k6 first
# macOS: brew install k6
# Linux: sudo apt-get install k6
# Windows: choco install k6

# Run load test
k6 run tests/load/concurrent-streams.js

# Run with custom base URL
BASE_URL=https://production.com k6 run tests/load/concurrent-streams.js
```

**Framework:** k6
- 100+ concurrent users
- CDN bandwidth measurement
- P2P ratio tracking

**Metrics:**
- Stream success rate (target: >95%)
- P2P bandwidth rate (target: >30%)
- Response time (target: p95 < 5s)

## Browser Compatibility

### Supported Browsers

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome/Edge | Latest | Full support |
| Firefox | Latest | Full support |
| Safari | Latest+ | Requires polyfill |
| Mobile Chrome | Latest | Full support |
| Mobile Safari | Latest+ | Polyfill required |

### Running Browser Tests

```bash
# Test specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Test mobile
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

## Gradual Rollout

Feature flags control the rollout of P2P streaming:

### Phase 1: Admin-Only
- Only admins can access
- Testing and validation
- Duration: 1-2 weeks

### Phase 2: Beta (10%)
- 10% of users get access
- Beta testers included
- Monitor metrics closely
- Duration: 2-3 weeks

### Phase 3: Beta (50%)
- 50% of users get access
- Scale testing
- Duration: 1-2 weeks

### Phase 4: Full Rollout (100%)
- All users get access
- Monitor for issues
- Duration: Ongoing

### Managing Rollout

```bash
# Check current phase
curl -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:3000/api/admin/feature-flags

# Update phase
curl -X PUT -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"featureKey":"WEBTORRENT_STREAMING","phase":"beta-10"}' \
  http://localhost:3000/api/admin/feature-flags

# Add user to allowed list
curl -X PUT -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"featureKey":"WEBTORRENT_STREAMING","addUser":123}' \
  http://localhost:3000/api/admin/feature-flags
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e

  load-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: k6 run tests/load/concurrent-streams.js
```

## Test Data

### Mock Magnet Links
```javascript
const mockMagnets = [
  'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test+Anime+Episode+1',
  'magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef&dn=Test+Anime+Episode+2',
];
```

### Mock Torrent Sources
```javascript
const mockSources = {
  type: 'magnet',
  url: 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678',
  seeders: 100,
  leechers: 50,
  quality: '1080p',
};
```

## Coverage Goals

| Module | Target | Current |
|--------|--------|---------|
| torrent-finder | 90% | TBD |
| webtorrent-manager | 85% | TBD |
| hybrid-stream-manager | 85% | TBD |
| feature-flags | 80% | TBD |

## Troubleshooting

### Tests Fail to Start
```bash
# Clear vitest cache
rm -rf node_modules/.vite

# Reinstall dependencies
rm -rf node_modules
npm install
```

### E2E Tests Timeout
```bash
# Ensure dev server is running
npm run dev

# In another terminal, run tests
npm run test:e2e
```

### Load Tests Fail
```bash
# Ensure production server is running
npm run build
npm start

# Run load tests against localhost
k6 run tests/load/concurrent-streams.js
```

## Next Steps

1. Run unit tests: `npm run test`
2. Run E2E tests: `npm run test:e2e`
3. Check coverage: `npm run test:coverage`
4. Start gradual rollout (admin-only phase)
5. Monitor metrics and adjust as needed

## Success Criteria

- [ ] All unit tests passing (>90% coverage)
- [ ] All E2E tests passing across browsers
- [ ] Load tests handle 100+ concurrent streams
- [ ] P2P bandwidth reduction >30%
- [ ] Stream success rate >95%
- [ ] Admin-only rollout successful
- [ ] Ready for beta rollout (10%)
