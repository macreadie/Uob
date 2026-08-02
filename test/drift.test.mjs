import { chromium } from 'playwright';

const URL = 'http://localhost:8777/demo/index.html';
const pass = [], fail = [];
const check = (name, ok, extra = '') => (ok ? pass : fail).push(`${name}${extra ? ' — ' + extra : ''}`);

const browser = await chromium.launch();

// ---------------------------------------------------------------- normal motion
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

check('no page errors', errors.length === 0, errors.join(' | '));

const upgraded = await page.evaluate(() => !!customElements.get('uob-course-drift'));
check('custom element defined', upgraded);

// Lane structure + seamless wrap period.
const geom = await page.evaluate(() => {
  const el = document.getElementById('drift');
  const stage = el.shadowRoot.querySelector('.stage');
  return {
    laneCount: el._lanes.length,
    stageWidth: stage.clientWidth,
    lanes: el._lanes.map((lane) => {
      const sets = [...lane.track.children];
      const firstCards = sets.map((s) => s.querySelector('.card').getBoundingClientRect().x);
      const deltas = firstCards.slice(1).map((x, i) => x - firstCards[i]);
      return {
        setWidth: lane.setWidth,
        copies: sets.length,
        deltas,
        totalWidth: lane.track.getBoundingClientRect().width,
        cardsPerSet: sets[0].querySelectorAll('.card').length,
        cloneAriaHidden: sets.slice(1).every((s) => s.getAttribute('aria-hidden') === 'true'),
      };
    }),
  };
});

check('three lanes built', geom.laneCount === 3, `got ${geom.laneCount}`);
check('courses split across lanes', geom.lanes.every((l) => l.cardsPerSet === 8),
  geom.lanes.map((l) => l.cardsPerSet).join('/'));
check('clones marked aria-hidden', geom.lanes.every((l) => l.cloneAriaHidden));

// The distance between successive copies must equal the wrap period exactly,
// otherwise the loop visibly jumps.
const seamOk = geom.lanes.every((l) =>
  l.deltas.every((d) => Math.abs(d - l.setWidth) < 0.5));
check('wrap period matches set spacing (seamless)', seamOk,
  JSON.stringify(geom.lanes.map((l) => ({ p: +l.setWidth.toFixed(1), d: l.deltas.map((x) => +x.toFixed(1)) }))));

// Track must overhang the stage on both sides so no gap is ever visible.
const coverOk = geom.lanes.every((l) => l.totalWidth >= geom.stageWidth + l.setWidth - 1);
check('track covers viewport + one set', coverOk,
  JSON.stringify(geom.lanes.map((l) => ({ total: +l.totalWidth.toFixed(0), need: +(geom.stageWidth + l.setWidth).toFixed(0) }))));

// Motion is happening and lanes alternate direction.
const motion = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const read = () => el._lanes.map((l) => l.offset);
  const a = read();
  await new Promise((r) => setTimeout(r, 500));
  const b = read();
  return { a, b, dirs: el._lanes.map((l) => l.dir) };
});
check('lanes are moving', motion.a.some((v, i) => Math.abs(v - motion.b[i]) > 1));
check('lanes alternate direction', JSON.stringify(motion.dirs) === JSON.stringify([-1, 1, -1]),
  JSON.stringify(motion.dirs));

// Offsets must stay inside [0, setWidth) — proof the modulo wrap holds.
const bounded = await page.evaluate(() =>
  document.getElementById('drift')._lanes.every((l) => l.offset >= 0 && l.offset < l.setWidth));
check('offsets stay within wrap period', bounded);

// Scroll coupling.
const coupled = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const before = el._scrollBoost;
  window.scrollBy(0, 700);
  await new Promise((r) => requestAnimationFrame(r));
  const during = el._scrollBoost;
  await new Promise((r) => setTimeout(r, 1500));
  const after = el._scrollBoost;
  return { before, during, after };
});
check('scroll injects velocity', Math.abs(coupled.during) > Math.abs(coupled.before),
  `boost ${coupled.before} -> ${coupled.during.toFixed(0)}`);
check('scroll inertia decays back to rest', Math.abs(coupled.after) < 1,
  `settled at ${coupled.after.toFixed(2)}`);

// Hover eases the rig toward a stop.
await page.mouse.move(720, 500);
const stage = await page.locator('#drift').evaluate((el) =>
  el.shadowRoot.querySelector('.stage').getBoundingClientRect());
await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
await page.waitForTimeout(700);
const hoverMul = await page.evaluate(() => document.getElementById('drift')._speedMul);
check('hover decelerates lanes', hoverMul < 0.3, `speedMul=${hoverMul.toFixed(3)}`);

