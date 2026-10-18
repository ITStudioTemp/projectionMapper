// Smoke test: load the page once per art file and fail on any browser error.
// node --check only proves a file parses. This proves it runs: a typo in a p5
// function name, or drawArt() missing, throws here and fails the job.
//
// Run from the repo root: node .github/smoke/smoke.mjs
// Needs playwright installed (the CI job installs it; the repo has no package.json).

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const RUN_MS = 2000; // Long enough for setup() and about 100 draw() frames

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}/`;

const examples = (await readdir(join(ROOT, 'examples'))).filter((f) => f.endsWith('.js'));
const artFiles = ['art.js', ...examples.map((f) => `examples/${f}`)];

const browser = await chromium.launch();
let failed = 0;

// Blackout check: B turns every pixel black while the art keeps running, and B again brings it back.
{
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForFunction(() => (window.frameCount ?? 0) > 1);
  // Count lit pixels on the main canvas. Anything above 0 is light on the wall
  const lit = () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    const copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) n++;
    return n;
  });
  // Wrap drawArt() so we can count how often it runs during the blackout
  await page.evaluate(() => {
    const original = window.drawArt;
    window.artCalls = 0;
    window.drawArt = (g) => { window.artCalls++; original(g); };
  });
  const problems = [];
  if ((await lit()) === 0) problems.push('the art is not showing before the blackout');
  await page.keyboard.press('b');
  await page.waitForTimeout(300);
  const callsBefore = await page.evaluate(() => window.artCalls);
  await page.waitForTimeout(300);
  if ((await lit()) !== 0) problems.push('B did not turn every pixel black');
  if ((await page.evaluate(() => window.artCalls)) <= callsBefore) problems.push('the art stopped running during the blackout');
  await page.keyboard.press('b');
  await page.waitForTimeout(300);
  if ((await lit()) === 0) problems.push('B again did not bring the art back');
  await page.close();
  if (problems.length) {
    failed++;
    console.log('FAIL blackout');
    for (const p of problems) console.log(`  ${p}`);
  } else {
    console.log('ok   blackout (B goes dark, art keeps running, B comes back)');
  }
}

for (const file of artFiles) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

  // Serve this file in place of art.js, the same swap the index.html comment tells attendees to make.
  await page.route('**/art.js', async (route) => {
    route.fulfill({ contentType: 'text/javascript', body: await readFile(join(ROOT, file)) });
  });

  await page.goto(base);
  await page.waitForTimeout(RUN_MS);
  const frames = await page.evaluate(() => window.frameCount ?? 0);
  await page.close();

  if (errors.length || frames < 2) {
    failed++;
    console.log(`FAIL ${file}`);
    if (frames < 2) console.log(`  draw() ran ${frames} times`);
    for (const e of errors) console.log(`  ${e}`);
  } else {
    console.log(`ok   ${file} (${frames} frames)`);
  }
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
