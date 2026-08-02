# Course Drift

A moving course list for brighton.ac.uk. A dependency-free custom element that
presents courses as a **parallax depth conveyor**: the centre lane sits nearest
the viewer, outer lanes recede in scale, brightness and speed, and the whole rig
is coupled to the reader's scroll velocity.

Inspired by the multi-row marquee on Apple's Apple One page, but deliberately
not a copy of it. Album art is *browsed*; courses are *searched*. So the drift
carries a live search, subject filters and a detail reveal that a decorative
marquee does not need.

```html
<script type="module" src="/js/uob-course-drift.js"></script>

<uob-course-drift heading="Find your course" src="/data/courses.json"></uob-course-drift>
```

## What makes it different

**Depth, not just rows.** Lane prominence peaks in the middle. Each lane gets a
scale, opacity and speed derived from its distance from centre, so the band
reads as a receding stage rather than three equal conveyor belts.

**Scroll-coupled velocity.** Lane speed is base drift plus a scroll-driven
impulse that decays with roughly a 0.18s time constant. Scroll down and the rig
surges; scroll back and it briefly runs the other way. The element feels
attached to the page instead of animating beside it.

**Friction, not a hard stop.** Pointing at the stage eases the lanes down to 12%
speed over a few hundred milliseconds. An instant freeze reads as a bug.

**Flip to detail.** Hovering or focusing a card turns it over to show duration,
campus, UCAS code and entry requirements — the four things an applicant actually
wants before clicking.

**Subject constellation.** Hovering a card lights every other card in the same
subject across all three lanes, so the shape of a subject area is visible at a
glance.

**Filtering dims, it never removes.** Search and subject chips fade non-matches
instead of pulling them out of the lanes. The motion never reflows or stutters,
and the result count is announced to screen readers.

**Touch is a first input, not a fallback.** Swipe a lane to scrub it and let go
to fling it; tap a card to turn it over; tap again to open the course. Vertical
swipes still scroll the page.

## Usage

### Supplying data

Either point at an endpoint:

```html
<uob-course-drift src="/data/courses.json"></uob-course-drift>
```

…or inline the JSON, which avoids a round trip and works without a server:

```html
<uob-course-drift heading="Undergraduate courses">
  <script type="application/json">
    [{ "title": "Architecture BA(Hons)", "url": "/courses/architecture" }]
  </script>
</uob-course-drift>
```

…or set it from JavaScript, e.g. after a CMS or search-API call:

```js
document.querySelector('uob-course-drift').courses = await getCourses();
```

### Course shape

Only `title` and `url` are required. Everything else is rendered if present and
skipped if absent, so a partially-populated feed degrades cleanly.

```json
{
  "title": "Architecture BA(Hons)",
  "url": "https://www.brighton.ac.uk/courses/study/architecture-ba-hons.aspx",
  "subject": "Architecture & Design",
  "level": "Undergraduate",
  "duration": "3 years full-time",
  "campus": "Moulsecoomb",
  "ucas": "K100",
  "entry": "120 UCAS points"
}
```

`subject` drives both the colour coding and the filter chips. Keep the strings
consistent — they are matched literally.

### Attributes

| Attribute | Default | Purpose |
| --- | --- | --- |
| `src` | — | URL returning a JSON array of courses. |
| `lanes` | `3` | Number of lanes. Odd numbers give a single hero lane. |
| `speed` | `34` | Base drift of the centre lane, px/sec. |
| `scroll-coupling` | `0.55` | Scroll-to-velocity coupling. `0` disables it. |
| `heading` | `Explore our courses` | Section heading, also the region's accessible name. |
| `intro` | — | Supporting line under the heading. |
| `no-filters` | — | Hides the search field and subject chips. |

## Theming

> [!IMPORTANT]
> The default palette is a **placeholder**. I was not able to read
> brighton.ac.uk from this environment — its network policy blocked the request
> — so the brand colours and typeface below are not verified against the live
> site. Replace them with the real values from the University brand guidelines
> before this ships.

Every colour is a custom property on the host, so brand alignment is a single
rule in your own stylesheet — no need to touch the component:

```css
uob-course-drift {
  --uob-bg: #003b5c;          /* replace with the real brand navy */
  --uob-bg-2: #00547f;
  --uob-accent: #00b8d4;
  --uob-fg: #ffffff;
  --uob-fg-muted: rgba(255, 255, 255, 0.66);
  --uob-card: rgba(255, 255, 255, 0.06);
  --uob-card-hover: rgba(255, 255, 255, 0.1);
  --uob-border: rgba(255, 255, 255, 0.14);
  --uob-font: "Your Brand Sans", Helvetica, Arial, sans-serif;
  --uob-font-display: "Your Brand Display", Georgia, serif;
  --uob-radius: 18px;
}
```

