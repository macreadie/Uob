/**
 * <uob-course-drift> — a parallax depth conveyor for course listings.
 *
 * Courses drift across several lanes at different apparent depths. The centre
 * lane sits nearest the viewer (largest, brightest, fastest); outer lanes
 * recede. Lane velocity is coupled to page scroll velocity with inertia, so
 * the rig surges as the reader scrolls and settles back to its base drift.
 *
 * Zero dependencies. Shadow DOM, so host page styles cannot leak in or out.
 *
 *   <uob-course-drift heading="Find your course">
 *     <script type="application/json">[ ...courses... ]</script>
 *   </uob-course-drift>
 *
 * or, loading from an endpoint:
 *
 *   <uob-course-drift src="/data/courses.json"></uob-course-drift>
 *
 * Attributes
 *   src              URL returning a JSON array of courses.
 *   lanes            Number of lanes. Default 3.
 *   speed            Base drift of the front lane, px/sec. Default 34.
 *   scroll-coupling  How hard scrolling drives the lanes, 0 disables. Default 0.55.
 *   heading          Section heading text.
 *   intro            Supporting line under the heading.
 *   no-filters       Hide the search field and subject chips.
 *
 * Course shape — only `title` and `url` are required:
 *   { title, url, subject, level, award, duration, campus, ucas, entry }
 */

const SUBJECT_HUES = [198, 32, 276, 152, 8, 224, 96, 316, 46, 178, 258, 128];

