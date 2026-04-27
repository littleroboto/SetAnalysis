import type {
  Combination,
  CombinationSummary,
  InputMeta,
  RenderOptions,
  SetSummary,
} from "./types";
import {
  CIRCLE_FLAGS_BASE,
  formatDimensionLabel,
  marketToCircleFlagCode,
} from "./header-brand";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface TrimSummary {
  totalElements: number;
  totalSets: number;
  totalCombinations: number;
  shownSets: number;
  shownCombinations: number;
  hiddenSets: number;
  otherCombinationsCount: number;
  otherStoresCount: number;
}

export interface RenderResult {
  svg: SVGSVGElement;
  trim: TrimSummary;
  captionLines: string[];
}

export type DrilldownSelectionType = "combination" | "set" | "other";

export interface DrilldownSelection {
  type: DrilldownSelectionType;
  market: string;
  dimension: InputMeta["dimension"];
  label: string;
  sets: string[];
  stores: string[];
  count: number;
}

interface LayoutConstants {
  pad: number;
  labelsWidth: number;
  leftBarsWidth: number;
  leftGap: number;
  topBarsHeight: number;
  topGap: number;
  cellWidth: number;
  cellHeight: number;
  dotRadius: number;
  topBarFraction: number;
  leftBarFraction: number;
}

const LAYOUT: LayoutConstants = {
  pad: 18,
  /** Wide enough for long set names after we inset names left of the count column. */
  labelsWidth: 268,
  leftBarsWidth: 96,
  leftGap: 14,
  topBarsHeight: 200,
  topGap: 18,
  cellWidth: 28,
  cellHeight: 28,
  /** Matrix membership dots (smaller reads cleaner when pasted into docs). */
  dotRadius: 6,
  topBarFraction: 0.7,
  leftBarFraction: 0.65,
};

/** Wrap width for footnote text shown in the HTML caption strip (not in SVG). */
const FOOTNOTE_WRAP_CH_PX = 5.85;
/** Space below matrix for the “Set size (stores)” axis label + descenders. */
const BELOW_MATRIX_CHROME_PX = 40;

/** Perpendicular distance between parallel 45° hatch lines (px). */
const HATCH_SPACING_PX = 3;
/** Pattern tile = spacing * sqrt(2) so tiling yields ~spacing perpendicular gap. */
const HATCH_TILE = HATCH_SPACING_PX * Math.SQRT2;

// Monochrome: light fills, black outlines, 45° grey hatching (~3px spacing).
const COLOR_BAR_PATTERN_BASE = "#ffffff";
const COLOR_BAR_HATCH_LINE = "#c4c4c4";
const COLOR_BAR_STROKE = "#000000";
const COLOR_BAR_OTHER_PATTERN_BASE = "#ebebeb";
const COLOR_BAR_OTHER_HATCH_LINE = "#9ca3af";
const COLOR_BAR_OTHER_STROKE = "#000000";
const COLOR_DOT_ON = "#0a0a0a";
/** Non-member matrix dots: filled, no stroke (reads as “empty” vs solid on). */
const COLOR_DOT_OFF = "#d8d8d8";
const COLOR_CONNECTOR = "#404040";
const COLOR_AXIS = "#525252";
const COLOR_GRID = "#ffffff";
const COLOR_GRID_ALT = "#e2e2e2";
const COLOR_TEXT = "#0a0a0a";
const COLOR_MUTED = "#737373";
const PATTERN_ID_COMBO = "combo-bar-hatch";
const PATTERN_ID_OTHER = "combo-bar-hatch-other";

/** White band around the plot for Word/Slides paste; chart lives inside at (M,M). */
const DOCUMENT_MARGIN_PX = 20;
const COLOR_DOCUMENT_MARGIN = "#ffffff";

/** Space above top marginal bars: circular market flag + title (included in downloads). */
const FIGURE_HEADER_BAND = 48;
const FIGURE_FLAG_PX = 36;
let figureFlagClipSeq = 0;