Light palettes work as-is — the component makes no assumption that the
background is dark. `demo/index.html` has a light theme and a high-contrast
"ink" theme wired to buttons so you can compare.

Geometry is themeable too: `--uob-card-w`, `--uob-card-h`, `--uob-gap`,
`--uob-lane-gap` and `--uob-edge`.

Per-subject accents are generated from a fixed hue set and assigned in order of
first appearance, so colours are stable for a given course list without anyone
maintaining a colour map.

## Touch

Every affordance above is driven by hover, which does not exist on a
touchscreen, so each one has a touch equivalent:

| Gesture | |
| --- | --- |
| Swipe a lane | Scrubs it directly; releasing carries the throw into the drift. |
| Tap a card | Turns it over and lights its subject across the lanes. |
| Tap it again | Follows the link. Tapping anywhere else turns it back. |
| Swipe up or down | Scrolls the page as normal — the lanes only claim a gesture once it is clearly horizontal. |

The hover-to-flip rule is inside `@media (hover: hover) and (pointer: fine)`.
Without that gate iOS applies a sticky phantom hover and cards stay face-down
after a tap.

## Accessibility

This is a motion-heavy element, so the accessibility work is not incidental:

- **`prefers-reduced-motion`** turns off the animation loop entirely — not just
  slowed, the `requestAnimationFrame` loop never starts. Lanes become natively
  scrollable, snap-aligned rows, the duplicate cards are removed from the DOM,
  and the flip becomes a crossfade. The media query is watched live, so toggling
  the OS setting switches modes without a reload.
- **A visible pause control** for everyone else, meeting WCAG 2.2.2 for content
  that moves for more than five seconds.
- **Every card is a real `<a>`**, so it is reachable, focusable and openable in
  a new tab. The duplicated copies that make the loop seamless are
  `aria-hidden` and removed from the tab order, so nothing is announced twice.
- **Focus stops the motion** and repositions the lane so the focused card is
  brought into view. Cards filtered out are removed from the tab order.
- **Result counts are announced** through an `aria-live` region as you type.
- The section is a labelled `role="region"`, and all controls are real buttons
  and inputs with `aria-pressed` state and a labelled search field.

One subtlety worth knowing about if you modify this: the host must never hold a
scroll offset. Tabbing to a card outside the stage makes the browser scroll it
into view, which shunts the host's hidden overflow sideways and visibly
displaces the entire element. The component resets `scrollLeft`/`scrollTop` on
the host and repositions the lane itself instead.

## Performance

- One `transform: translate3d()` write per lane per frame — three writes total,
  regardless of course count. Nothing else is animated from JavaScript.
- Cards are cloned only as far as needed to cover the viewport plus one set, and
  re-cloned on resize via a `ResizeObserver`.
- The scroll listener is passive.
- Frame delta is clamped at 50ms, so returning to a backgrounded tab does not
  jump the lanes.
- Lane offsets are kept inside `[0, period)` by modulo, so precision does not
  drift over a long session.

## Browser support

Custom elements v1, shadow DOM, `ResizeObserver`, CSS custom properties and 3D
transforms — all baseline in current Chrome, Edge, Firefox and Safari. The
component is an ES module; browsers without module support simply never upgrade
the element, so consider server-rendering a plain list inside the tag as a
fallback if you still need to support them.

## Development

```bash
npx http-server -p 8777 .      # or any static server
# open http://localhost:8777/demo/index.html
```

### Tests

`test/drift.test.mjs` drives the real component in Chromium via Playwright and
covers 36 behaviours: the seamless wrap period, lane coverage, direction
alternation, scroll coupling and its decay, hover deceleration, the
constellation highlight, filtering, tab-order exclusion of clones, the pause
control, focus handling, the host-scroll regression, reduced-motion mode, and
mobile layout.

`test/touch.test.mjs` runs the same component under iPad emulation and covers a
further 13: tap-to-flip, second-tap navigation, tap-away dismissal, swipe
scrubbing, fling, and the guarantee that a vertical swipe is never hijacked.

```bash
npm i -D playwright
node test/drift.test.mjs
node test/touch.test.mjs
```

## Files

| Path | |
| --- | --- |
| `src/uob-course-drift.js` | The component. No dependencies. |
| `demo/index.html` | Demo page with sample data and theme switcher. |
| `test/drift.test.mjs` | Playwright behaviour suite (desktop, keyboard, reduced motion). |
| `test/touch.test.mjs` | Playwright behaviour suite (iPad emulation). |

> The course data in `demo/index.html` is **illustrative sample data**. Course
> titles and campuses are realistic but the UCAS codes and entry requirements
> are placeholders and should not be treated as accurate. Wire the element to
> the real course feed before publishing.
