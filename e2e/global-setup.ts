/**
 * Global setup: Warm up Next.js pages before tests run
 * This triggers Turbopack compilation so tests don't time out on first visit
 */
import { chromium } from '@playwright/test';

async function warmupPage(page: Awaited<ReturnType<typeof import('@playwright/test').chromium.newPage>>, url: string) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    console.log(`Warmed up: ${url}`);
  } catch (e) {
    console.log(`Warning: Could not warm up ${url}: ${e}`);
  }
}

export default async function globalSetup() {
  console.log('Warming up Next.js pages...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Warm up the most important pages to trigger Turbopack compilation
  const pagesToWarmup = [
    'http://localhost:3000/',
    'http://localhost:3000/anime/21459',
    'http://localhost:3000/search',
    'http://localhost:3000/trending',
    'http://localhost:3000/popular',
    'http://localhost:3000/seasonal',
    'http://localhost:3000/schedule',
    'http://localhost:3000/history',
    'http://localhost:3000/watch/21459/1',
    'http://localhost:3000/genres',
  ];

  for (const url of pagesToWarmup) {
    await warmupPage(page, url);
  }

  await browser.close();
  console.log('Warmup complete!');
}
