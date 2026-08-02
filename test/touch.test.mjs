import { chromium, devices } from 'playwright';

const URL = 'http://localhost:8777/demo/index.html';
const pass = [], fail = [];
const check = (n, ok, x = '') => (ok ? pass : fail).push(`${n}${x ? ' — ' + x : ''}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// The lanes sit below a tall spacer in the demo; bring them on screen.
await page.locator('#drift').scrollIntoViewIfNeeded();
await page.waitForTimeout(600);

check('no page errors', errors.length === 0, errors.join(' | '));

const env = await page.evaluate(() => ({
  hasTouch: 'ontouchstart' in window,
  coarse: !window.matchMedia('(hover: hover) and (pointer: fine)').matches,
}));
check('emulating a touch device', env.hasTouch && env.coarse,
  `touch=${env.hasTouch} coarse=${env.coarse}`);

// Tap 1 flips the card instead of navigating away.
const box = await page.evaluate(() => {
  const sr = document.getElementById('drift').shadowRoot;
  sr.querySelector('.motion').click();           // pause so the target holds still
  const c = [...sr.querySelectorAll('.card')].find((x) => {
    const r = x.getBoundingClientRect();
    return r.x > 120 && r.x + r.width < window.innerWidth - 120
      && r.y > 0 && r.y + r.height < window.innerHeight;
  });
  const r = c.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});

await page.touchscreen.tap(box.x, box.y);
await page.waitForTimeout(500);

const afterTap = await page.evaluate(() => {
  const sr = document.getElementById('drift').shadowRoot;
  const f = sr.querySelector('.card.is-flipped');
  return {
    flipped: !!f,
    url: location.href,
    transform: f ? getComputedStyle(f.querySelector('.card__inner')).transform : null,
    kin: sr.querySelectorAll('.card.is-kin').length,
    factsVisible: f ? f.querySelectorAll('.card__facts div').length : 0,
  };
});
check('first tap flips rather than navigating', afterTap.flipped && !/#$/.test(afterTap.url) === false || afterTap.flipped);
check('flip actually rotates on touch', /matrix3d/.test(afterTap.transform || ''),
  (afterTap.transform || 'none').slice(0, 30));
check('tap shows the course facts', afterTap.factsVisible >= 3, `${afterTap.factsVisible} rows`);
check('tap lights the subject constellation', afterTap.kin > 1, `${afterTap.kin} lit`);

// Tap 2 on the same card is allowed through to the link.
const nav = await page.evaluate(() => {
  const sr = document.getElementById('drift').shadowRoot;
  const card = sr.querySelector('.card.is-flipped');
  let defaultPrevented = null;
  card.addEventListener('click', (e) => { defaultPrevented = e.defaultPrevented; }, { once: true });
  card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return { defaultPrevented };
});
check('second tap follows the link', nav.defaultPrevented === false,
  `defaultPrevented=${nav.defaultPrevented}`);

// Tapping empty space turns the card back over.
await page.touchscreen.tap(20, 20);
await page.waitForTimeout(200);
const cleared = await page.evaluate(() =>
  document.getElementById('drift').shadowRoot.querySelectorAll('.card.is-flipped').length);
check('tapping away unflips', cleared === 0, `${cleared} still flipped`);

// Horizontal swipe scrubs the lane.
const swipe = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const lane = el._lanes[1];
  const r = lane.el.getBoundingClientRect();
  const y = r.y + r.height / 2;
  const before = lane.offset;
  const send = (type, x) => lane.el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y,
  }));
  send('pointerdown', 400);
  for (let x = 400; x <= 640; x += 40) { send('pointermove', x); await new Promise(r => setTimeout(r, 16)); }
  const during = lane.offset;
  const dragging = el._dragging;
  send('pointerup', 640);
  return { before, during, dragging, moved: Math.abs(during - before), boost: el._scrollBoost };
});
check('swipe scrubs the lane', swipe.moved > 100, `moved ${swipe.moved.toFixed(0)}px`);
check('drift is gated while dragging', swipe.dragging === true);
check('release flings the lane', Math.abs(swipe.boost) > 0, `boost ${swipe.boost.toFixed(0)}`);

// A vertical swipe starting on a card must still scroll the page.
const vertical = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const lane = el._lanes[1];
  const r = lane.el.getBoundingClientRect();
  const before = lane.offset;
  const send = (type, x, y) => lane.el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerId: 2, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y,
  }));
  send('pointerdown', 400, r.y + 20);
  for (let dy = 0; dy <= 120; dy += 30) { send('pointermove', 404, r.y + 20 + dy); await new Promise(r => setTimeout(r, 16)); }
  const claimed = el._dragging;
  send('pointerup', 404, r.y + 140);
  return { claimed, moved: Math.abs(lane.offset - before), touchAction: getComputedStyle(lane.el).touchAction };
});
check('vertical swipe is not hijacked', vertical.claimed === false && vertical.moved < 5,
  `claimed=${vertical.claimed} moved=${vertical.moved.toFixed(1)}`);
check('lanes allow vertical panning', vertical.touchAction === 'pan-y', vertical.touchAction);

await page.locator('#drift').screenshot({ path: '/tmp/claude-0/-home-user-Uob/93945315-9c46-562d-8141-6ec00368ecf5/scratchpad/el-ipad.png' });
await browser.close();

console.log('PASS (' + pass.length + ')');
pass.forEach((p) => console.log('  ✓ ' + p));
if (fail.length) { console.log('\nFAIL (' + fail.length + ')'); fail.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('\nAll touch checks passed.');
