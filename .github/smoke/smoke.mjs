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

// Physical E, F, and B must preserve projection-mode cursor behavior and browser shortcuts.
{
  const page = await browser.newPage();
  const problems = [];
  await page.goto(base);
  await page.waitForFunction(() => (window.frameCount ?? 0) > 1);
  const state = () => page.evaluate(() => ({
    editing, blackout, cursor: getComputedStyle(document.querySelector('canvas')).cursor,
  }));
  const check = async (label, wantEditing, wantBlackout, hidden) => {
    const actual = await state();
    if (actual.editing !== wantEditing || actual.blackout !== wantBlackout || (actual.cursor === 'none') !== hidden) {
      problems.push(`${label}: ${JSON.stringify(actual)}`);
    }
  };
  const physical = async (key) => page.keyboard.press(key);
  const localKey = (code, key, options = {}) => page.evaluate(({ code, key, options }) => {
    const event = new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true, ...options });
    return document.activeElement.dispatchEvent(event);
  }, { code, key, options });

  await check('initial state', true, false, false);
  await physical('e');
  await check('E hides handles and pointer', false, false, true);
  await physical('b');
  await check('B keeps the pointer hidden', false, true, true);
  await physical('e');
  await check('editing during blackout keeps the pointer hidden', true, true, true);
  await physical('b');
  await check('leaving blackout restores the pointer when editing', true, false, false);
  await physical('b');
  await check('blackout hides the pointer when editing', true, true, true);
  await physical('e');
  await physical('b');
  await check('leaving blackout keeps the pointer hidden when not editing', false, false, true);
  await physical('e');
  await physical('h');
  await check('H does not change projection modes', true, false, false);

  await localKey('KeyE', 'у');
  await localKey('KeyB', 'и');
  await check('Russian key values use physical codes', false, true, true);
  await localKey('KeyE', 'у');
  await localKey('KeyB', 'и');
  await check('Russian key values restore state', true, false, false);

  const russianFullscreen = await page.evaluate(() => {
    const original = window.fullscreen;
    let requested;
    let calls = 0;
    window.fullscreen = (value) => {
      if (typeof value === 'boolean') {
        requested = value;
        calls++;
      }
      return false;
    };
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyF', key: 'а', bubbles: true, cancelable: true,
    }));
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyF', key: 'f', ctrlKey: true, bubbles: true, cancelable: true,
    }));
    window.fullscreen = original;
    return requested === true && calls === 1;
  });
  if (!russianFullscreen) problems.push('Russian KeyF or Ctrl+F fullscreen behavior is wrong');

  await page.keyboard.down('e');
  await page.keyboard.down('e'); // A second keydown while held is a repeat, not a second toggle.
  await page.keyboard.up('e');
  await check('held E toggles only once', false, false, true);
  await physical('e');
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    const defaultAllowed = await localKey('KeyE', 'e', { [modifier]: true });
    if (!defaultAllowed) problems.push(`${modifier} combination was prevented`);
  }
  await check('modified shortcuts do not toggle modes', true, false, false);
  const defaultAllowed = await localKey('KeyF', 'f', { ctrlKey: true });
  if (!defaultAllowed) problems.push('Ctrl+F was prevented');

  await page.evaluate(() => {
    for (const tag of ['input', 'textarea', 'select']) document.body.appendChild(document.createElement(tag));
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.innerHTML = '<span>editable</span>';
    document.body.appendChild(editable);
  });
  for (const selector of ['input', 'textarea', 'select', '[contenteditable]']) {
    await page.focus(selector);
    await physical('e');
    await check(`${selector} keeps its keystrokes`, true, false, false);
  }
  await page.close();
  if (problems.length) {
    failed++;
    console.log('FAIL keyboard');
    for (const problem of problems) console.log(`  ${problem}`);
  } else {
    console.log('ok   keyboard (physical codes, original cursor behavior, repeats, modifiers, editable fields)');
  }
}

