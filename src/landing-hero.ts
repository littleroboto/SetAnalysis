// Landing-hero choreography.
//
// On first scroll into view we fade the bars / dots / set-bars in (the
// "reveal") and — once it settles — play a short pedagogical "click" demo
// that mimics the workbench's drill-down: a cursor glides to a meaningful
// intersection bar, a click pulse plays, the bar + its column dots get a
// subtle highlight, and a small overlay panel slides in from the top-right
// of the figure showing the intersection label, store count, and a few
// anonymised store IDs.
//
// `prefers-reduced-motion` short-circuits all motion: the reveal is skipped
// (CSS `is-prereveal` removed without animation) and the overlay panel
// snaps in.

import { animate, inView, stagger } from "motion";
import { extractCombinations } from "./combinations";
import { parseInput } from "./parse";
import { renderUpset } from "./render-upset";
import {
  DEFAULT_RENDER_OPTIONS,
  type Combination,
  type ParsedInput,
  type ParseResult,
  type RenderOptions,
} from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Total reveal time including stagger, after which the demo can start. */
const REVEAL_TOTAL_MS = 1050;
/** Min stores in the chosen combo before we bother running the demo. */
const HERO_DEMO_MIN_STORES = 5;
/** Pick the 3rd shown column — usually a meaningful "many but not all" bar. */
const HERO_DEMO_TARGET_INDEX = 2;
/** Cap for IDs shown in the panel; rest is rolled into a "+ N more" line. */
const HERO_PANEL_VISIBLE_IDS = 10;

interface HeroDemoTarget {
  combo: Combination;
  bar: SVGGraphicsElement;
  columnDots: SVGElement[];
}

/**
 * Build a hero-only ParsedInput where each original set name is replaced
 * with a numbered placeholder ("MenuSet-1" for menu-set inputs, "Feature-1"
 * for feature/parameter inputs) ranked by occurrence (largest first), and
 * each element ID is replaced with "Store #N" in YAML appearance order so
 * the demo panel can list IDs without leaking the synthetic source values.
 * The meta is scrubbed of market / source identifiers; the caller still
 * strips the figure-header from the rendered SVG so no market chrome leaks
 * into the visual.
 */
export function anonymiseHeroInput(src: ParsedInput): ParsedInput {
  const labelPrefix =
    src.meta.dimension === "features" || src.meta.dimension === "parameters"
      ? "Feature"
      : "MenuSet";

  const counts = new Map<string, number>();
  for (const el of src.elements) {
    for (const s of el.sets) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([name], i) => [name, `${labelPrefix}-${i + 1}`] as const);
  const renameSet = new Map(ranked);

  return {
    meta: {
      market: "Demo",
      snapshot: src.meta.snapshot,
      dimension: src.meta.dimension,
      source: "synthetic",
      evidence: src.meta.evidence,
    },
    elements: src.elements.map((el, i) => ({
      id: `Store #${i + 1}`,
      sets: el.sets.map((s) => renameSet.get(s) ?? s),
      attrs: el.attrs,
    })),
  };
}

interface InitOptions {
  yaml: string;
  demoMode: boolean;
}