const TEMPLATE_CSS = `
:host {
  /* ---- Brand hooks. Override these to match brighton.ac.uk. ---- */
  --uob-bg: #0d1b2a;
  --uob-bg-2: #12263a;
  --uob-fg: #ffffff;
  --uob-fg-muted: rgba(255, 255, 255, 0.66);
  --uob-accent: #00b8d4;
  --uob-card: rgba(255, 255, 255, 0.06);
  --uob-card-hover: rgba(255, 255, 255, 0.1);
  --uob-border: rgba(255, 255, 255, 0.14);
  --uob-radius: 18px;
  --uob-font: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --uob-font-display: var(--uob-font);

  /* ---- Geometry. ---- */
  --uob-card-w: 268px;
  --uob-card-h: 210px;
  --uob-gap: 18px;
  --uob-lane-gap: 16px;
  --uob-edge: clamp(20px, 4vw, 40px);

  display: block;
  position: relative;
  overflow: hidden;
  padding: clamp(32px, 5vw, 72px) 0;
  background:
    radial-gradient(120% 90% at 50% -10%, var(--uob-bg-2) 0%, transparent 60%),
    var(--uob-bg);
  color: var(--uob-fg);
  font-family: var(--uob-font);
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after { box-sizing: border-box; }

.head {
  max-width: 1180px;
  margin: 0 auto clamp(24px, 3vw, 40px);
  padding: 0 var(--uob-edge);
}

.head__title {
  margin: 0;
  font-family: var(--uob-font-display);
  font-size: clamp(28px, 4.4vw, 52px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.head__intro {
  margin: 12px 0 0;
  max-width: 46ch;
  font-size: clamp(15px, 1.4vw, 18px);
  line-height: 1.5;
  color: var(--uob-fg-muted);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.search {
  position: relative;
  flex: 1 1 260px;
  max-width: 380px;
}

.search__input {
  width: 100%;
  padding: 11px 14px 11px 40px;
  border: 1px solid var(--uob-border);
  border-radius: 999px;
  background: var(--uob-card);
  color: var(--uob-fg);
  font: inherit;
  font-size: 15px;
}

.search__input::placeholder { color: var(--uob-fg-muted); }

.search__input:focus-visible {
  outline: 2px solid var(--uob-accent);
  outline-offset: 2px;
}

.search__icon {
  position: absolute;
  top: 50%;
  left: 14px;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  opacity: 0.6;
  pointer-events: none;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  padding: 8px 15px;
  border: 1px solid var(--uob-border);
  border-radius: 999px;
  background: transparent;
  color: var(--uob-fg-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.chip:hover { background: var(--uob-card); color: var(--uob-fg); }

.chip:focus-visible {
  outline: 2px solid var(--uob-accent);
  outline-offset: 2px;
}

.chip[aria-pressed="true"] {
  border-color: transparent;
  background: var(--uob-accent);
  color: #04121b;
  font-weight: 600;
}

.chip__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 7px;
  border-radius: 50%;
  background: hsl(var(--h, 200) 70% 58%);
  vertical-align: 1px;
}

.motion {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 8px 15px;
  border: 1px solid var(--uob-border);
  border-radius: 999px;
  background: transparent;
  color: var(--uob-fg-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.motion:hover { color: var(--uob-fg); }

.motion:focus-visible {
  outline: 2px solid var(--uob-accent);
  outline-offset: 2px;
}

.motion__glyph { width: 12px; height: 12px; fill: currentColor; }
.motion__glyph--play { display: none; }
:host([data-paused]) .motion__glyph--play { display: block; }
:host([data-paused]) .motion__glyph--pause { display: none; }

/* On narrow screens a wrapped chip list burns five rows of height, so it
   becomes one swipeable row bleeding to the edges instead. */
@media (max-width: 640px) {
  .chips {
    flex: 1 1 100%;
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    margin-inline: calc(var(--uob-edge) * -1);
    padding-inline: var(--uob-edge);
    padding-bottom: 2px;
  }

  .chips::-webkit-scrollbar { display: none; }
  .chip { white-space: nowrap; }
}

/* ---- The stage. ---- */

.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--uob-lane-gap);
  padding: 10px 0;
  /* Feather the ends so cards dissolve rather than clip. */
  -webkit-mask-image: linear-gradient(to right, transparent, #000 9%, #000 91%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 9%, #000 91%, transparent);
}

.lane {
  position: relative;
  height: calc(var(--uob-card-h) * var(--scale, 1));
  opacity: var(--lane-opacity, 1);
  /* Horizontal gestures are ours to scrub with; vertical still scrolls
     the page, so the element never traps a touch user. */
  touch-action: pan-y;
}

.lane__track {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  /* This gap is the only spacing between sets; the wrap period is measured
     as one set's width plus this value. Do not add margins to .set. */
  gap: var(--uob-gap);
  height: 100%;
  transform: translate3d(0, 0, 0);
  will-change: transform;
}

.set {
  display: flex;
  flex: 0 0 auto;
  gap: var(--uob-gap);
  height: 100%;
}

/* ---- Cards. ---- */

.card {
  position: relative;
  flex: 0 0 auto;
  width: calc(var(--uob-card-w) * var(--scale, 1));
  height: 100%;
  perspective: 900px;
  text-decoration: none;
  color: inherit;
  border-radius: var(--uob-radius);
  transition: opacity 0.35s ease, filter 0.35s ease;
}

.card:focus-visible {
  outline: 2px solid var(--uob-accent);
  outline-offset: 4px;
}

.card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Hover only where hovering exists. On touch, .is-flipped does the work —
   otherwise iOS fires a sticky phantom hover and the card sticks face-down. */
@media (hover: hover) and (pointer: fine) {
  .card:hover .card__inner { transform: rotateY(180deg); }
}

.card:focus-visible .card__inner,
.card.is-flipped .card__inner { transform: rotateY(180deg); }

.card__face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: calc(18px * var(--scale, 1));
  border: 1px solid var(--uob-border);
  border-radius: var(--uob-radius);
  background: var(--uob-card);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
}

.card__face--back {
  transform: rotateY(180deg);
  background:
    linear-gradient(155deg, hsl(var(--h) 62% 26%) 0%, hsl(var(--h) 55% 15%) 100%);
  border-color: hsl(var(--h) 60% 45% / 0.5);
}

/* Generated artwork — no image assets required. */
.card__art {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(90% 70% at 15% 0%, hsl(var(--h) 78% 52% / 0.55) 0%, transparent 62%),
    linear-gradient(200deg, hsl(calc(var(--h) + 28) 70% 42% / 0.42) 0%, transparent 58%);
  opacity: 0.9;
  transition: opacity 0.4s ease;
}

.card__art::after {
  content: "";
  position: absolute;
  inset: -40% -10% auto auto;
  width: 150px;
  height: 150px;
  border: 1px solid hsl(var(--h) 80% 70% / 0.32);
  border-radius: 50%;
}

.card__body {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
}

/* A pill rather than bare text: it carries its own background, so it stays
   legible on a light or a dark card without knowing which it is on. */
.card__level {
  align-self: flex-start;
  padding: calc(4px * var(--scale, 1)) calc(9px * var(--scale, 1));
  border-radius: 999px;
  background: hsl(var(--h) 58% 27%);
  color: #fff;
  font-size: calc(10px * var(--scale, 1));
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.card__title {
  margin: auto 0 0;
  font-family: var(--uob-font-display);
  font-size: calc(21px * var(--scale, 1));
  font-weight: 700;
  line-height: 1.16;
  letter-spacing: -0.01em;
}

.card__subject {
  margin-top: 8px;
  font-size: calc(13px * var(--scale, 1));
  color: var(--uob-fg-muted);
}

.card__facts {
  margin: 0;
  font-size: calc(13px * var(--scale, 1));
  line-height: 1.35;
}

.card__facts div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid hsl(var(--h) 60% 80% / 0.16);
}

.card__facts dt { color: hsl(var(--h) 70% 82%); }
.card__facts dd { margin: 0; font-weight: 600; text-align: right; }

.card__cta {
  margin-top: auto;
  padding-top: 12px;
  font-size: calc(14px * var(--scale, 1));
  font-weight: 600;
}

.card__cta span { color: hsl(var(--h) 90% 80%); }

/* Constellation: every card of the hovered subject lifts with it. */
.card.is-kin .card__face--front {
  border-color: hsl(var(--h) 80% 62% / 0.85);
  background: var(--uob-card-hover);
}

.card.is-kin .card__art { opacity: 1; }

/* Filtering dims rather than removes, so the drift never stutters. */
.card.is-dim {
  opacity: 0.16;
  filter: grayscale(1);
}

.card.is-dim .card__inner { transform: none; }

.empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--uob-fg-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

/* ---- Reduced motion: no drift, no flip, native scrolling instead. ---- */
:host([data-static]) .stage {
  -webkit-mask-image: none;
  mask-image: none;
}

:host([data-static]) .motion { display: none; }

:host([data-static]) .lane {
  height: auto;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  padding: 0 var(--uob-edge) 8px;
  /* Without this, snapping pulls the first card flush to the scrollport and
     silently eats the left inset. */
  scroll-padding-inline: var(--uob-edge);
  opacity: 1;
  touch-action: auto;
}

:host([data-static]) .lane__track {
  position: static;
  transform: none;
  will-change: auto;
}

:host([data-static]) .card {
  height: calc(var(--uob-card-h) * var(--scale, 1));
  scroll-snap-align: start;
}

:host([data-static]) .card__inner { transform: none !important; }

:host([data-static]) .card__face--back {
  transform: none;
  opacity: 0;
  transition: opacity 0.25s ease;
}

:host([data-static]) .card:hover .card__face--back,
:host([data-static]) .card:focus-within .card__face--back { opacity: 1; }
`;

