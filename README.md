# SetAnalysis

A small static web app for visualising how multiple datasets overlap when they
are **similar but not identical**. Paste YAML, get an UpSet-style chart in the
browser. No backend, no telemetry; pasted data never leaves the page.

Live demo: [https://littleroboto.github.io/SetAnalysis/](https://littleroboto.github.io/SetAnalysis/)

## What it does

- Renders an UpSet style plot: top bars = intersection sizes, side bars = set sizes,  
dot matrix = which sets are in each combination.
- **Dual mode** stacks two panels (e.g. menu sets vs feature flags) for the
same elements with shared controls.
- Trim controls for high-cardinality data: Top-N sets, Top-N intersections,
minimum intersection size, and an "Other" rollup that keeps the long tail
honest in the caption.
- Deterministic SVG export.
- Runs entirely client-side — TypeScript + Vite + a hand-rolled SVG renderer.

## Background — UpSet

[UpSet](https://upset.app) is a visualization technique for set intersections,
introduced by Lex, Gehlenborg, Strobelt, Vuillemot & Pfister (IEEE TVCG, 2014).
Once you have more than ~3 sets, Venn/Euler diagrams stop being readable;
UpSet replaces the overlapping circles with a matrix of "is this set in this
intersection?" dots, paired with bar charts for set and intersection sizes.

This repo is an independent reimplementation of that visual grammar. It does
not vendor or fork any UpSet code base — `visdesignlab/upset2` was studied as a
layout reference, nothing more.

## Run it

Requires Node 20+ and npm (or pnpm).

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build
npm test         # vitest
```

The dev server serves under `/SetAnalysis/` to match the GitHub Pages deploy
path.

## Input

YAML with a `meta` block and a flat list of `elements`, each carrying a list
of set memberships. The full schema lives in
`[public/schema.md](public/schema.md)`; short single-dimension example:

```yaml
meta:
  market: UK
  snapshot: "2026-04-23"
  dimension: menu_sets
  source: example.tsv
  evidence: inferred

elements:
  - id: "001"
    sets: ["Breakfast", "McCafe", "Grill"]
  - id: "002"
    sets: ["Breakfast", "Grill"]
```

For two-panel mode, set `meta.dimension: dual` and give each element both
`menu_sets` and `parameters` arrays.

## Licence

[MIT](LICENSE).

This project is permissively licensed by design:

- No dependency on `@upsetjs/*` packages — that family is dual-licensed
AGPLv3 / commercial, which would be incompatible with MIT distribution.
- The UpSet technique itself (a published visualization method) is cited but
not licensed; no code from `visdesignlab/upset2` is included.
- Circular country flags shown in the header are loaded at runtime from
[HatScripts/circle-flags](https://github.com/HatScripts/circle-flags) (MIT)
only when YAML input includes a market code.

## Status

Early. PNG export and the optional BYOK analysis hook are not yet wired.