/** Fixed column for set-size digits (anchor end); keeps counts off the bar when bar is full width. */
const SET_SIZE_COUNT_ANCHOR_X = 8;
/** Space between set-name right edge and count column (avoids overlap on max-size rows). */
const SET_SIZE_NAME_TO_COUNT_GAP_PX = 52;

export function renderUpset(
  host: HTMLElement,
  meta: InputMeta,
  totalElements: number,
  summary: CombinationSummary,
  options: RenderOptions,
  onSelect?: (selection: DrilldownSelection) => void,
): RenderResult {
  const trimmed = applyTrim(summary, options);

  const numRows = trimmed.shownSets.length;
  const numCols =
    trimmed.shownCombinations.length + (trimmed.otherBucket ? 1 : 0);

  const minCols = Math.max(numCols, 1);
  const minRows = Math.max(numRows, 1);

  const matrixWidth = minCols * LAYOUT.cellWidth;
  const matrixHeight = minRows * LAYOUT.cellHeight;

  const matrixOriginX =
    LAYOUT.pad + LAYOUT.labelsWidth + LAYOUT.leftBarsWidth + LAYOUT.leftGap;
  const matrixOriginY =
    LAYOUT.pad +
    FIGURE_HEADER_BAND +
    LAYOUT.topBarsHeight +
    LAYOUT.topGap;

  const contentWidth = matrixOriginX + matrixWidth + LAYOUT.pad;
  const wrapChars = Math.max(
    36,
    Math.floor((contentWidth - 2 * LAYOUT.pad) / FOOTNOTE_WRAP_CH_PX),
  );
  const footnoteRuns = buildCaptionFootnoteRuns(meta, totalElements, trimmed, wrapChars);

  const contentHeight =
    matrixOriginY + matrixHeight + BELOW_MATRIX_CHROME_PX + LAYOUT.pad;

  const M = DOCUMENT_MARGIN_PX;
  const outerWidth = contentWidth + 2 * M;
  const outerHeight = contentHeight + 2 * M;

  const svg = svgEl("svg", {
    xmlns: SVG_NS,
    viewBox: `0 0 ${outerWidth} ${outerHeight}`,
    width: String(outerWidth),
    height: String(outerHeight),
    role: "img",
    "aria-label": `UpSet plot: ${meta.market} ${formatDimensionLabel(meta.dimension)}`,
  }) as SVGSVGElement;

  const defs = ensureDefs(svg);
  appendComboBarPatterns(defs);

  // Outer margin: white so pasted figures get a consistent frame in documents.
  svg.appendChild(
    svgEl("rect", {
      x: "0",
      y: "0",
      width: String(outerWidth),
      height: String(outerHeight),
      fill: COLOR_DOCUMENT_MARGIN,
    }),
  );

  const chartLayer = svgEl("g", {
    class: "chart-layer",
    transform: `translate(${M},${M})`,
  });
  chartLayer.appendChild(
    svgEl("rect", {
      x: "0",
      y: "0",
      width: String(contentWidth),
      height: String(contentHeight),
      fill: "#ffffff",
    }),
  );

  appendFigureHeader(defs, chartLayer, meta);

  // ---------- TOP PANEL: combination size bars ----------
  const maxComboSize = Math.max(
    1,
    ...trimmed.shownCombinations.map((c) => c.size),
    trimmed.otherBucket?.totalSize ?? 0,
  );
  const topAxisTop = LAYOUT.pad + FIGURE_HEADER_BAND;
  const topAxisBottom = LAYOUT.pad + FIGURE_HEADER_BAND + LAYOUT.topBarsHeight;

  const topAxisGroup = svgEl("g", { class: "top-axis" });
  topAxisGroup.appendChild(
    svgEl("line", {
      x1: String(matrixOriginX - 4),
      x2: String(matrixOriginX - 4),
      y1: String(topAxisTop),
      y2: String(topAxisBottom),
      stroke: COLOR_AXIS,
      "stroke-width": "1",
    }),
  );
  for (const tick of niceTicks(maxComboSize, 4)) {
    const ty = scaleLinear(tick, 0, maxComboSize, topAxisBottom, topAxisTop);
    topAxisGroup.appendChild(
      svgEl("line", {
        x1: String(matrixOriginX - 4),
        x2: String(matrixOriginX - 8),
        y1: String(ty),
        y2: String(ty),
        stroke: COLOR_AXIS,
        "stroke-width": "1",
      }),
    );
    topAxisGroup.appendChild(
      svgText(String(tick), {
        x: matrixOriginX - 12,
        y: ty + 4,
        anchor: "end",
        fill: COLOR_MUTED,
        size: 11,
      }),
    );
  }
  // Y-axis label: rotated 90° CCW (−90° in SVG), centred on axis, left of ticks.
  const axisMidY = (topAxisTop + topAxisBottom) / 2;
  const storesLabelX = matrixOriginX - 47;
  const storesLabelGroup = svgEl("g", {
    class: "top-axis-y-label",
    transform: `rotate(-90 ${storesLabelX} ${axisMidY})`,
  });
  storesLabelGroup.appendChild(
    svgText("# Stores", {
      x: storesLabelX,
      y: axisMidY,
      anchor: "middle",
      fill: COLOR_MUTED,
      size: 11,
      bold: true,
    }),
  );
  topAxisGroup.appendChild(storesLabelGroup);
  chartLayer.appendChild(topAxisGroup);

  const topBarsGroup = svgEl("g", { class: "top-bars" });
  trimmed.shownCombinations.forEach((combo, i) => {
    const cx = matrixOriginX + i * LAYOUT.cellWidth + LAYOUT.cellWidth / 2;
    const barW = LAYOUT.cellWidth * LAYOUT.topBarFraction;
    const barH = scaleLinear(combo.size, 0, maxComboSize, 0, LAYOUT.topBarsHeight);
    const barX = cx - barW / 2;
    const barY = topAxisBottom - barH;
    const rect = svgEl("rect", {
      x: String(barX),
      y: String(barY),
      width: String(barW),
      height: String(barH),
      fill: `url(#${PATTERN_ID_COMBO})`,
      stroke: COLOR_BAR_STROKE,
      "stroke-width": "1",
      class: "combo-bar",
    });
    rect.appendChild(
      svgTitle(
        `Intersection: ${combo.sets.length === 0 ? "(no sets)" : combo.sets.join(" \u2229 ")}\nStores: ${combo.size}\nDegree: ${combo.sets.length}`,
      ),
    );
    wireSelectable(
      rect,
      {
        type: "combination",
        market: meta.market,
        dimension: meta.dimension,
        label:
          combo.sets.length === 0 ? "(no sets)" : combo.sets.join(" ∩ "),
        sets: combo.sets,
        stores: combo.elementIds,
        count: combo.size,
      },
      onSelect,
    );
    topBarsGroup.appendChild(rect);
    topBarsGroup.appendChild(
      svgText(String(combo.size), {
        x: cx,
        y: barY - 3,
        anchor: "middle",
        fill: COLOR_TEXT,
        size: 10,
      }),
    );
  });

  // "Other" bar (if any) — hatched, no matrix column underneath.
  if (trimmed.otherBucket) {
    const idx = trimmed.shownCombinations.length;
    const cx = matrixOriginX + idx * LAYOUT.cellWidth + LAYOUT.cellWidth / 2;
    const barW = LAYOUT.cellWidth * LAYOUT.topBarFraction;
    const barH = scaleLinear(
      trimmed.otherBucket.totalSize,
      0,
      maxComboSize,
      0,
      LAYOUT.topBarsHeight,
    );
    const barX = cx - barW / 2;
    const barY = topAxisBottom - barH;

    const rect = svgEl("rect", {
      x: String(barX),
      y: String(barY),
      width: String(barW),
      height: String(barH),
      fill: `url(#${PATTERN_ID_OTHER})`,
      stroke: COLOR_BAR_OTHER_STROKE,
      "stroke-width": "1",
      class: "combo-bar combo-bar-other",
    });
    const tooltipLines = [
      `Other (${trimmed.otherBucket.totalSize} stores across ${trimmed.otherBucket.combinations.length} combinations)`,
      "Top rolled-up combinations:",
      ...trimmed.otherBucket.combinations
        .slice(0, 12)
        .map(
          (c) =>
            `  - ${c.size} \u00d7 [${c.sets.length === 0 ? "(no sets)" : c.sets.join(" \u2229 ")}]`,
        ),
    ];
    if (trimmed.otherBucket.combinations.length > 12) {
      tooltipLines.push(
        `  \u2026 + ${trimmed.otherBucket.combinations.length - 12} more`,
      );
    }
    rect.appendChild(svgTitle(tooltipLines.join("\n")));
    const otherStoreIds = uniqueSorted(
      trimmed.otherBucket.combinations.flatMap((c) => c.elementIds),
    );
    wireSelectable(
      rect,
      {
        type: "other",
        market: meta.market,
        dimension: meta.dimension,
        label: `Other (${trimmed.otherBucket.combinations.length} combinations)`,
        sets: [],
        stores: otherStoreIds,
        count: trimmed.otherBucket.totalSize,
      },
      onSelect,
    );
    topBarsGroup.appendChild(rect);
    topBarsGroup.appendChild(
      svgText(String(trimmed.otherBucket.totalSize), {
        x: cx,
        y: barY - 3,
        anchor: "middle",
        fill: COLOR_MUTED,
        size: 10,
      }),
    );
    topBarsGroup.appendChild(
      svgText("Other", {
        x: cx,
        y: topAxisBottom + LAYOUT.topGap - 4,
        anchor: "middle",
        fill: COLOR_MUTED,
        size: 10,
        italic: true,
      }),
    );
  }
  chartLayer.appendChild(topBarsGroup);

  // ---------- LEFT PANEL: set size labels + horizontal bars ----------
  const maxSetSize = Math.max(1, ...trimmed.shownSets.map((s) => s.size));
  const leftBarsRight = matrixOriginX - LAYOUT.leftGap;
  const leftBarsLeft = leftBarsRight - LAYOUT.leftBarsWidth;
  const setSizeCountX = leftBarsLeft - SET_SIZE_COUNT_ANCHOR_X;
  const setNameLabelX =
    setSizeCountX - SET_SIZE_NAME_TO_COUNT_GAP_PX;

  const leftAxisGroup = svgEl("g", { class: "left-axis" });
  leftAxisGroup.appendChild(
    svgText("Set size (stores)", {
      x: leftBarsLeft + LAYOUT.leftBarsWidth / 2,
      y: matrixOriginY + matrixHeight + 22,
      anchor: "middle",
      fill: COLOR_MUTED,
      size: 11,
      bold: true,
    }),
  );
  chartLayer.appendChild(leftAxisGroup);

  trimmed.shownSets.forEach((set, j) => {
    const cy = matrixOriginY + j * LAYOUT.cellHeight + LAYOUT.cellHeight / 2;
    const barH = LAYOUT.cellHeight * LAYOUT.leftBarFraction;
    const barW = scaleLinear(set.size, 0, maxSetSize, 0, LAYOUT.leftBarsWidth);
    const barY = cy - barH / 2;
    const barX = leftBarsRight - barW;
    const rect = svgEl("rect", {
      x: String(barX),
      y: String(barY),
      width: String(barW),
      height: String(barH),
      fill: `url(#${PATTERN_ID_COMBO})`,
      stroke: COLOR_BAR_STROKE,
      "stroke-width": "1",
      class: "set-bar",
    });
    rect.appendChild(svgTitle(`${set.name}\nStores with this set: ${set.size}`));
    wireSelectable(
      rect,
      {
        type: "set",
        market: meta.market,
        dimension: meta.dimension,
        label: set.name,
        sets: [set.name],
        stores: set.elementIds,
        count: set.size,
      },
      onSelect,
    );
    chartLayer.appendChild(rect);

    chartLayer.appendChild(
      svgText(String(set.size), {
        x: setSizeCountX,
        y: cy + 4,
        anchor: "end",
        fill: COLOR_MUTED,
        size: 10,
      }),
    );

    chartLayer.appendChild(
      svgText(set.name, {
        x: setNameLabelX,
        y: cy + 4,
        anchor: "end",
        fill: COLOR_TEXT,
        size: 12,
      }),
    );
  });

  // ---------- MATRIX ----------
  const matrixGroup = svgEl("g", { class: "matrix" });

  // Alternating row backgrounds for readability.
  for (let j = 0; j < numRows; j++) {
    if (j % 2 === 1) continue;
    matrixGroup.appendChild(
      svgEl("rect", {
        x: String(matrixOriginX),
        y: String(matrixOriginY + j * LAYOUT.cellHeight),
        width: String(matrixWidth),
        height: String(LAYOUT.cellHeight),
        fill: COLOR_GRID_ALT,
      }),
    );
  }

  const setIndex = new Map(
    trimmed.shownSets.map((s, j) => [s.name, j]),
  );

  trimmed.shownCombinations.forEach((combo, i) => {
    const cx = matrixOriginX + i * LAYOUT.cellWidth + LAYOUT.cellWidth / 2;

    // Connector line between filled dots in this column (only sets that
    // are actually shown — sets folded into "+ M more" are not drawn).
    const memberRows = combo.sets
      .map((name) => setIndex.get(name))
      .filter((idx): idx is number => idx != null);
    if (memberRows.length >= 2) {
      const minRow = Math.min(...memberRows);
      const maxRow = Math.max(...memberRows);
      matrixGroup.appendChild(
        svgEl("line", {
          x1: String(cx),
          x2: String(cx),
          y1: String(matrixOriginY + minRow * LAYOUT.cellHeight + LAYOUT.cellHeight / 2),
          y2: String(matrixOriginY + maxRow * LAYOUT.cellHeight + LAYOUT.cellHeight / 2),
          stroke: COLOR_CONNECTOR,
          "stroke-width": "2",
          "stroke-linecap": "round",
        }),
      );
    }

    // Dots: one per row of shown sets.
    for (let j = 0; j < numRows; j++) {
      const cy = matrixOriginY + j * LAYOUT.cellHeight + LAYOUT.cellHeight / 2;
      const isMember = memberRows.includes(j);
      const dot = svgEl("circle", {
        cx: String(cx),
        cy: String(cy),
        r: String(LAYOUT.dotRadius),
        fill: isMember ? COLOR_DOT_ON : COLOR_DOT_OFF,
        stroke: "none",
        class: isMember ? "dot-on" : "dot-off",
      });
      if (isMember) {
        wireSelectable(
          dot,
          {
            type: "combination",
            market: meta.market,
            dimension: meta.dimension,
            label:
              combo.sets.length === 0 ? "(no sets)" : combo.sets.join(" ∩ "),
            sets: combo.sets,
            stores: combo.elementIds,
            count: combo.size,
          },
          onSelect,
        );
      }
      matrixGroup.appendChild(dot);
    }
  });

  // Other column area: leave matrix region empty / dim.
  if (trimmed.otherBucket) {
    const idx = trimmed.shownCombinations.length;
    const cellX = matrixOriginX + idx * LAYOUT.cellWidth;
    matrixGroup.appendChild(
      svgEl("rect", {
        x: String(cellX),
        y: String(matrixOriginY),
        width: String(LAYOUT.cellWidth),
        height: String(matrixHeight),
        fill: COLOR_GRID,
        stroke: COLOR_BAR_OTHER_STROKE,
        "stroke-width": "1",
      }),
    );
    matrixGroup.appendChild(
      svgText("\u2026", {
        x: cellX + LAYOUT.cellWidth / 2,
        y: matrixOriginY + matrixHeight / 2 + 4,
        anchor: "middle",
        fill: COLOR_MUTED,
        size: 14,
      }),
    );
  }

  chartLayer.appendChild(matrixGroup);

  // Footnotes / provenance: shown only in #caption-strip (HTML), not duplicated in SVG export.
  const captionLines = flattenFootnoteLines(footnoteRuns);

  svg.appendChild(chartLayer);

  host.replaceChildren(svg);

  return {
    svg,
    trim: {
      totalElements,
      totalSets: summary.sets.length,
      totalCombinations: summary.combinations.length,
      shownSets: trimmed.shownSets.length,
      shownCombinations: trimmed.shownCombinations.length,
      hiddenSets: trimmed.hiddenSetsCount,
      otherCombinationsCount: trimmed.otherBucket?.combinations.length ?? 0,
      otherStoresCount: trimmed.otherBucket?.totalSize ?? 0,
    },
    captionLines,
  };
}

