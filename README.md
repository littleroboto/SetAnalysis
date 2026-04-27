# RFM UpSet workbench

A small static web app that takes pasted YAML describing per-store estate
configuration and renders an UpSet-style plot (set-size bars + intersection-size
bars + dot matrix). Built as the **visual workbench for Phase 1** of the RFM
estate variance readout.

The full handoff &mdash; goals, hard constraints, schema, phased plan &mdash;
lives in [`../../analysis/PROMPT-build-upset-workbench.md`](../../analysis/PROMPT-build-upset-workbench.md).
This README covers only how to **run, build, and deploy** the tool itself.

> **Status: Phase 2 (partial)** &mdash; bundled **UK**, **DE**, **PL**, and **NL**
> menu-set samples, **parameters-only** samples, and **dual** samples (`meta.dimension: dual` &mdash;
> two UpSet panels per paste). See `src/samples/README.md`. PNG export and GitHub Pages deploy
> remain on the prompt roadmap.

## Hard constraints

These are pinned by the prompt; do not relax without asking:

- **Roll-your-own renderer.** Do **not** install `@upsetjs/*` packages. The
  AGPL/commercial dual licence is unsuitable for this repo. The
  `visdesignlab/upset2` codebase may be **studied** for layout but not
  vendored.
- **Static site only.** No backend, no telemetry, no server-side state. All
  parsing and rendering happens in the browser.
- **TypeScript + Vite + js-yaml.** No React/Vue/UI framework. SVG hand-rolled
  (D3 left out of Phase 0 because the math is small).
- **HTML caption below the chart** carries the `meta` block verbatim &mdash;
  including the `evidence` grade (numbered footnotes). The workbench rule
  says no claim presented as fact unless graded; the UI honours that.

## Run locally

Requires Node 20+ and npm.

```bash
cd viz/upset-tool
npm install
npm run dev          # Vite dev server, default http://localhost:5173/SetAnalysis/
npm test             # vitest run (parse + combinations)
npm run build        # tsc --noEmit + vite build into dist/
npm run preview      # serve the built dist/ locally
npm run gen:uk-passb # regenerate src/samples/synthetic-uk-passb.yaml
npm run gen:de-passb # regenerate src/samples/synthetic-de-passb.yaml
npm run gen:pl-passb # regenerate src/samples/synthetic-pl-passb.yaml
npm run gen:nl-passb # regenerate src/samples/synthetic-nl-passb.yaml
npm run gen:uk-params-passb  # synthetic-uk-parameters-passb.yaml (parameters dimension)
npm run gen:pl-params-passb  # synthetic-pl-parameters-passb.yaml (parameters dimension)
npm run gen:uk-dual-passb    # synthetic-uk-dual-passb.yaml (menu_sets + parameters)
npm run gen:de-dual-passb
npm run gen:pl-dual-passb
npm run gen:nl-dual-passb
```

The dev URL includes the `/SetAnalysis/` base path because Vite is configured
to deploy under that prefix on GitHub Pages. Locally that is harmless; in
production it matches `https://<user>.github.io/SetAnalysis/`.

## Project layout

