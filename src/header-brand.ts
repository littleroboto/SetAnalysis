import type { ParseResult } from "./types";

/** MIT-licensed circular SVG flags — see https://github.com/HatScripts/circle-flags */
export const CIRCLE_FLAGS_BASE =
  "https://hatscripts.github.io/circle-flags/flags/";

/**
 * Map YAML `meta.market` (ISO-2 style) to circle-flags filename stem.
 * UK → gb (circle-flags uses ISO 3166-1 alpha-2).
 */
export function marketToCircleFlagCode(market: string): string {
  const m = market.trim().toUpperCase();
  if (m === "UK") return "gb";
  if (m.length === 2) return m.toLowerCase();
  return "un";
}

function metaFromParseResult(pr: ParseResult): {
  market: string;
  dimensionLabel: string;
} {
  if (pr.kind === "single") {
    return {
      market: pr.parsed.meta.market,
      dimensionLabel: pr.parsed.meta.dimension,
    };
  }
  return {
    market: pr.menuSets.meta.market,
    dimensionLabel: "dual",
  };
}

/**
 * Human-readable dimension for UI + exported SVG title.
 * YAML still uses `meta.dimension: parameters`; the workbench shows **features**
 * (same slice — estate naming).
 */
export function formatDimensionLabel(dim: string): string {
  if (dim === "parameters") return "features";
  return dim.replace(/_/g, " ");
}

/**
 * Updates the header flag (masked round in CSS) and market line from parse state.
 * Pass `undefined` when the textarea is empty or YAML failed to parse.
 */
export function syncHeaderBrand(pr: ParseResult | undefined): void {
  const wrap = document.getElementById("header-flag-wrap") as HTMLElement | null;
  const img = document.getElementById("header-flag") as HTMLImageElement | null;
  const marketLine = document.getElementById("header-market-line");
  if (!wrap || !img || !marketLine) return;

  if (!pr) {
    wrap.hidden = true;
    img.removeAttribute("src");
    img.alt = "";
    marketLine.textContent = "";
    marketLine.hidden = true;
    document.title = "RFM UpSet workbench";
    return;
  }

  const { market, dimensionLabel } = metaFromParseResult(pr);
  const code = marketToCircleFlagCode(market);
  wrap.hidden = false;
  img.src = `${CIRCLE_FLAGS_BASE}${code}.svg`;
  img.alt = `${market} (${code.toUpperCase()})`;
  marketLine.textContent = `${market} · ${formatDimensionLabel(dimensionLabel)}`;
  marketLine.hidden = false;
  document.title = `RFM UpSet · ${market}`;
}

/** Hide the flag chip if the CDN image fails (offline / blocked). */
export function bindHeaderFlagErrorHandler(): void {
  const wrap = document.getElementById("header-flag-wrap");
  const img = document.getElementById("header-flag") as HTMLImageElement | null;
  if (!wrap || !img) return;
  img.addEventListener("error", () => {
    wrap.hidden = true;
  });
}