// ---------- Trimming pipeline ----------

interface TrimResult {
  shownSets: SetSummary[];
  hiddenSetsCount: number;
  shownCombinations: Combination[];
  otherBucket?: {
    combinations: Combination[];
    totalSize: number;
  };
}

function applyTrim(
  summary: CombinationSummary,
  options: RenderOptions,
): TrimResult {
  // 1. Top-N sets (by size desc — ties broken by name). topNSets <= 0 = all.
  const sortedSets = [...summary.sets].sort(
    (a, b) => b.size - a.size || (a.name < b.name ? -1 : 1),
  );
  const setCap =
    options.topNSets <= 0 ? sortedSets.length : options.topNSets;
  const shownSets = sortedSets.slice(0, setCap);
  const hiddenSetsCount = Math.max(0, sortedSets.length - shownSets.length);

  // 2. Filter combinations: hide empty intersection if requested,
  //    apply min size, sort, then top-N + Other rollup.
  let combos = summary.combinations.filter(
    (c) => c.size >= options.minCombinationSize,
  );
  if (options.hideEmptyIntersection) {
    combos = combos.filter((c) => c.sets.length > 0);
  }

  combos = sortCombinations(combos, options.sortMode);

  let shown: Combination[];
  let other: Combination[];
  const comboCap =
    options.topNCombinations <= 0 ? combos.length : options.topNCombinations;
  if (combos.length > comboCap) {
    shown = combos.slice(0, comboCap);
    other = combos.slice(comboCap);
  } else {
    shown = combos;
    other = [];
  }

  const result: TrimResult = {
    shownSets,
    hiddenSetsCount,
    shownCombinations: shown,
  };
  if (options.otherRollup && other.length > 0) {
    result.otherBucket = {
      combinations: other,
      totalSize: other.reduce((acc, c) => acc + c.size, 0),
    };
  }
  return result;
}

