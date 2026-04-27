import type { InputMeta } from "./types";

/**
 * Serialise an inline SVG element to a standalone string and trigger a
 * download in the browser. The SVG is wrapped with the standard XML prolog
 * so Inkscape / preview tools open it cleanly.
 *
 * Phase 2 will add PNG export by canvas-rasterising this same SVG; doing it
 * now would expand scope without a current consumer.
 */
export function downloadSvg(svg: SVGSVGElement, meta: InputMeta): void {
  const cloned = svg.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  cloned.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const serialised = new XMLSerializer().serializeToString(cloned);
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${serialised}`;

  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = buildFilename(meta);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildFilename(meta: InputMeta): string {
  const safeMarket = sanitise(meta.market);
  const safeDim = sanitise(meta.dimension);
  const safeDate = sanitise(meta.snapshot);
  return `upset-${safeMarket}-${safeDim}-${safeDate}.svg`;
}

function sanitise(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_|_$/g, "") || "x";
}