class UobCourseDrift extends HTMLElement {
  static get observedAttributes() {
    return ['heading', 'intro', 'src', 'lanes', 'no-filters'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._courses = [];
    this._lanes = [];
    this._hues = new Map();
    this._activeSubjects = new Set();
    this._query = '';
    this._paused = false;
    this._reduced = false;

    // Motion state.
    this._raf = 0;
    this._lastFrame = 0;
    this._lastScrollY = 0;
    this._scrollBoost = 0;
    this._speedMul = 1;      // eased toward _speedMulTarget
    this._speedMulTarget = 1;

    this._onScroll = this._onScroll.bind(this);
    this._tick = this._tick.bind(this);

    // Tabbing to a card that sits outside the stage makes the browser scroll
    // it into view, which shunts this host's hidden overflow sideways and
    // displaces the whole element. We reposition the lane ourselves in
    // _bringIntoView, so the host must never hold a scroll offset.
    this.addEventListener('scroll', () => {
      if (this.scrollLeft) this.scrollLeft = 0;
      if (this.scrollTop) this.scrollTop = 0;
    });
  }

  connectedCallback() {
    if (!this.isConnected) return;

    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reduced = this._motionQuery.matches;
    this._onMotionChange = () => {
      this._reduced = this._motionQuery.matches;
      this._applyMotionMode();
    };
    this._motionQuery.addEventListener('change', this._onMotionChange);

    // A tapped-open card must close when the reader taps anywhere else on the
    // page, not just elsewhere inside this element.
    this._onDocPointer = (e) => {
      if (!this._stage?.querySelector('.card.is-flipped')) return;
      const onCard = e.composedPath()
        .some((n) => n.nodeType === 1 && n.classList?.contains('card'));
      if (!onCard) this._unflip();
    };
    document.addEventListener('pointerdown', this._onDocPointer, true);

    this._resizeObserver = new ResizeObserver(() => this._layout());

    this._load().then(() => {
      this._render();
      this._applyMotionMode();
    });
  }

  disconnectedCallback() {
    this._stop();
    window.removeEventListener('scroll', this._onScroll);
    this._resizeObserver?.disconnect();
    this._motionQuery?.removeEventListener('change', this._onMotionChange);
    if (this._onDocPointer) {
      document.removeEventListener('pointerdown', this._onDocPointer, true);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.shadowRoot.childElementCount) return;
    if (name === 'src') {
      this._load().then(() => {
        this._render();
        this._applyMotionMode();
      });
    } else {
      this._render();
      this._applyMotionMode();
    }
  }

  /** Replace the course list programmatically. */
  set courses(list) {
    this._courses = Array.isArray(list) ? list : [];
    if (this.shadowRoot.childElementCount) {
      this._render();
      this._applyMotionMode();
    }
  }

  get courses() {
    return this._courses;
  }

  // ---------------------------------------------------------------- data

  async _load() {
    const src = this.getAttribute('src');
    if (src) {
      try {
        const res = await fetch(src, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this._courses = Array.isArray(data) ? data : [];
        return;
      } catch (err) {
        console.error('[uob-course-drift] could not load', src, err);
        this._courses = [];
        return;
      }
    }

    const inline = this.querySelector('script[type="application/json"]');
    if (inline) {
      try {
        this._courses = JSON.parse(inline.textContent) || [];
      } catch (err) {
        console.error('[uob-course-drift] inline JSON is not valid', err);
        this._courses = [];
      }
    }
  }

  _hueFor(subject) {
    const key = subject || 'Other';
    if (!this._hues.has(key)) {
      this._hues.set(key, SUBJECT_HUES[this._hues.size % SUBJECT_HUES.length]);
    }
    return this._hues.get(key);
  }

  // ---------------------------------------------------------------- render

  _render() {
    const laneCount = Math.max(1, parseInt(this.getAttribute('lanes'), 10) || 3);
    const heading = this.getAttribute('heading') || 'Explore our courses';
    const intro = this.getAttribute('intro') || '';
    const showFilters = !this.hasAttribute('no-filters');

    this._stop();
    this._resizeObserver.disconnect();
    this._hues.clear();
    this._lanes = [];
    this._stage = null;

    const root = this.shadowRoot;
    root.textContent = '';

    const style = document.createElement('style');
    style.textContent = TEMPLATE_CSS;
    root.append(style);

    const region = document.createElement('section');
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', heading);

    // -- header ------------------------------------------------------
    const head = document.createElement('div');
    head.className = 'head';

    const h2 = document.createElement('h2');
    h2.className = 'head__title';
    h2.textContent = heading;
    head.append(h2);

    if (intro) {
      const p = document.createElement('p');
      p.className = 'head__intro';
      p.textContent = intro;
      head.append(p);
    }

    const controls = document.createElement('div');
    controls.className = 'controls';

    if (showFilters) {
      controls.append(this._buildSearch(), this._buildChips());
    }
    controls.append(this._buildMotionToggle());
    head.append(controls);

    // Screen readers get a running count; sighted users see the dimming.
    this._live = document.createElement('p');
    this._live.className = 'sr-only';
    this._live.setAttribute('aria-live', 'polite');
    head.append(this._live);

    region.append(head);

    // -- stage -------------------------------------------------------
    const stage = document.createElement('div');
    stage.className = 'stage';
    this._stage = stage;

    if (!this._courses.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No courses to show.';
      stage.append(empty);
      region.append(stage);
      root.append(region);
      return;
    }

    // Round-robin so adjacent lanes never carry the same subject run.
    const buckets = Array.from({ length: laneCount }, () => []);
    this._courses.forEach((course, i) => buckets[i % laneCount].push(course));

    // Depth peaks in the middle: the centre lane reads as nearest.
    const centre = (laneCount - 1) / 2;
    const maxDepth = Math.max(centre, 0.0001);

    this._lanes = buckets.map((bucket, i) => {
      const depth = Math.abs(i - centre) / maxDepth;
      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.style.setProperty('--scale', (1 - depth * 0.16).toFixed(3));
      lane.style.setProperty('--lane-opacity', (1 - depth * 0.3).toFixed(3));

      const track = document.createElement('div');
      track.className = 'lane__track';

      const set = document.createElement('div');
      set.className = 'set';
      bucket.forEach((course) => set.append(this._buildCard(course)));
      track.append(set);

      lane.append(track);
      stage.append(lane);

      return {
        el: lane,
        track,
        set,
        offset: 0,
        setWidth: 0,
        dir: i % 2 === 0 ? -1 : 1,
        speedMul: 1 - depth * 0.42,
      };
    });

    region.append(stage);
    root.append(region);

    // Slowing on hover reads as friction; a hard stop reads as a bug.
    stage.addEventListener('pointerenter', () => { this._speedMulTarget = 0.12; });
    stage.addEventListener('pointerleave', () => {
      this._speedMulTarget = 1;
      this._clearKin();
    });

    // Delegated, because cloneNode does not carry listeners to the copies.
    stage.addEventListener('pointerover', (e) => {
      const card = e.target.closest?.('.card');
      if (card) this._markKin(card.dataset.subject);
      else this._clearKin();
    });

    this._bindDrag(stage);

    stage.addEventListener('focusin', (e) => {
      this._speedMulTarget = 0.12;
      const card = e.target.closest?.('.card');
      if (card) {
        this._markKin(card.dataset.subject);
        this._bringIntoView(card);
      }
    });
    stage.addEventListener('focusout', (e) => {
      if (!stage.contains(e.relatedTarget)) {
        this._speedMulTarget = 1;
        this._clearKin();
      }
    });

    this._resizeObserver.observe(this);
  }

  _buildSearch() {
    const wrap = document.createElement('div');
    wrap.className = 'search';

    const label = document.createElement('label');
    label.className = 'sr-only';
    label.htmlFor = 'uob-drift-search';
    label.textContent = 'Search courses';

    const input = document.createElement('input');
    input.className = 'search__input';
    input.id = 'uob-drift-search';
    input.type = 'search';
    input.placeholder = 'Search courses…';
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      this._query = input.value.trim().toLowerCase();
      this._applyFilter();
    });

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'search__icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M10 2a8 8 0 105.3 14L21 21.3 22.3 20l-5.6-5.6A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z'
    );
    path.setAttribute('fill', 'currentColor');
    icon.append(path);