function sortCombinations(
  combos: Combination[],
  mode: RenderOptions["sortMode"],
): Combination[] {
  const cmp = {
    size_desc: (a: Combination, b: Combination) =>
      b.size - a.size || a.sets.length - b.sets.length,
    degree_asc: (a: Combination, b: Combination) =>
      a.sets.length - b.sets.length || b.size - a.size,
    degree_desc: (a: Combination, b: Combination) =>
      b.sets.length - a.sets.length || b.size - a.size,
    name_asc: (a: Combination, b: Combination) => {
      const an = a.sets.join("|");
      const bn = b.sets.join("|");
      return an < bn ? -1 : an > bn ? 1 : 0;
    },
  }[mode];
  return [...combos].sort(cmp);
}

interface FootnoteRun {
  lines: string[];
}

/** Numbered endnotes: [1] identity, [2] counts + source, [3] optional notes. */
function buildCaptionFootnoteRuns(
  meta: InputMeta,
  totalElements: number,
  trim: TrimResult,
  wrapChars: number,
): FootnoteRun[] {
  const line1 =
    `${meta.market} \u00b7 ${meta.dimension} \u00b7 snapshot ${meta.snapshot} ` +
    `\u00b7 evidence: ${meta.evidence}`;

  const shownComboTotal =
    trim.shownCombinations.length + (trim.otherBucket ? 1 : 0);
  const rolledNote = trim.otherBucket
    ? ` (${trim.shownCombinations.length} shown + ${trim.otherBucket.combinations.length} rolled into Other = ${trim.otherBucket.totalSize} stores)`
    : "";
  const setsNote =
    trim.hiddenSetsCount > 0
      ? ` (top ${trim.shownSets.length} of ${trim.shownSets.length + trim.hiddenSetsCount} sets shown; +${trim.hiddenSetsCount} folded into legend residual)`
      : "";

  const line2 =
    `n=${totalElements} stores  \u00b7  k=${trim.shownSets.length} sets${setsNote}  \u00b7  ` +
    `m=${shownComboTotal} columns rendered${rolledNote}`;

  const line2WithSource = `${line2}  \u00b7  source: ${meta.source}`;

  const runs: FootnoteRun[] = [
    { lines: wrapTextToLines(`[1] ${line1}`, wrapChars) },
    { lines: wrapTextToLines(`[2] ${line2WithSource}`, wrapChars) },
  ];
  const notes = meta.notes?.trim();
  if (notes) {
    runs.push({ lines: wrapTextToLines(`[3] ${notes}`, wrapChars) });
  }
  return runs;
}