// Constellation: hovering a card lights its subject siblings across all lanes.
const kin = await page.evaluate(() => {
  const el = document.getElementById('drift');
  const sr = el.shadowRoot;
  const card = sr.querySelector('.card');
  card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  const subject = card.dataset.subject;
  const lit = [...sr.querySelectorAll('.card.is-kin')];
  return {
    subject,
    lit: lit.length,
    allSameSubject: lit.every((c) => c.dataset.subject === subject),
    expected: [...sr.querySelectorAll(`.card[data-subject="${subject}"]`)].length,
  };
});
check('constellation lights all same-subject cards', kin.lit === kin.expected && kin.allSameSubject,
  `${kin.lit}/${kin.expected} lit for "${kin.subject}"`);

await page.mouse.move(10, 10);

// Filtering dims rather than removes, and announces a count.
const filtered = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const sr = el.shadowRoot;
  const input = sr.querySelector('.search__input');
  input.value = 'nursing';
  input.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 50));
  const cards = [...sr.querySelectorAll('.card')];
  return {
    total: cards.length,
    dim: cards.filter((c) => c.classList.contains('is-dim')).length,
    live: sr.querySelector('[aria-live]').textContent,
    dimTabbable: cards.filter((c) => c.classList.contains('is-dim') && c.tabIndex === 0).length,
    stillInDom: cards.length,
  };
});
check('non-matches dim, none removed', filtered.dim > 0 && filtered.dim < filtered.total,
  `${filtered.dim}/${filtered.total} dimmed`);
check('match count announced', /course/.test(filtered.live), filtered.live);
check('dimmed cards are not tab stops', filtered.dimTabbable === 0);

// Subject chip filter.
const chipped = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const sr = el.shadowRoot;
  sr.querySelector('.search__input').value = '';
  sr.querySelector('.search__input').dispatchEvent(new Event('input'));
  const chip = sr.querySelector('.chip');
  chip.click();
  await new Promise((r) => setTimeout(r, 50));
  const subject = chip.textContent.trim();
  const cards = [...sr.querySelectorAll('.card')];
  return {
    pressed: chip.getAttribute('aria-pressed'),
    subject,
    wrongLit: cards.filter((c) => !c.classList.contains('is-dim') && c.dataset.subject !== subject).length,
  };
});
check('chip toggles aria-pressed', chipped.pressed === 'true');
check('chip filters to its subject', chipped.wrongLit === 0,
  `${chipped.wrongLit} off-subject cards left lit for "${chipped.subject}"`);

// Clones must never be tab stops.
const tabbing = await page.evaluate(() => {
  const sr = document.getElementById('drift').shadowRoot;
  sr.querySelector('.chip').click(); // clear filter
  const clones = [...sr.querySelectorAll('[aria-hidden="true"] .card')];
  return { cloneTabbable: clones.filter((c) => c.tabIndex !== -1).length, cloneCount: clones.length };
});
check('cloned cards excluded from tab order', tabbing.cloneTabbable === 0,
  `${tabbing.cloneTabbable}/${tabbing.cloneCount}`);

// Pause control.
const paused = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const btn = el.shadowRoot.querySelector('.motion');
  btn.click();
  const a = el._lanes.map((l) => l.offset);
  await new Promise((r) => setTimeout(r, 400));
  const b = el._lanes.map((l) => l.offset);
  const frozen = a.every((v, i) => Math.abs(v - b[i]) < 0.01);
  btn.click();
  return { frozen, pressed: btn.getAttribute('aria-pressed') };
});
check('pause control freezes motion', paused.frozen);

// Keyboard focus pulls an off-screen card into view.
const kb = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const sr = el.shadowRoot;
  const lane = el._lanes[0];
  const cards = [...lane.set.querySelectorAll('.card')];
  const target = cards[cards.length - 1];
  const stage = sr.querySelector('.stage').getBoundingClientRect();
  const before = target.getBoundingClientRect();
  target.focus();
  await new Promise((r) => setTimeout(r, 60));
  const after = target.getBoundingClientRect();
  return {
    stageW: stage.width,
    beforeX: before.x, afterX: after.x, w: after.width,
    inView: after.x >= stage.x - 1 && after.x + after.width <= stage.x + stage.width + 1,
    focused: sr.activeElement === target,
  };
});
check('focus lands on the card', kb.focused);
check('focused card pulled into view', kb.inView,
  `x ${kb.beforeX.toFixed(0)} -> ${kb.afterX.toFixed(0)} (stage ${kb.stageW.toFixed(0)})`);

// Focusing an off-stage card must not shunt the host's hidden overflow.
const hostScroll = await page.evaluate(async () => {
  const el = document.getElementById('drift');
  const lane = el._lanes[1];
  const cards = [...lane.set.querySelectorAll('.card')];
  cards[cards.length - 1].focus();
  await new Promise((r) => setTimeout(r, 120));
  const head = el.shadowRoot.querySelector('.head__title').getBoundingClientRect();
  return { scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, headX: head.x };
});
check('host never holds a scroll offset', hostScroll.scrollLeft === 0 && hostScroll.scrollTop === 0,
  `left=${hostScroll.scrollLeft} top=${hostScroll.scrollTop}`);