    wrap.append(label, icon, input);
    return wrap;
  }

  _buildChips() {
    const list = document.createElement('ul');
    list.className = 'chips';

    const subjects = [...new Set(this._courses.map((c) => c.subject).filter(Boolean))];

    subjects.forEach((subject) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('aria-pressed', 'false');
      btn.style.setProperty('--h', String(this._hueFor(subject)));

      const dot = document.createElement('span');
      dot.className = 'chip__dot';
      dot.setAttribute('aria-hidden', 'true');

      btn.append(dot, document.createTextNode(subject));
      btn.addEventListener('click', () => {
        if (this._activeSubjects.has(subject)) {
          this._activeSubjects.delete(subject);
          btn.setAttribute('aria-pressed', 'false');
        } else {
          this._activeSubjects.add(subject);
          btn.setAttribute('aria-pressed', 'true');
        }
        this._applyFilter();
      });

      li.append(btn);
      list.append(li);
    });

    return list;
  }

  _buildMotionToggle() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'motion';
    btn.setAttribute('aria-pressed', 'false');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'motion__glyph motion__glyph--pause');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    const bars = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bars.setAttribute('d', 'M1 0h3v12H1zM8 0h3v12H8z');
    svg.append(bars);

    const svgPlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgPlay.setAttribute('class', 'motion__glyph motion__glyph--play');
    svgPlay.setAttribute('viewBox', '0 0 12 12');
    svgPlay.setAttribute('aria-hidden', 'true');
    const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tri.setAttribute('d', 'M1 0l11 6-11 6z');
    svgPlay.append(tri);

    const text = document.createElement('span');
    text.textContent = 'Pause motion';

    btn.append(svg, svgPlay, text);
    btn.addEventListener('click', () => {
      this._paused = !this._paused;
      btn.setAttribute('aria-pressed', String(this._paused));
      text.textContent = this._paused ? 'Play motion' : 'Pause motion';
      this.toggleAttribute('data-paused', this._paused);
    });

    return btn;
  }

  _buildCard(course) {
    const hue = this._hueFor(course.subject);

    const card = document.createElement('a');
    card.className = 'card';
    card.href = course.url || '#';
    card.style.setProperty('--h', String(hue));
    card.dataset.subject = course.subject || 'Other';
    card.dataset.haystack = [
      course.title, course.subject, course.level,
      course.award, course.campus, course.ucas,
    ].filter(Boolean).join(' ').toLowerCase();

    const inner = document.createElement('div');
    inner.className = 'card__inner';

    // -- front --
    const front = document.createElement('div');
    front.className = 'card__face card__face--front';

    const art = document.createElement('span');
    art.className = 'card__art';
    art.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'card__body';

    if (course.level) {
      const level = document.createElement('span');
      level.className = 'card__level';
      level.textContent = course.level;
      body.append(level);
    }

    const title = document.createElement('h3');
    title.className = 'card__title';
    title.textContent = course.title || 'Untitled course';
    body.append(title);

    if (course.subject) {
      const subject = document.createElement('span');
      subject.className = 'card__subject';
      subject.textContent = course.subject;
      body.append(subject);
    }

    front.append(art, body);

    // -- back --
    const back = document.createElement('div');
    back.className = 'card__face card__face--back';

    const facts = document.createElement('dl');
    facts.className = 'card__facts';
    [
      ['Duration', course.duration],
      ['Campus', course.campus],
      ['UCAS code', course.ucas],
      ['Entry', course.entry],
    ].forEach(([term, value]) => {
      if (!value) return;
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value;
      row.append(dt, dd);
      facts.append(row);
    });

    const cta = document.createElement('span');
    cta.className = 'card__cta';
    cta.append(
      document.createTextNode('View course '),
      Object.assign(document.createElement('span'), { textContent: '→' })
    );

    back.append(facts, cta);

    inner.append(front, back);
    card.append(inner);
    return card;
  }

  // ---------------------------------------------------------------- touch

  /** True on touch and other devices with no real hover. */
  get _isCoarse() {
    return !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  /**
   * Direct manipulation: drag or swipe a lane to scrub it, and release to
   * fling. Without this a touch user can only watch — every other affordance
   * in the element is driven by hover.
   */
  _bindDrag(stage) {
    let drag = null;

    stage.addEventListener('pointerdown', (e) => {
      // Static mode uses native scrolling; leave it alone.
      if (this._reduced || !e.isPrimary) return;
      const laneEl = e.target.closest?.('.lane');
      const lane = this._lanes.find((l) => l.el === laneEl);
      if (!lane || !lane.setWidth) return;
      drag = {
        lane, id: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastT: performance.now(),
        v: 0, engaged: false,
      };
    });

    stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;

      if (!drag.engaged) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        // Only claim the gesture once it is clearly horizontal, so a vertical
        // swipe that starts on a card still scrolls the page.
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
        drag.engaged = true;
        this._dragging = true;
        stage.setPointerCapture(e.pointerId);
      }

      const now = performance.now();
      const step = e.clientX - drag.lastX;
      drag.v = (step / Math.max(1, now - drag.lastT)) * 1000;
      drag.lastX = e.clientX;
      drag.lastT = now;

      const lane = drag.lane;
      lane.offset = (((lane.offset + step) % lane.setWidth) + lane.setWidth) % lane.setWidth;
      lane.track.style.transform =
        `translate3d(${(lane.offset - lane.setWidth).toFixed(2)}px, 0, 0)`;
    });

    const end = () => {
      if (!drag) return;
      const { engaged, v, lane } = drag;
      drag = null;
      this._dragging = false;
      if (!engaged) return;

      // Swallow the click that follows a drag, or the card navigates.
      this._suppressClick = true;
      setTimeout(() => { this._suppressClick = false; }, 0);

      // Carry the throw into the shared momentum, in the lane's own direction.
      const cap = 650;
      this._scrollBoost = Math.max(-cap, Math.min(cap, v * lane.dir * 0.5));
    };

    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    stage.addEventListener('click', (e) => {
      if (this._suppressClick) { e.preventDefault(); return; }
      if (!this._isCoarse) return;

      const card = e.target.closest?.('.card');
      if (!card || card.classList.contains('is-dim')) {
        this._unflip();
        return;
      }
      // First tap turns the card over, second tap follows the link — the
      // standard touch equivalent of hover-to-peek.
      if (card.classList.contains('is-flipped')) return;
      e.preventDefault();
      this._unflip();
      card.classList.add('is-flipped');
      this._markKin(card.dataset.subject);
      this._speedMulTarget = 0.12;
    });
  }

  _unflip() {
    this._stage?.querySelectorAll('.card.is-flipped')
      .forEach((c) => c.classList.remove('is-flipped'));
    this._speedMulTarget = 1;
    this._clearKin();
  }

  // ---------------------------------------------------------------- layout

  /**
   * Clone each lane's card set enough times to cover the viewport plus one
   * full set, so the wrap point is always off-screen.
   */
  _layout() {
    if (this._reduced || !this._lanes.length) return;

    const stageWidth = this._stage?.clientWidth || 0;
    if (!stageWidth) return;

    this._lanes.forEach((lane) => {
      // Measure from the pristine first set, not the cloned track. The wrap
      // period includes the flex gap that follows the set.
      const gap = parseFloat(getComputedStyle(lane.track).columnGap) || 0;
      const setWidth = lane.set.getBoundingClientRect().width + gap;
      if (setWidth <= gap) return;

      lane.setWidth = setWidth;

      const needed = Math.max(2, Math.ceil(stageWidth / setWidth) + 1);
      const have = lane.track.children.length;

      for (let i = have; i < needed; i += 1) {
        const clone = lane.set.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        // Clones must not appear in the tab order or the reading order.
        clone.querySelectorAll('.card').forEach((c) => { c.tabIndex = -1; });
        lane.track.append(clone);
      }
      for (let i = have; i > needed; i -= 1) {
        lane.track.lastElementChild.remove();
      }
    });

    this._applyFilter();
  }

  // ---------------------------------------------------------------- motion

  _applyMotionMode() {
    this._stop();
    this.toggleAttribute('data-static', this._reduced);

    if (this._reduced || !this._lanes.length) {
      // Static mode uses native scrolling; drop the clones.
      this._lanes.forEach((lane) => {
        while (lane.track.children.length > 1) lane.track.lastElementChild.remove();
        lane.track.style.transform = '';
      });
      this._applyFilter();
      return;
    }

    this._layout();
    this._lastScrollY = window.scrollY;
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._lastFrame = 0;
    this._raf = requestAnimationFrame(this._tick);
  }

  _stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    window.removeEventListener('scroll', this._onScroll);
  }

  _onScroll() {
    const coupling = parseFloat(this.getAttribute('scroll-coupling'));
    const k = Number.isFinite(coupling) ? coupling : 0.55;
    if (!k) return;

    const delta = window.scrollY - this._lastScrollY;
    this._lastScrollY = window.scrollY;

    // Scrolling down drives the lanes along; scrolling back can briefly
    // reverse them. Capped so a flick of the wheel cannot fling the rig —
    // a surge should read as momentum, not as a glitch.
    const cap = 650;
    this._scrollBoost = Math.max(-cap, Math.min(cap, this._scrollBoost + delta * k * 6));
  }

  _tick(now) {
    this._raf = requestAnimationFrame(this._tick);

    if (!this._lastFrame) this._lastFrame = now;
    // Clamp so a backgrounded tab does not resume with a giant jump.
    const dt = Math.min((now - this._lastFrame) / 1000, 0.05);
    this._lastFrame = now;

    // Ease the hover multiplier and bleed off scroll inertia.
    // Roughly a 0.18s time constant: the surge is felt, then gone.
    this._speedMul += (this._speedMulTarget - this._speedMul) * Math.min(1, dt * 6);
    this._scrollBoost *= Math.pow(0.004, dt);
    if (Math.abs(this._scrollBoost) < 1) this._scrollBoost = 0;

    const base = parseFloat(this.getAttribute('speed'));
    const baseSpeed = Number.isFinite(base) ? base : 34;
    const gate = this._paused || this._dragging ? 0 : this._speedMul;

    for (const lane of this._lanes) {
      if (!lane.setWidth) continue;

      const velocity = (baseSpeed + this._scrollBoost) * lane.speedMul * gate * lane.dir;
      let offset = lane.offset + velocity * dt;

      // Keep offset inside [0, setWidth) so precision never drifts.
      offset = ((offset % lane.setWidth) + lane.setWidth) % lane.setWidth;
      lane.offset = offset;

      lane.track.style.transform = `translate3d(${(offset - lane.setWidth).toFixed(2)}px, 0, 0)`;
    }
  }

  /** Nudge a lane so a keyboard-focused card sits inside the stage. */
  _bringIntoView(card) {
    // Undo any native scroll-into-view synchronously, before the next paint.
    this.scrollLeft = 0;
    this.scrollTop = 0;

    const lane = this._lanes.find((l) => l.track.contains(card));
    if (!lane || !lane.setWidth) return;

    const stageWidth = this._stage.clientWidth;
    const cardWidth = card.getBoundingClientRect().width;
    const currentX = card.offsetLeft + (lane.offset - lane.setWidth);
    const pad = 24;

    let desiredX = currentX;
    if (currentX < pad) desiredX = pad;
    else if (currentX + cardWidth > stageWidth - pad) desiredX = stageWidth - cardWidth - pad;
    if (desiredX === currentX) return;

    const next = desiredX - card.offsetLeft + lane.setWidth;
    lane.offset = ((next % lane.setWidth) + lane.setWidth) % lane.setWidth;
    lane.track.style.transform =
      `translate3d(${(lane.offset - lane.setWidth).toFixed(2)}px, 0, 0)`;
  }

  // ---------------------------------------------------------------- filter

  _markKin(subject) {
    if (!subject || !this._stage) return;
    this._stage.querySelectorAll('.card').forEach((card) => {
      card.classList.toggle('is-kin', card.dataset.subject === subject);
    });
  }

  _clearKin() {
    this._stage?.querySelectorAll('.card.is-kin')
      .forEach((card) => card.classList.remove('is-kin'));
  }

  _applyFilter() {
    if (!this._stage) return;

    const query = this._query;
    const subjects = this._activeSubjects;
    let matches = 0;

    this._stage.querySelectorAll('.card').forEach((card) => {
      const bySubject = subjects.size === 0 || subjects.has(card.dataset.subject);
      const byQuery = !query || card.dataset.haystack.includes(query);
      const hit = bySubject && byQuery;

      card.classList.toggle('is-dim', !hit);
      // A dimmed card must not be a tab stop, and clones never are.
      card.tabIndex = hit && !card.closest('[aria-hidden="true"]') ? 0 : -1;

      if (hit && !card.closest('[aria-hidden="true"]')) matches += 1;
    });

    if (this._live) {
      this._live.textContent =
        matches === 1 ? '1 course matches' : `${matches} courses match`;
    }
  }
}

if (!customElements.get('uob-course-drift')) {
  customElements.define('uob-course-drift', UobCourseDrift);
}

export default UobCourseDrift;