```
viz/upset-tool/
├── package.json          npm scripts + deps (js-yaml runtime, vite/typescript/vitest dev)
├── tsconfig.json         strict TS, ES2022 target, no emit (vite handles bundling)
├── vite.config.ts        base="/SetAnalysis/", vitest config under `test`
├── index.html            single-page shell
├── public/
│   └── schema.md         human-readable input YAML spec (canonical reference)
├── src/
│   ├── main.ts           entry point — wires sample picker, controls, render, export
│   ├── parse.ts          YAML -> single or dual ParseResult, strict validation
│   ├── combinations.ts   pure function: Element[] -> { sets, combinations }
│   ├── render-upset.ts   hand-rolled SVG: top bars + left bars + matrix + caption
│   ├── controls.ts       Top-N, min-size, sort, Other rollup, hide-empty toggles
│   ├── export.ts         SVG download (PNG: Phase 2)
│   ├── style.css         page chrome
│   ├── types.ts          shared types
│   ├── vite-env.d.ts     ?raw module declaration
│   ├── samples/
│   │   ├── README.md                pedagogical purpose per sample
│   │   ├── synthetic-uk-passb.yaml  bundled UK synthetic — generated, do not edit
│   │   ├── synthetic-de-passb.yaml  bundled DE synthetic — generated, do not edit
│   │   ├── synthetic-pl-passb.yaml  bundled PL synthetic (high k) — generated, do not edit
│   │   ├── synthetic-nl-passb.yaml  bundled NL synthetic (estate names, uniform) — generated, do not edit
│   │   ├── synthetic-uk-parameters-passb.yaml  parameters dimension — generated, do not edit
│   │   ├── synthetic-pl-parameters-passb.yaml  parameters dimension — generated, do not edit
│   │   ├── synthetic-uk-dual-passb.yaml   dual (menu_sets + parameters)
│   │   ├── synthetic-de-dual-passb.yaml   dual
│   │   ├── synthetic-pl-dual-passb.yaml   dual
│   │   ├── synthetic-nl-dual-passb.yaml   dual
│   │   └── _generators/
│   │       ├── tsconfig.json        adds Node types only here
│   │       ├── uk_passb.ts          seeded synthetic UK generator
│   │       ├── de_passb.ts          seeded synthetic DE generator (contrasts UK)
│   │       ├── pl_menu_catalog.ts   shared PL live vs catalog-only menu labels (pl_passb + pl_dual)
│   │       ├── pl_passb.ts          seeded synthetic PL generator (live + unassigned catalog)
│   │       ├── nl_passb.ts          NL: names from nl_menu_sets.tsv, uniform bundles
│   │       ├── uk_params_passb.ts   UK parameters dimension (high k, SYS/CUST mix)
│   │       ├── pl_params_passb.ts   PL parameters dimension (low k, high menu-set attrs)
│   │       ├── uk_dual_passb.ts     UK dual (menu_sets + parameters per store)
│   │       ├── de_dual_passb.ts     DE dual
│   │       ├── pl_dual_passb.ts     PL dual
│   │       └── nl_dual_passb.ts     NL dual
│   ├── parse.test.ts     parser validation tests
│   └── combinations.test.ts grouping/sorting tests
└── README.md             you are here
```

## Long-tail trimming

The chart applies three composable controls (defaults in parens). Distinct
set cardinality (menu-sets or parameters) in the wild is not bounded; **defaults show every set
and every combination** (`0` = no cap). When a readout figure needs trimming,
**Top-N sets** (matrix row count) is usually the first meaningful dial; **Top-N
intersections** follows when the bundle tail is still too wide.

1. **Top-N sets** (0 = all) &mdash; keep the N largest sets; the remainder folds
   into the legend residual (does not invent a fake set in the matrix).
2. **Min intersection size** (1) &mdash; drop combinations with `size < threshold`.
3. **Top-N intersections + Other rollup** (0 = all, rollup on) &mdash; keep the N largest;
   sum the rest into a single hatched **Other** bar with no matrix column,
   tooltip listing the rolled combinations.

The "Other" bucket is **always counted in the HTML caption**. Silently
dropping the long tail violates the workbench rule on full data &mdash; if
you turn the rollup off, document the trim in the readout.

## Out of scope (deferred to Phase 3+)

Tracked here so they are not forgotten and not built early:

- Heatmap overlay row under each intersection column (per-intersection mean
  of `attrs.feature_count` etc.).
- Twin-plot mode (Pass A vs Pass B side by side).
- Per-store annotation panel (click an intersection bar -> list element ids).
- Evidence colour grades on bars.
- Vega-Lite or Observable export &mdash; out of scope entirely.

## Deploy

The workflow `.github/workflows/deploy-viz.yml` is **drafted but
disabled** (manual `workflow_dispatch` trigger only). Phase 3 enables the
push trigger and points GitHub Pages at the `gh-pages` branch.

## Studied references (do not vendor)

- UpSet: Lex et al., 2014 &mdash; original paper and `visdesignlab/upset2`
  reference implementation.
- `upset.app` &mdash; layout grammar reference.
- `@upsetjs/upsetjs` &mdash; data-model study only; **not** a runtime
  dependency (AGPL/commercial licence).
