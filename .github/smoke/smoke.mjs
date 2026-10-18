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

// Engine check: the perspective warp puts the corners and the center in the right places, and
// the shape guard refuses a bow-tie. The trapezoid is a wall seen from a projector below it.
{
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForFunction(() => (window.frameCount ?? 0) > 1);
  const problems = await page.evaluate(() => {
    const out = [];
    const near = (p, x, y) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6;
    const c = [[300, 100], [500, 100], [700, 500], [100, 500]].map(([x, y]) => createVector(x, y));
    const m = homography(c);
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
      if (!near(pointAt(m, u, v), c[i].x, c[i].y)) out.push(`corner ${i} is off`);
    });
    const mid = pointAt(m, 0.5, 0.5);
    if (!near(mid, 400, 200)) out.push(`center is (${mid.x}, ${mid.y}), not (400, 200) where the diagonals cross`);
    if (!isProperShape(c)) out.push('the trapezoid was refused');
    if (isProperShape([c[0], c[1], c[3], c[2]])) out.push('a bow-tie was allowed');
    return out;
  });
  await page.close();
  if (problems.length) {
    failed++;
    console.log('FAIL engine');
    for (const p of problems) console.log(`  ${p}`);
  } else {
    console.log('ok   engine (perspective warp and shape guard)');
  }
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