check('header stays put when tabbing', hostScroll.headX > 0, `headX=${hostScroll.headX.toFixed(0)}`);

await page.evaluate(() => document.getElementById('drift').shadowRoot.activeElement?.blur());
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/claude-0/-home-user-Uob/93945315-9c46-562d-8141-6ec00368ecf5/scratchpad/shot-default.png' });

// Hover flip: back face should face the viewer.
await page.evaluate(() => {
  const sr = document.getElementById('drift').shadowRoot;
  sr.querySelector('.motion').click();
});
const flip = await page.evaluate(async () => {
  const sr = document.getElementById('drift').shadowRoot;
  const card = sr.querySelectorAll('.card')[2];
  card.focus();
  await new Promise((r) => setTimeout(r, 800));
  return getComputedStyle(card.querySelector('.card__inner')).transform;
});
check('card flips to reveal detail', /matrix3d|matrix/.test(flip) && flip !== 'none', flip.slice(0, 40));
await page.screenshot({ path: '/tmp/claude-0/-home-user-Uob/93945315-9c46-562d-8141-6ec00368ecf5/scratchpad/shot-flip.png' });

// ---------------------------------------------------------------- reduced motion
const rmPage = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const rmErrors = [];
rmPage.on('pageerror', (e) => rmErrors.push(String(e)));
await rmPage.goto(URL, { waitUntil: 'networkidle' });
await rmPage.waitForTimeout(500);

const rm = await rmPage.evaluate(async () => {
  const el = document.getElementById('drift');
  const sr = el.shadowRoot;
  const a = el._lanes.map((l) => l.track.style.transform);
  await new Promise((r) => setTimeout(r, 400));
  const b = el._lanes.map((l) => l.track.style.transform);
  const lane = sr.querySelector('.lane');
  return {
    staticAttr: el.hasAttribute('data-static'),
    rafStopped: el._raf === 0,
    noMotion: JSON.stringify(a) === JSON.stringify(b),
    copies: el._lanes.map((l) => l.track.children.length),
    overflowX: getComputedStyle(lane).overflowX,
    motionBtnHidden: getComputedStyle(sr.querySelector('.motion')).display === 'none',
    cardCount: sr.querySelectorAll('.card').length,
  };
});
check('reduced motion: no page errors', rmErrors.length === 0, rmErrors.join(' | '));
check('reduced motion: static attribute set', rm.staticAttr);
check('reduced motion: animation loop not running', rm.rafStopped && rm.noMotion);
check('reduced motion: clones dropped', rm.copies.every((c) => c === 1), JSON.stringify(rm.copies));
check('reduced motion: lanes natively scrollable', rm.overflowX === 'auto', rm.overflowX);
check('reduced motion: pause button hidden', rm.motionBtnHidden);
check('reduced motion: all courses still present', rm.cardCount === 24, String(rm.cardCount));

// scroll-snap will eat the lane's left inset unless scroll-padding matches it.
const inset = await rmPage.evaluate(() => {
  const lane = document.getElementById('drift').shadowRoot.querySelector('.lane');
  const pad = parseFloat(getComputedStyle(lane).paddingLeft);
  return { pad, scrollLeft: lane.scrollLeft, cardX: lane.querySelector('.card').getBoundingClientRect().x };
});
check('reduced motion: snapping preserves the left inset',
  inset.scrollLeft === 0 && Math.abs(inset.cardX - inset.pad) < 1,
  `pad=${inset.pad} scrollLeft=${inset.scrollLeft} cardX=${inset.cardX}`);
await rmPage.screenshot({ path: '/tmp/claude-0/-home-user-Uob/93945315-9c46-562d-8141-6ec00368ecf5/scratchpad/shot-reduced.png' });

// ---------------------------------------------------------------- mobile
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mob.goto(URL, { waitUntil: 'networkidle' });
await mob.waitForTimeout(500);
const mobile = await mob.evaluate(() => {
  const el = document.getElementById('drift');
  return {
    overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    copies: el._lanes.map((l) => l.track.children.length),
    covers: el._lanes.every((l) =>
      l.track.getBoundingClientRect().width >= el.shadowRoot.querySelector('.stage').clientWidth + l.setWidth - 1),
  };
});
check('mobile: no horizontal page overflow', mobile.overflow);
check('mobile: track still covers viewport', mobile.covers, JSON.stringify(mobile.copies));
await mob.screenshot({ path: '/tmp/claude-0/-home-user-Uob/93945315-9c46-562d-8141-6ec00368ecf5/scratchpad/shot-mobile.png' });

await browser.close();

console.log('\nPASS (' + pass.length + ')');
pass.forEach((p) => console.log('  ✓ ' + p));
if (fail.length) {
  console.log('\nFAIL (' + fail.length + ')');
  fail.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('\nAll checks passed.');