export function initLandingHero(opts: InitOptions): void {
  const host = document.getElementById("landing-hero-chart");
  if (!host) return;
  host.replaceChildren();

  let parsed: ParseResult;
  try {
    parsed = parseInput(opts.yaml);
  } catch {
    return;
  }

  const rawInput =
    parsed.kind === "dual"
      ? parsed.menuSets
      : parsed.kind === "single"
        ? parsed.parsed
        : undefined;
  if (!rawInput) return;

  const input = opts.demoMode ? rawInput : anonymiseHeroInput(rawInput);

  const summary = extractCombinations(input.elements);
  const heroOptions: RenderOptions = {
    ...DEFAULT_RENDER_OPTIONS,
    topNSets: 8,
    topNCombinations: 14,
    minCombinationSize: 8,
    otherRollup: true,
    hideEmptyIntersection: true,
    sortMode: "size_desc",
  };

  const result = renderUpset(
    host,
    input.meta,
    input.elements.length,
    summary,
    heroOptions,
  );

  if (!opts.demoMode) {
    result.svg.querySelectorAll(".figure-header").forEach((g) => g.remove());
  }
  result.svg.removeAttribute("width");
  result.svg.removeAttribute("height");
  result.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const topBars = Array.from(
    result.svg.querySelectorAll<SVGElement>(".combo-bar"),
  );
  const setBars = Array.from(
    result.svg.querySelectorAll<SVGElement>(".set-bar"),
  );
  const onDots = Array.from(
    result.svg.querySelectorAll<SVGElement>(".dot-on"),
  );

  topBars.forEach((el) => {
    el.style.transformOrigin = "50% 100%";
  });
  setBars.forEach((el) => {
    el.style.transformOrigin = "100% 50%";
  });
  host.classList.add("is-prereveal");

  const figure = host.closest<HTMLElement>(".landing-hero-figure");
  const target = pickHeroTarget(result.svg, result.shownCombinations);
  const reduced = prefersReducedMotion();

  // Build the overlay panel (and cursor sprite) up front; we only animate
  // them once the reveal settles. If there's no usable target combo we
  // skip the demo entirely — no panel, no cursor. The cursor + pulse must
  // be parented to `.chart-layer` so they share the bar's coordinate
  // system (which is offset from SVG root by the document-margin layer).
  const chartLayer = result.svg.querySelector<SVGGElement>(".chart-layer");
  let panel: HTMLElement | null = null;
  let cursor: SVGGElement | null = null;
  let pulse: SVGCircleElement | null = null;
  if (target && figure && chartLayer) {
    panel = createOverlayPanel(figure, target.combo);
    cursor = createCursorSprite(chartLayer);
    pulse = createPulse(chartLayer);
  }

  let demoStarted = false;
  inView(host, () => {
    host.classList.remove("is-prereveal");
    if (!reduced) {
      animate(
        topBars,
        { opacity: [0, 1], scaleY: [0.05, 1] },
        { duration: 0.75, ease: "easeOut", delay: stagger(0.02) },
      );
      animate(
        setBars,
        { opacity: [0, 1], scaleX: [0.08, 1] },
        { duration: 0.7, ease: "easeOut", delay: stagger(0.015) },
      );
      animate(
        onDots,
        { opacity: [0, 1], scale: [0.25, 1] },
        {
          duration: 0.45,
          ease: "easeOut",
          delay: stagger(0.003, { startDelay: 0.2 }),
        },
      );
    }

    if (target && panel && !demoStarted) {
      demoStarted = true;
      if (reduced) {
        snapHeroDemo(target, panel);
      } else if (cursor && pulse) {
        window.setTimeout(() => {
          runHeroDemo({ target, panel: panel!, cursor: cursor!, pulse: pulse! });
        }, REVEAL_TOTAL_MS);
      }
    }
  });
}

function pickHeroTarget(
  svg: SVGSVGElement,
  shownCombinations: Combination[],
): HeroDemoTarget | null {
  if (shownCombinations.length <= HERO_DEMO_TARGET_INDEX) return null;
  const combo = shownCombinations[HERO_DEMO_TARGET_INDEX];
  if (combo.size < HERO_DEMO_MIN_STORES) return null;
  // Skip the "everything" bar (degree 1) — pedagogically less interesting.
  // The 3rd combo at size_desc is usually a real intersection but guard
  // anyway.
  if (combo.sets.length < 2) return null;

  const allBars = Array.from(
    svg.querySelectorAll<SVGGraphicsElement>(".combo-bar"),
  ).filter((b) => !b.classList.contains("combo-bar-other"));
  const bar = allBars[HERO_DEMO_TARGET_INDEX];
  if (!bar) return null;

  // Dots in this column live at the same x as the bar centre. Match by
  // x within a small tolerance so we don't depend on an internal class.
  const barBox = bar.getBBox();
  const colCx = barBox.x + barBox.width / 2;
  const tolerance = 4;
  const dots = Array.from(
    svg.querySelectorAll<SVGCircleElement>(".dot-on"),
  ).filter((d) => {
    const cx = Number(d.getAttribute("cx") ?? "NaN");
    return Number.isFinite(cx) && Math.abs(cx - colCx) <= tolerance;
  });

  return { combo, bar, columnDots: dots };
}

function createCursorSprite(parent: SVGGElement): SVGGElement {
  const svg = parent.ownerSVGElement!;
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.setAttribute("class", "hero-cursor");
  g.setAttribute("aria-hidden", "true");
  // Park near the bottom-right of the chart layer until the demo starts.
  // The chart-layer is translated by DOCUMENT_MARGIN_PX from the SVG root,
  // so subtract that margin from the viewBox extent to stay inside the
  // chart's own coordinate system.
  const vb = svg.viewBox.baseVal;
  const startX = vb.x + vb.width - 2;
  const startY = vb.y + vb.height - 2;
  g.setAttribute("transform", `translate(${startX}, ${startY})`);
  g.style.opacity = "0";

  // Soft white halo behind a black arrow keeps the cursor legible against
  // both white bars and grey hatching.
  const halo = document.createElementNS(SVG_NS, "path");
  halo.setAttribute("d", "M0 0 L0 13 L3.6 9.6 L5.7 13.7 L7.5 12.8 L5.5 8.8 L9.8 8.8 Z");
  halo.setAttribute("fill", "#ffffff");
  halo.setAttribute("stroke", "#ffffff");
  halo.setAttribute("stroke-width", "2.4");
  halo.setAttribute("stroke-linejoin", "round");
  g.appendChild(halo);

  const arrow = document.createElementNS(SVG_NS, "path");
  arrow.setAttribute("d", "M0 0 L0 13 L3.6 9.6 L5.7 13.7 L7.5 12.8 L5.5 8.8 L9.8 8.8 Z");
  arrow.setAttribute("fill", "#0a0a0a");
  arrow.setAttribute("stroke", "#ffffff");
  arrow.setAttribute("stroke-width", "0.6");
  arrow.setAttribute("stroke-linejoin", "round");
  g.appendChild(arrow);

  parent.appendChild(g);
  return g;
}

