import "./style.css";
import ukPassBYaml from "./samples/synthetic-uk-passb.yaml?raw";
import dePassBYaml from "./samples/synthetic-de-passb.yaml?raw";
import plPassBYaml from "./samples/synthetic-pl-passb.yaml?raw";
import nlPassBYaml from "./samples/synthetic-nl-passb.yaml?raw";
import ukParamsPassBYaml from "./samples/synthetic-uk-parameters-passb.yaml?raw";
import plParamsPassBYaml from "./samples/synthetic-pl-parameters-passb.yaml?raw";
import ukDualPassBYaml from "./samples/synthetic-uk-dual-passb.yaml?raw";
import deDualPassBYaml from "./samples/synthetic-de-dual-passb.yaml?raw";
import plDualPassBYaml from "./samples/synthetic-pl-dual-passb.yaml?raw";
import nlDualPassBYaml from "./samples/synthetic-nl-dual-passb.yaml?raw";
import { parseInput, ParseError } from "./parse";
import { extractCombinations } from "./combinations";
import {
  renderUpset,
  type DrilldownSelection,
} from "./render-upset";
import { mountControls } from "./controls";
import { downloadSvg } from "./export";
import {
  DEFAULT_RENDER_OPTIONS,
  type ParseResult,
  type RenderOptions,
} from "./types";
import {
  bindHeaderFlagErrorHandler,
  formatDimensionLabel,
  syncHeaderBrand,
} from "./header-brand";

interface SampleEntry {
  id: string;
  label: string;
  body: string;
}

const SAMPLES: SampleEntry[] = [
  {
    id: "uk-dual-passb",
    label: "UK — dual (menu-sets + features, 1500 stores)",
    body: ukDualPassBYaml,
  },
  {
    id: "de-dual-passb",
    label: "DE — dual (menu-sets + features, 1473 stores)",
    body: deDualPassBYaml,
  },
  {
    id: "pl-dual-passb",
    label:
      "PL — dual (~700 restaurants; 12–13 live menu-sets; 70 catalog-only + features)",
    body: plDualPassBYaml,
  },
  {
    id: "nl-dual-passb",
    label: "NL — dual (menu-sets + features, 270 stores)",
    body: nlDualPassBYaml,
  },
  {
    id: "uk-passb",
    label: "UK — synthetic Pass B (1500 stores, 14 menu-sets)",
    body: ukPassBYaml,
  },
  {
    id: "de-passb",
    label: "DE — synthetic Pass B (1473 stores, 8 menu-sets, long tail)",
    body: dePassBYaml,
  },
  {
    id: "pl-passb",
    label:
      "PL — synthetic Pass B (~700 restaurants; ~12–13 live menu-sets; 70 unassigned)",
    body: plPassBYaml,
  },
  {
    id: "nl-passb",
    label:
      "NL — synthetic Pass B (270 stores, 24 estate menu-sets, uniform)",
    body: nlPassBYaml,
  },
  {
    id: "uk-params-passb",
    label:
      "UK — synthetic Pass B, features (1500 stores, high k, SYS/CUST mix)",
    body: ukParamsPassBYaml,
  },
  {
    id: "pl-params-passb",
    label:
      "PL — synthetic Pass B, features (~700 restaurants, low k; ~12–14 menu attrs)",
    body: plParamsPassBYaml,
  },
];

// v15: PL n ~700 restaurants (was 1600).
const STORAGE_KEY = "rfm-upset-workbench/last-yaml/v15";
const MAX_VISIBLE_STORE_IDS = 200;

interface AppState {
  parseResult?: ParseResult;
  options: RenderOptions;
  lastSvgSingle?: SVGSVGElement;
  lastSvgMenu?: SVGSVGElement;
  lastSvgParams?: SVGSVGElement;
}