function flattenFootnoteLines(runs: FootnoteRun[]): string[] {
  return runs.flatMap((r) => r.lines);
}

function wrapTextToLines(text: string, maxChars: number): string[] {
  const limit = Math.max(8, maxChars);
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (trial.length <= limit) {
      cur = trial;
      continue;
    }
    if (cur) lines.push(cur);
    if (w.length <= limit) {
      cur = w;
      continue;
    }
    let rest = w;
    while (rest.length > limit) {
      lines.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    cur = rest;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- SVG helpers ----------

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

interface SvgTextOpts {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  fill?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

function svgText(text: string, opts: SvgTextOpts): SVGElement {
  const el = document.createElementNS(SVG_NS, "text");
  el.setAttribute("x", String(opts.x));
  el.setAttribute("y", String(opts.y));
  el.setAttribute("text-anchor", opts.anchor ?? "start");
  el.setAttribute("fill", opts.fill ?? COLOR_TEXT);
  el.setAttribute("font-size", String(opts.size ?? 12));
  el.setAttribute(
    "font-family",
    "system-ui, -apple-system, 'Segoe UI', sans-serif",
  );
  if (opts.bold) el.setAttribute("font-weight", "600");
  if (opts.italic) el.setAttribute("font-style", "italic");
  el.textContent = text;
  return el;
}

function svgTitle(text: string): SVGElement {
  const el = document.createElementNS(SVG_NS, "title");
  el.textContent = text;
  return el;
}

function wireSelectable(
  el: SVGElement,
  payload: DrilldownSelection,
  onSelect?: (selection: DrilldownSelection) => void,
): void {
  if (!onSelect) return;
  el.classList.add("clickable-target");
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.addEventListener("click", () => onSelect(payload));
  el.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    onSelect(payload);
  });
}

/**
 * Market flag (circle-flags CDN, MIT) clipped round + bold title line on the
 * figure itself so downloaded SVGs carry the same branding as the workbench.
 */
function appendFigureHeader(
  defs: SVGElement,
  chartLayer: SVGElement,
  meta: InputMeta,
): void {
  const headerMidY = LAYOUT.pad + FIGURE_HEADER_BAND / 2;
  const flagR = FIGURE_FLAG_PX / 2 - 0.5;
  const flagCx = LAYOUT.pad + FIGURE_FLAG_PX / 2 + 2;
  const flagCy = headerMidY;
  const clipId = `rfm-fig-flag-${++figureFlagClipSeq}`;

  const cp = svgEl("clipPath", { id: clipId });
  cp.appendChild(
    svgEl("circle", {
      cx: String(flagCx),
      cy: String(flagCy),
      r: String(flagR),
    }),
  );
  defs.appendChild(cp);

  const code = marketToCircleFlagCode(meta.market);
  const href = `${CIRCLE_FLAGS_BASE}${code}.svg`;
  const side = flagR * 2 + 4;

  const g = svgEl("g", { class: "figure-header" });
  const img = svgEl("image", {
    href,
    x: String(flagCx - side / 2),
    y: String(flagCy - side / 2),
    width: String(side),
    height: String(side),
    preserveAspectRatio: "xMidYMid slice",
    "clip-path": `url(#${clipId})`,
  });
  img.appendChild(
    svgTitle(
      `${meta.market} (${code}) — flag: HatScripts circle-flags (MIT), hatscripts.github.io`,
    ),
  );
  g.appendChild(img);
  g.appendChild(
    svgEl("circle", {
      cx: String(flagCx),
      cy: String(flagCy),
      r: String(flagR + 0.5),
      fill: "none",
      stroke: "#d4d4d4",
      "stroke-width": "1",
    }),
  );

  const titleStr = `${meta.market} · ${formatDimensionLabel(meta.dimension)}`;
  const ty = headerMidY + 5;
  const t = svgText(titleStr, {
    x: flagCx + flagR + 14,
    y: ty,
    fill: COLOR_TEXT,
    size: 15,
    bold: true,
  });
  t.appendChild(svgTitle(`${titleStr} · ${meta.snapshot}`));
  g.appendChild(t);

  chartLayer.appendChild(g);
}

function ensureDefs(svg: SVGSVGElement): SVGElement {
  let defs = svg.querySelector("defs") as SVGElement | null;
  if (!defs) {
    defs = svgEl("defs", {});
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

/** 45° diagonal hatch; tile size chosen so perpendicular line spacing ≈ 3px. */
function appendComboBarPatterns(defs: SVGElement): void {
  if (defs.querySelector(`#${PATTERN_ID_COMBO}`)) return;
  const w = String(HATCH_TILE);
  const h = String(HATCH_TILE);

  const combo = svgEl("pattern", {
    id: PATTERN_ID_COMBO,
    patternUnits: "userSpaceOnUse",
    width: w,
    height: h,
  });
  combo.appendChild(
    svgEl("rect", {
      x: "0",
      y: "0",
      width: w,
      height: h,
      fill: COLOR_BAR_PATTERN_BASE,
    }),
  );
  combo.appendChild(
    svgEl("line", {
      x1: "0",
      y1: "0",
      x2: w,
      y2: h,
      stroke: COLOR_BAR_HATCH_LINE,
      "stroke-width": "1",
    }),
  );
  defs.appendChild(combo);

  const other = svgEl("pattern", {
    id: PATTERN_ID_OTHER,
    patternUnits: "userSpaceOnUse",
    width: w,
    height: h,
  });
  other.appendChild(
    svgEl("rect", {
      x: "0",
      y: "0",
      width: w,
      height: h,
      fill: COLOR_BAR_OTHER_PATTERN_BASE,
    }),
  );
  other.appendChild(
    svgEl("line", {
      x1: "0",
      y1: "0",
      x2: w,
      y2: h,
      stroke: COLOR_BAR_OTHER_HATCH_LINE,
      "stroke-width": "1",
    }),
  );
  defs.appendChild(other);
}

// ---------- Math helpers ----------

function scaleLinear(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): number {
  if (domainMax === domainMin) return rangeMin;
  const t = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + t * (rangeMax - rangeMin);
}

function niceTicks(maxValue: number, target: number): number[] {
  if (maxValue <= 0) return [0];
  const rough = maxValue / target;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 5, 10].map((c) => c * pow);
  const step =
    candidates.find((c) => Math.ceil(maxValue / c) <= target + 1) ??
    candidates[candidates.length - 1];
  const ticks: number[] = [];
  for (let v = 0; v <= maxValue + step / 2; v += step) {
    ticks.push(Math.round(v));
  }
  if (ticks[ticks.length - 1] < maxValue) ticks.push(maxValue);
  return Array.from(new Set(ticks));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