// The calibration control must not interfere with projection or the running art.
{
  const page = await browser.newPage();
  const problems = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto(base);
  await page.waitForFunction(() => (window.frameCount ?? 0) > 1);
  const button = page.locator('#calibration-grid-toggle');
  const controls = page.locator('#projection-controls');
  const check = (condition, message) => { if (!condition) problems.push(message); };
  if ((await button.count()) !== 1 || (await controls.count()) !== 1) {
    problems.push('the calibration button or shortcut hints are missing');
  } else {
    const pressed = async () => (await button.getAttribute('aria-pressed')) === 'true';
    const pixel = () => page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      return Array.from(ctx.getImageData(Math.floor(copy.width / 2 + 16), Math.floor(copy.height / 2 + 12), 1, 1).data).slice(0, 3);
    });
    const key = (code, value, options = {}) => page.evaluate(({ code, value, options }) => {
      return document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
        code, key: value, bubbles: true, cancelable: true, ...options,
      }));
    }, { code, value, options });
    await page.evaluate(() => {
      const original = window.drawArt;
      window.calibrationTestFrames = 0;
      window.drawArt = (g) => { window.calibrationTestFrames++; original(g); };
    });
    check(await button.isVisible() && !(await pressed()), 'button should start visible and off');
    const hints = await controls.innerText();
    for (const shortcut of ['G', 'П', 'E', 'У', 'F', 'А', 'B', 'И']) {
      check(hints.includes(shortcut), `shortcut ${shortcut} is missing from the page`);
    }
    await button.click();
    await page.waitForTimeout(200);
    check(await pressed(), 'clicking the button did not enable the grid');
    check((await pixel()).every((v) => v < 10), 'the displayed grid cell is not black');
    const artPixel = await page.evaluate(() => Array.from(art.canvas.getContext('2d').getImageData(425, 325, 1, 1).data));
    check(artPixel.slice(0, 3).some((v) => v > 20), 'the grid overwrote the running art buffer');
    const frames = await page.evaluate(() => window.calibrationTestFrames);
    await page.waitForTimeout(200);
    check((await page.evaluate(() => window.calibrationTestFrames)) > frames, 'art stopped while grid was visible');
    await page.keyboard.press('g');
    await page.waitForTimeout(200);
    check(!(await pressed()), 'G did not switch the grid off');
    check((await pixel()).some((v) => v > 20), 'the art did not reappear after the grid');

    await key('KeyG', 'п');
    check(await pressed(), 'Russian П did not switch the grid on');
    await page.keyboard.down('g');
    await page.keyboard.down('g');
    await page.keyboard.up('g');
    check(!(await pressed()), 'holding G did not toggle exactly once');
    const defaultAllowed = await key('KeyG', 'g', { ctrlKey: true });
    check(defaultAllowed && !(await pressed()), 'Ctrl+G was intercepted');
    await page.evaluate(() => {
      const field = document.createElement('input');
      field.id = 'calibration-test-input';
      document.body.appendChild(field);
      field.focus();
    });
    await page.keyboard.press('g');
    check(!(await pressed()), 'typing in an input toggled the grid');
    await page.evaluate(() => document.querySelector('#calibration-test-input').remove());

    await page.keyboard.press('g');
    await page.keyboard.press('e');
    check(!(await controls.isVisible()) && await pressed(), 'E must hide controls but keep the grid active');
    await page.keyboard.press('g');
    check(!(await pressed()), 'G must switch the grid off while controls are hidden');
    await page.keyboard.press('g');
    await page.keyboard.press('e');
    check(await controls.isVisible() && await pressed(), 'E must restore controls and the grid state');
    await page.keyboard.press('b');
    check(!(await controls.isVisible()), 'blackout must hide all controls');
    await page.keyboard.press('b');
    check(await controls.isVisible() && await pressed(), 'leaving blackout must restore the grid and controls');
    await page.keyboard.press('e');
    await page.keyboard.press('b');
    await page.keyboard.press('b');
    check(!(await controls.isVisible()), 'leaving blackout must respect hidden projection controls');
    await page.keyboard.press('e');

    // Move the surface under the button, then drag on the button: the surface must stay put.
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(320, 180, { steps: 5 });
    await page.mouse.up();
    const before = await page.evaluate(() => corners.map(({ x, y }) => ({ x, y })));
    const box = await button.boundingBox();
    const x = box.x + Math.min(box.width - 16, 80);
    const y = box.y + box.height - 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 8, y, { steps: 3 });
    await page.mouse.up();
    const after = await page.evaluate(() => corners.map(({ x, y }) => ({ x, y })));
    check(JSON.stringify(before) === JSON.stringify(after), 'dragging on the button moved the surface underneath');

    // A corner underneath the button must remain draggable.
    const corner = after[0];
    const wasPressed = await pressed();
    await page.mouse.click(corner.x, corner.y);
    check((await pressed()) === wasPressed, 'clicking a corner under the button toggled the grid');
    await button.focus();
    await page.keyboard.press('Space');
    check((await pressed()) !== wasPressed, 'keyboard activation of the button stopped working');
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + 30, corner.y + 35, { steps: 5 });
    await page.mouse.up();
    const movedCorner = await page.evaluate(() => ({ x: corners[0].x, y: corners[0].y }));
    check(Math.abs(movedCorner.x - corner.x - 30) < 2 && Math.abs(movedCorner.y - corner.y - 35) < 2,
      'a corner underneath the button could not be dragged');

    const hintBox = await page.locator('.shortcut-hints').boundingBox();
    await page.mouse.move(movedCorner.x, movedCorner.y);
    await page.mouse.down();
    await page.mouse.move(hintBox.x + 40, hintBox.y + hintBox.height / 2, { steps: 5 });
    await page.mouse.up();
    const underHint = await page.evaluate(() => ({ x: corners[0].x, y: corners[0].y }));
    await page.mouse.move(underHint.x, underHint.y);
    await page.mouse.down();
    await page.mouse.move(underHint.x + 25, underHint.y + 35, { steps: 5 });
    await page.mouse.up();
    const afterHint = await page.evaluate(() => ({ x: corners[0].x, y: corners[0].y }));
    check(Math.abs(afterHint.x - underHint.x - 25) < 2 && Math.abs(afterHint.y - underHint.y - 35) < 2,
      'a corner underneath the shortcut hints could not be dragged');
  }
  await page.close();
  problems.push(...errors);
  if (problems.length) {
    failed++;
    console.log('FAIL calibration controls');
    for (const problem of problems) console.log(`  ${problem}`);
  } else {
    console.log('ok   calibration controls (button, grid, G/П, projection, blackout, art and pointer)');
  }
}

// A user's art may declare drawArt with const or let instead of a function declaration.
for (const declaration of ['const', 'let']) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/art.js', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `${declaration} drawArt = (g) => g.background(73, 125, 205);`,
  }));
  await page.goto(base);
  await page.waitForFunction(() => (window.frameCount ?? 0) > 1);
  const color = await page.evaluate(() => Array.from(art.canvas.getContext('2d').getImageData(200, 200, 1, 1).data));
  await page.close();
  if (errors.length || color[0] !== 73 || color[1] !== 125 || color[2] !== 205) {
    failed++;
    console.log(`FAIL custom ${declaration} drawArt (${color.join(',')})`);
    for (const error of errors) console.log(`  ${error}`);
  } else {
    console.log(`ok   custom ${declaration} drawArt`);
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
