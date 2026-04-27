# Landing hero — click-and-reveal animation (brief)

Hand-off note for the next session. The current landing hero (in
`src/main.ts` → `initLandingHero`) only fades in bars/dots/set-bars on scroll
via `motion`'s `inView` + `animate`. The next iteration should teach the
workbench's click-to-drill interaction directly on the landing page.

## What to add

After the existing reveal completes, sequence:

1. A pointer cursor glides into the hero chart and lands on a chosen
   `.combo-bar` (an intersection bar with degree ≥ 2 — pedagogically richer
   than the "everything" bar).
2. A click pulse plays at the cursor (small concentric ring scaling out and
   fading).
3. The clicked bar gets a subtle highlight (e.g. darker stroke / pattern
   tint) and the matrix dots in that column briefly emphasise.
4. A small overlay panel slides in (anchored to `.landing-hero-figure`)
   showing:
   - intersection label (`"Menu #1 ∩ Menu #3"`),
   - count (`"137 stores"`),
   - first ~10 store IDs + `"+ N more"`.

Honour `prefers-reduced-motion`: skip cursor / pulse, optionally just snap
the panel in (or skip the demo entirely).

## Implementation notes

- **Anonymisation.** `anonymiseHeroInput` already renames set names to
  `"Menu #N"` outside `?demo=1`. Extend it to also rename element IDs to
  `"Store #N"` (deterministic, ranked by occurrence or by appearance order)
  so the revealed list doesn't leak the synthetic UK store IDs verbatim.
  Keep raw IDs when `?demo=1` is set.
- **Picking the target combo.** The hero already calls `renderUpset` with
  fixed `heroOptions`. Inside `render-upset.ts` the trim pipeline is
  `applyTrim` (currently internal). Either:
  - export `applyTrim` (small additive change — `Combination[]` /
    `TrimResult` types are already exported via `types.ts`), or
  - extend `RenderResult` with `shownCombinations: Combination[]` so the
    caller can pick a target by index (which lines up 1:1 with
    `result.svg.querySelectorAll(".combo-bar")` minus the `.combo-bar-other`
    rect).
  Pick the 3rd shown combo (index 2) as the demo target — usually a
  meaningful "many-but-not-all" intersection. Skip the demo if the chosen
  combo doesn't exist or has < 5 stores (avoid degenerate hero).
- **Cursor sprite.** Add a `<g class="hero-cursor">` inside the SVG so it
  shares the chart coordinate system. A simple 14×14 arrow path is fine.
  Compute target coordinates from the bar's `getBBox()` (centre x, top y).
  Animate `transform: translate(...)` with `motion`. Start position: just
  outside the chart's bottom-right corner.
- **Click pulse.** Append a `<circle>` at the bar centre, animate
  `r: [0, 14]` and `opacity: [0.6, 0]` over ~400ms.
- **Panel.** Plain HTML inside `.landing-hero-figure` (so it can use normal
  text). Position absolutely; anchor near the clicked bar (top-right of the
  figure is simplest and avoids overlapping the matrix). Reuse the
  selection-inspector palette from `style.css` for visual continuity.
- **Replay vs once.** Open question for the next session — propose
  one-shot first (simpler, no flicker on subsequent scrolls). Loop is doable
  by gating on a manual replay button or a long interval (~8s) with a
  fade-out / new-bar pick.

## Files touched (expected)

- `index.html` — possibly add an empty `<div class="hero-overlay">` next to
  `#landing-hero-chart`, or let JS create it.
- `src/main.ts` — extend `initLandingHero` with the new sequence; extend
  `anonymiseHeroInput` to rename element IDs in non-demo mode.
- `src/render-upset.ts` — export `applyTrim` (or extend `RenderResult`).
- `src/style.css` — `.hero-cursor`, `.hero-pulse`, `.hero-overlay-panel`.

## Tests

- Existing `render-upset.interactions.test.ts` shouldn't change.
- New unit-ish test (jsdom) optional: assert the hero panel renders the
  expected anonymised label/count when given a known parsed input.

## Recently shipped (already in main)

- Removed the redundant `#open-workbench-link-main` CTA from the landing
  copy; the header `#open-workbench-link-top` is the single CTA on the
  landing page now (commit pending).
