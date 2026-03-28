import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Anime Stream E2E Testing
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false, // Run tests sequentially for video playback
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker to avoid port conflicts
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  timeout: 120000, // 2 minute test timeout
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 60000,
    navigationTimeout: 60000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Start mock server + Next.js dev server before running tests
  webServer: [
    {
      command: 'node scripts/mock-anilist-server.js',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 10000,
    },
    {
      command: process.platform === 'win32'
        ? 'cmd /c "set ANILIST_GRAPHQL_URL=http://localhost:4000&& node scripts\\start-next-webpack.mjs"'
        : 'ANILIST_GRAPHQL_URL=http://localhost:4000 node scripts/start-next-webpack.mjs',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        ANILIST_GRAPHQL_URL: 'http://localhost:4000',
      },
    },
  ],
});
