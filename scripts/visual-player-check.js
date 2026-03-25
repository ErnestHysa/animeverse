#!/usr/bin/env node
/**
 * Visual Player Check
 * Launches a real browser, navigates to the watch page, and captures
 * screenshots + detailed player state at each stage.
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-results', 'visual-check');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false, timeout: 8000, animations: 'disabled' });
    console.log(`  📸 ${name}.png`);
  } catch (e) {
    console.log(`  ⚠️  screenshot failed: ${name} — ${e.message}`);
  }
}

async function getPlayerState(page) {
  return page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) return { found: false };

    const tracks = Array.from(video.textTracks).map(t => ({
      kind: t.kind,
      label: t.label,
      language: t.language,
      mode: t.mode,
      cues: t.cues ? t.cues.length : 0,
    }));

    return {
      found: true,
      src: video.src || video.currentSrc || '(none)',
      readyState: video.readyState,    // 0=HAVE_NOTHING,1=HAVE_METADATA,2=HAVE_CURRENT_DATA,3=HAVE_FUTURE_DATA,4=HAVE_ENOUGH_DATA
      networkState: video.networkState, // 0=EMPTY,1=IDLE,2=LOADING,3=NO_SOURCE
      paused: video.paused,
      duration: video.duration,
      error: video.error ? { code: video.error.code, message: video.error.message } : null,
      tracks,
      hasSubtitles: tracks.some(t => t.kind === 'subtitles' || t.kind === 'captions'),
      activeSubtitle: tracks.find(t => (t.kind === 'subtitles' || t.kind === 'captions') && t.mode === 'showing'),
    };
  });
}

async function getPageErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      Visual Player Check                 ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  // ── STEP 1: Homepage ─────────────────────────────────────────────────────────
  console.log('STEP 1: Homepage');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.locator('h1,h2').first().waitFor({ timeout: 20000 }); } catch {}
  await shot(page, '01-homepage');
  console.log(`  title: ${await page.title()}`);

  // ── STEP 2: Anime detail page ────────────────────────────────────────────────
  console.log('\nSTEP 2: Anime detail page (/anime/21459)');
  await page.goto('http://localhost:3000/anime/21459', { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.locator('h1').first().waitFor({ timeout: 20000 }); } catch {}
  await shot(page, '02-anime-detail');
  const h1Text = await page.locator('h1').first().textContent().catch(() => '(none)');
  console.log(`  h1: ${h1Text?.trim()}`);

  // ── STEP 3: Navigate to Watch page ───────────────────────────────────────────
  console.log('\nSTEP 3: Watch page (/watch/21459/1)');
  const t0 = Date.now();
  await page.goto('http://localhost:3000/watch/21459/1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`  domcontentloaded in ${Date.now() - t0}ms`);
  await shot(page, '03-watch-initial');

  // Wait for h1 (RSC resolves)
  try {
    await page.locator('h1').first().waitFor({ timeout: 30000 });
    const watchH1 = await page.locator('h1').first().textContent();
    console.log(`  h1: ${watchH1?.trim()}`);
  } catch {
    console.log('  ⚠️  h1 not found within 30s');
  }
  await shot(page, '04-watch-rsc-resolved');

  // ── STEP 4: Wait for video element to appear ─────────────────────────────────
  console.log('\nSTEP 4: Waiting for video element (up to 20s)...');
  let videoFound = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const count = await page.locator('video').count();
    if (count > 0) { videoFound = true; break; }
    process.stdout.write('.');
  }
  console.log(videoFound ? '\n  ✅ video element found' : '\n  ❌ video element NOT found');
  await shot(page, '05-watch-after-hydration');

  // ── STEP 5: Player state ─────────────────────────────────────────────────────
  console.log('\nSTEP 5: Player state');
  const state = await getPlayerState(page);
  if (!state.found) {
    console.log('  ❌ No <video> element in DOM');
    // Check what IS in the player area
    const playerHTML = await page.locator('main').innerHTML().catch(() => '');
    const hasLoader = playerHTML.includes('animate-spin') || playerHTML.includes('loading');
    const hasFallback = playerHTML.includes('demo') || playerHTML.includes('Demo');
    const hasError = playerHTML.includes('error') || playerHTML.includes('Error');
    console.log(`  Player area: loader=${hasLoader}, demoMode=${hasFallback}, error=${hasError}`);
  } else {
    const rsMap = ['HAVE_NOTHING','HAVE_METADATA','HAVE_CURRENT_DATA','HAVE_FUTURE_DATA','HAVE_ENOUGH_DATA'];
    const nsMap = ['EMPTY','IDLE','LOADING','NO_SOURCE'];
    console.log(`  src: ${state.src}`);
    console.log(`  readyState: ${state.readyState} (${rsMap[state.readyState] || '?'})`);
    console.log(`  networkState: ${state.networkState} (${nsMap[state.networkState] || '?'})`);
    console.log(`  paused: ${state.paused}, duration: ${state.duration}`);
    console.log(`  error: ${state.error ? JSON.stringify(state.error) : 'none'}`);
    console.log(`  textTracks: ${state.tracks.length}`);
    state.tracks.forEach(t => {
      console.log(`    - [${t.kind}] "${t.label}" lang=${t.language} mode=${t.mode} cues=${t.cues}`);
    });
    console.log(`  hasSubtitles: ${state.hasSubtitles}`);
    if (state.activeSubtitle) {
      console.log(`  ✅ Active subtitle: "${state.activeSubtitle.label}" (${state.activeSubtitle.language})`);
    } else if (state.hasSubtitles) {
      console.log('  ⚠️  Subtitle tracks present but none active (mode=showing)');
    } else {
      console.log('  ℹ️  No subtitle tracks (expected for fallback demo video)');
    }
  }

  // ── STEP 6: Try playing the video ─────────────────────────────────────────────
  if (state.found) {
    console.log('\nSTEP 6: Attempting to play video...');
    await page.evaluate(() => { document.querySelector('video')?.play().catch(() => {}); });
    await page.waitForTimeout(3000);
    const state2 = await getPlayerState(page);
    console.log(`  After play(): paused=${state2.paused}, readyState=${state2.readyState}, networkState=${state2.networkState}`);
    if (state2.error) console.log(`  error: ${JSON.stringify(state2.error)}`);
    await shot(page, '06-watch-playing');
  }

  // ── STEP 7: Check for subtitle button / UI controls ──────────────────────────
  console.log('\nSTEP 7: Player UI controls');
  const subtitleBtn = await page.locator('button').filter({ hasText: /subtitle|caption|cc|sub/i }).count();
  const qualityBtn  = await page.locator('button').filter({ hasText: /quality|720|480|1080/i }).count();
  const settingsBtn = await page.locator('button[title*="setting"], button[aria-label*="setting"]').count();
  console.log(`  Subtitle button: ${subtitleBtn > 0 ? '✅ found' : '❌ not found'}`);
  console.log(`  Quality button:  ${qualityBtn  > 0 ? '✅ found' : '❌ not found'}`);
  console.log(`  Settings button: ${settingsBtn > 0 ? '✅ found' : '❌ not found'}`);

  // ── STEP 8: Demo mode warning ─────────────────────────────────────────────────
  console.log('\nSTEP 8: Demo mode / fallback warning');
  const demoWarning = await page.locator('text=/demo|fallback|not available/i').count();
  console.log(`  Demo warning visible: ${demoWarning > 0 ? '✅ yes' : '❌ no (expected when isFallback=true)'}`);

  // ── STEP 9: Full page screenshot ─────────────────────────────────────────────
  await shot(page, '07-watch-final');

  // ── STEP 10: JS errors ───────────────────────────────────────────────────────
  console.log('\nSTEP 9: JS errors collected');
  const relevantErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('net::ERR_ABORTED') &&
    !e.includes('HMR')
  );
  if (relevantErrors.length === 0) {
    console.log('  ✅ No JS errors');
  } else {
    relevantErrors.forEach(e => console.log(`  ❌ ${e}`));
  }

  // ── STEP 10: API check ───────────────────────────────────────────────────────
  console.log('\nSTEP 10: Direct API check');
  const apiResp = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/video-sources/21459/1?title=One+Punch+Man');
      const j = await r.json();
      return { ok: r.ok, status: r.status, sources: j.sources?.length, isFallback: j.isFallback, provider: j.provider };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log(`  API: ${JSON.stringify(apiResp)}`);

  await browser.close();

  console.log(`\n✅ Screenshots saved to: test-results/visual-check/`);
  console.log('   01-homepage.png');
  console.log('   02-anime-detail.png');
  console.log('   03-watch-initial.png');
  console.log('   04-watch-rsc-resolved.png');
  console.log('   05-watch-after-hydration.png');
  console.log('   06-watch-playing.png (if video found)');
  console.log('   07-watch-final.png\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