const state: AppState = {
  options: { ...DEFAULT_RENDER_OPTIONS },
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

function init(): void {
  const yamlInput = $("yaml-input") as HTMLTextAreaElement;
  const banner = $("parse-banner");
  const plotStack = $("plot-stack");
  const captionStrip = $("caption-strip");
  const samplePicker = $("sample-picker") as HTMLSelectElement;
  const loadFileBtn = $("load-file-btn") as HTMLButtonElement;
  const fileInput = $("file-input") as HTMLInputElement;
  const downloadBtn = $("download-svg") as HTMLButtonElement;
  const downloadMenuBtn = $("download-svg-menu") as HTMLButtonElement;
  const downloadParamsBtn = $("download-svg-params") as HTMLButtonElement;
  const controlsHost = $("controls-grid");
  const inspector = $("selection-inspector") as HTMLDetailsElement;
  const inspectorSummary = $("selection-summary");
  const inspectorMeta = $("selection-meta");
  const inspectorStoreList = $("selection-store-list");
  const inspectorCopyBtn = $("selection-copy") as HTMLButtonElement;

  bindHeaderFlagErrorHandler();
  let selectedStoreIds: string[] = [];

  inspectorCopyBtn.addEventListener("click", async () => {
    if (selectedStoreIds.length === 0) return;
    const payload = selectedStoreIds.join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      inspectorCopyBtn.textContent = "Copied";
      window.setTimeout(() => {
        inspectorCopyBtn.textContent = "Copy store IDs";
      }, 900);
    } catch {
      inspectorCopyBtn.textContent = "Copy failed";
      window.setTimeout(() => {
        inspectorCopyBtn.textContent = "Copy store IDs";
      }, 1200);
    }
  });

  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "\u2014 custom \u2014";
  samplePicker.appendChild(customOpt);
  for (const s of SAMPLES) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    samplePicker.appendChild(opt);
  }
  samplePicker.addEventListener("change", () => {
    const s = SAMPLES.find((x) => x.id === samplePicker.value);
    if (s) {
      yamlInput.value = s.body;
      reparseAndRender();
    }
  });

  loadFileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    yamlInput.value = text;
    reparseAndRender();
    fileInput.value = "";
  });

  yamlInput.addEventListener("input", () => {
    reparseAndRender();
  });

  mountControls(controlsHost, state.options, (next) => {
    state.options = next;
    rerender();
  });

  downloadBtn.addEventListener("click", () => {
    if (!state.parseResult || state.parseResult.kind !== "single") return;
    if (!state.lastSvgSingle) {
      flashBanner(banner, "Nothing rendered yet \u2014 paste or load a YAML first.", "warn");
      return;
    }
    downloadSvg(state.lastSvgSingle, state.parseResult.parsed.meta);
  });

  downloadMenuBtn.addEventListener("click", () => {
    if (!state.parseResult || state.parseResult.kind !== "dual") return;
    if (!state.lastSvgMenu) return;
    downloadSvg(state.lastSvgMenu, state.parseResult.menuSets.meta);
  });

  downloadParamsBtn.addEventListener("click", () => {
    if (!state.parseResult || state.parseResult.kind !== "dual") return;
    if (!state.lastSvgParams) return;
    downloadSvg(state.lastSvgParams, state.parseResult.parameters.meta);
  });

  const restored = readStorage();
  if (restored) {
    yamlInput.value = restored;
    const matchingSample = SAMPLES.find((s) => s.body === restored);
    samplePicker.value = matchingSample ? matchingSample.id : "__custom__";
  } else {
    yamlInput.value = SAMPLES[0].body;
    samplePicker.value = SAMPLES[0].id;
  }
  reparseAndRender();

  yamlInput.addEventListener("input", () => {
    const matchingSample = SAMPLES.find((s) => s.body === yamlInput.value);
    samplePicker.value = matchingSample ? matchingSample.id : "__custom__";
  });

  function reparseAndRender(): void {
    const text = yamlInput.value;
    writeStorage(text);
    if (text.trim() === "") {
      banner.hidden = true;
      plotStack.replaceChildren();
      captionStrip.replaceChildren();
      state.parseResult = undefined;
      state.lastSvgSingle = undefined;
      state.lastSvgMenu = undefined;
      state.lastSvgParams = undefined;
      syncExportButtons(false);
      syncHeaderBrand(undefined);
      clearSelectionInspector();
      return;
    }
    try {
      const parsed = parseInput(text);
      state.parseResult = parsed;
      syncHeaderBrand(parsed);
      banner.hidden = true;
      banner.textContent = "";
      rerender();
    } catch (err) {
      const msg =
        err instanceof ParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      flashBanner(banner, msg, "error");
      state.parseResult = undefined;
      state.lastSvgSingle = undefined;
      state.lastSvgMenu = undefined;
      state.lastSvgParams = undefined;
      plotStack.replaceChildren();
      captionStrip.replaceChildren();
      syncExportButtons(false);
      syncHeaderBrand(undefined);
      clearSelectionInspector();
    }
  }

  function clearSelectionInspector(): void {
    selectedStoreIds = [];
    inspector.hidden = true;
    inspector.open = false;
    inspectorSummary.textContent = "Selection inspector";
    inspectorMeta.textContent = "";
    inspectorStoreList.textContent = "";
    inspectorCopyBtn.textContent = "Copy store IDs";
  }

  function showSelectionInspector(
    selection: DrilldownSelection,
    viewLabel: string,
  ): void {
    const stores = selection.stores;
    selectedStoreIds = stores;
    inspector.hidden = false;
    inspector.open = true;
    inspectorSummary.textContent =
      `${selection.count} stores · ${viewLabel} · ${selection.label}`;
    inspectorMeta.textContent =
      `${selection.market} · ${formatDimensionLabel(selection.dimension)} · ` +
      `${selection.type} selection`;

    const visible = stores.slice(0, MAX_VISIBLE_STORE_IDS);
    const lines = visible.join(", ");
    if (stores.length > MAX_VISIBLE_STORE_IDS) {
      inspectorStoreList.textContent =
        `${lines}\n\n... +${stores.length - MAX_VISIBLE_STORE_IDS} more store IDs (copy to get full list).`;
      return;
    }
    inspectorStoreList.textContent = lines;
  }

  function syncExportButtons(isDual: boolean): void {
    downloadBtn.hidden = isDual;
    downloadMenuBtn.hidden = !isDual;
    downloadParamsBtn.hidden = !isDual;
  }

  function rerender(): void {
    if (!state.parseResult) return;
    const pr = state.parseResult;
    plotStack.replaceChildren();
    captionStrip.replaceChildren();
    clearSelectionInspector();
    state.lastSvgSingle = undefined;
    state.lastSvgMenu = undefined;
    state.lastSvgParams = undefined;

    if (pr.kind === "single") {
      syncExportButtons(false);
      const summary = extractCombinations(pr.parsed.elements);
      const result = renderUpset(
        plotStack,
        pr.parsed.meta,
        pr.parsed.elements.length,
        summary,
        state.options,
        (selection) => {
          showSelectionInspector(
            selection,
            formatDimensionLabel(pr.parsed.meta.dimension),
          );
        },
      );
      state.lastSvgSingle = result.svg;
      for (const line of result.captionLines) {
        const div = document.createElement("div");
        div.className = "caption-foot-line";
        div.textContent = line;
        captionStrip.appendChild(div);
      }
      return;
    }

    syncExportButtons(true);

    const dualNote = document.createElement("div");
    dualNote.className = "caption-foot-line dual-strip-lede";
    dualNote.textContent =
      `${pr.menuSets.meta.market} · dual input (${pr.menuSets.meta.snapshot}) · ` +
      `${pr.menuSets.meta.evidence} · ${pr.menuSets.meta.source}`;
    captionStrip.appendChild(dualNote);

    const mkPanel = (
      title: string,
      parsed: typeof pr.menuSets,
    ): { svg: SVGSVGElement; captionLines: string[] } => {
      const fig = document.createElement("figure");
      fig.className = "plot-panel";
      const h = document.createElement("h3");
      h.className = "plot-panel-title";
      h.textContent = title;
      const host = document.createElement("div");
      host.className = "plot-host";
      fig.appendChild(h);
      fig.appendChild(host);
      plotStack.appendChild(fig);
      const summary = extractCombinations(parsed.elements);
      return renderUpset(
        host,
        parsed.meta,
        parsed.elements.length,
        summary,
        state.options,
        (selection) => {
          showSelectionInspector(selection, title);
        },
      );
    };

    const rMenu = mkPanel("Menu sets", pr.menuSets);
    state.lastSvgMenu = rMenu.svg;
    const capMenu = document.createElement("div");
    capMenu.className = "caption-block";
    for (const line of rMenu.captionLines) {
      const div = document.createElement("div");
      div.className = "caption-foot-line";
      div.textContent = line;
      capMenu.appendChild(div);
    }
    captionStrip.appendChild(capMenu);

    const rParams = mkPanel("Features", pr.parameters);
    state.lastSvgParams = rParams.svg;
    const capParams = document.createElement("div");
    capParams.className = "caption-block";
    for (const line of rParams.captionLines) {
      const div = document.createElement("div");
      div.className = "caption-foot-line";
      div.textContent = line;
      capParams.appendChild(div);
    }
    captionStrip.appendChild(capParams);
  }
}

function flashBanner(
  el: HTMLElement,
  message: string,
  kind: "error" | "warn",
): void {
  el.hidden = false;
  el.textContent = message;
  el.className = `banner banner-${kind}`;
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Quota / disabled storage is fine to ignore for a workbench tool.
  }
}

init();