function createPulse(parent: SVGGElement): SVGCircleElement {
  const c = document.createElementNS(SVG_NS, "circle");
  c.setAttribute("class", "hero-pulse");
  c.setAttribute("r", "0");
  c.setAttribute("cx", "0");
  c.setAttribute("cy", "0");
  c.setAttribute("fill", "none");
  c.setAttribute("stroke", "#0a0a0a");
  c.setAttribute("stroke-width", "1.6");
  c.style.opacity = "0";
  parent.appendChild(c);
  return c;
}

function createOverlayPanel(
  figure: HTMLElement,
  combo: Combination,
): HTMLElement {
  // Ensure we can absolutely-position the panel relative to the figure.
  const computed = window.getComputedStyle(figure);
  if (computed.position === "static") {
    figure.style.position = "relative";
  }

  const panel = document.createElement("div");
  panel.className = "hero-overlay-panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Intersection details");
  panel.hidden = true;

  const title = document.createElement("div");
  title.className = "hero-overlay-title";
  title.textContent =
    combo.sets.length === 0 ? "(no sets)" : combo.sets.join(" \u2229 ");

  const count = document.createElement("div");
  count.className = "hero-overlay-count";
  count.textContent = `${combo.size.toLocaleString()} stores`;

  const list = document.createElement("div");
  list.className = "hero-overlay-list";
  const visible = combo.elementIds.slice(0, HERO_PANEL_VISIBLE_IDS);
  const more = combo.elementIds.length - visible.length;
  list.textContent =
    more > 0 ? `${visible.join(", ")} + ${more} more` : visible.join(", ");

  panel.appendChild(title);
  panel.appendChild(count);
  panel.appendChild(list);
  figure.appendChild(panel);
  return panel;
}

interface HeroDemoCtx {
  target: HeroDemoTarget;
  panel: HTMLElement;
  cursor: SVGGElement;
  pulse: SVGCircleElement;
}

function runHeroDemo(ctx: HeroDemoCtx): void {
  const { target, panel, cursor, pulse } = ctx;
  const bar = target.bar;
  const svg = bar.ownerSVGElement!;
  const vb = svg.viewBox.baseVal;
  const box = bar.getBBox();
  const targetX = box.x + box.width / 2;
  const targetY = box.y - 2;

  // 1. Cursor glides into the chart. Drive the SVG `transform` attribute
  //    directly via onUpdate so the translation is unambiguously in SVG
  //    user units (CSS transforms on `<g>` would resolve in CSS pixels,
  //    which only matches user units when the SVG isn't scaled).
  const startX = vb.x + vb.width - 2;
  const startY = vb.y + vb.height - 2;
  cursor.style.opacity = "1";
  cursor.setAttribute("transform", `translate(${startX}, ${startY})`);
  const cursorAnim = animate(0, 1, {
    duration: 0.95,
    ease: [0.45, 0.05, 0.2, 1],
    onUpdate: (t) => {
      const x = startX + (targetX - startX) * t;
      const y = startY + (targetY - startY) * t;
      cursor.setAttribute("transform", `translate(${x}, ${y})`);
    },
  });

  cursorAnim.finished.then(() => {
    // 2. Click pulse at the bar centre.
    pulse.setAttribute("cx", String(targetX));
    pulse.setAttribute("cy", String(box.y + box.height / 2));
    animate(0, 1, {
      duration: 0.42,
      ease: "easeOut",
      onUpdate: (t) => {
        pulse.setAttribute("r", String(t * 16));
        pulse.style.opacity = String(0.65 * (1 - t));
      },
    });

    // 3. Highlight bar + column dots.
    bar.classList.add("is-hero-target");
    target.columnDots.forEach((d) => d.classList.add("is-hero-target"));

    // 4. Slide overlay panel in.
    panel.hidden = false;
    panel.style.opacity = "0";
    panel.style.transform = "translateY(-6px)";
    // Force layout so the next style change animates.
    void panel.offsetHeight;
    animate(
      panel,
      { opacity: [0, 1], y: [-6, 0] },
      { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] },
    );
  });
}

function snapHeroDemo(target: HeroDemoTarget, panel: HTMLElement): void {
  // No motion: just paint the end-state so the page still teaches the
  // click-to-drill idea without movement.
  target.bar.classList.add("is-hero-target");
  target.columnDots.forEach((d) => d.classList.add("is-hero-target"));
  panel.hidden = false;
  panel.style.opacity = "1";
  panel.style.transform = "none";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
