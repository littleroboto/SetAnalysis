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
import { animate, stagger } from "motion";
import { initLandingHero } from "./landing-hero";
import {
  mountYamlEditor,
  lineColumnToOffset,
  type YamlEditorHandle,
  type Diagnostic,
} from "./yaml-editor";

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

function llmQueryEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("llm") === "1";
}

function workbenchViewEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "workbench";
}

/**
 * Demo mode (`?demo=1`) gates the bundled synthetic samples. Without it the
 * sample picker is hidden, the editor opens empty, and the landing hero
 * renders with anonymised set labels (Menu #1, Menu #2, …) and no flag /
 * market header — so the page can be shared without leaking demo data shape.
 */
function demoModeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1";
}

function buildWorkbenchHref(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "workbench");
  return `${url.pathname}${url.search}${url.hash}`;
}

function buildLandingHref(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  return `${url.pathname}${url.search}${url.hash}`;
}

function buildLlmContextPreview(pr: ParseResult | undefined): string {
  const framing = {
    purpose: "variance discovery, not remediation",
    phases: ["catalog surface", "store assignment", "derived residue and concentration"],
    evidence_grades: ["output_only", "input_config", "inferred", "SME_confirmed"],
    caveat: "single-store package evidence is not estate-wide truth",
  };

  if (!pr) {
    return JSON.stringify(
      {
        framing,
        status: "No parsed YAML loaded",
      },
      null,
      2,
    );
  }

  if (pr.kind === "single") {
    return JSON.stringify(
      {
        framing,
        kind: "single",
        meta: pr.parsed.meta,
        summary: {
          element_count: pr.parsed.elements.length,
          distinct_sets: new Set(pr.parsed.elements.flatMap((e) => e.sets)).size,
        },
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      framing,
      kind: "dual",
      menu_sets: {
        meta: pr.menuSets.meta,
        element_count: pr.menuSets.elements.length,
        distinct_sets: new Set(pr.menuSets.elements.flatMap((e) => e.sets)).size,
      },
      features: {
        meta: pr.parameters.meta,
        element_count: pr.parameters.elements.length,
        distinct_sets: new Set(pr.parameters.elements.flatMap((e) => e.sets)).size,
      },
    },
    null,
    2,
  );
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

function init(): void {
  const landingRoot = document.getElementById("landing");
  const appRoot = document.getElementById("app");
  const openWorkbenchTop = document.getElementById("open-workbench-link-top") as
    | HTMLAnchorElement
    | null;
  const backToLanding = document.getElementById("back-to-landing-link") as
    | HTMLAnchorElement
    | null;

  const workbenchHref = buildWorkbenchHref();
  if (openWorkbenchTop) openWorkbenchTop.href = workbenchHref;
  if (backToLanding) backToLanding.href = buildLandingHref();

  if (!workbenchViewEnabled()) {
    if (landingRoot) landingRoot.hidden = false;
    if (appRoot) appRoot.hidden = true;
    initLandingHero({ yaml: ukDualPassBYaml, demoMode: demoModeEnabled() });
    return;
  }

  if (landingRoot) landingRoot.hidden = true;
  if (appRoot) appRoot.hidden = false;

  const yamlHost = $("yaml-input-host");
  const yamlSection = yamlHost.closest<HTMLElement>(".left-section");
  const yamlExpandBtn = $("yaml-expand-btn") as HTMLButtonElement;
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
  const inspector = $("selection-inspector") as HTMLElement;
  const inspectorToggle = $("selection-toggle") as HTMLButtonElement;
  const inspectorBody = $("selection-body") as HTMLElement;
  const inspectorSummary = $("selection-summary");
  const inspectorMeta = $("selection-meta");
  const inspectorStoreList = $("selection-store-list");
  const inspectorCopyBtn = $("selection-copy") as HTMLButtonElement;
  const llmOpenBtn = document.getElementById("llm-open-btn") as
    | HTMLButtonElement
    | null;
  const llmModal = document.getElementById("llm-modal") as HTMLDialogElement | null;
  const llmRefreshBtn = document.getElementById("llm-refresh-btn") as
    | HTMLButtonElement
    | null;
  const llmContextPreview = document.getElementById("llm-context-preview") as
    | HTMLTextAreaElement
    | null;

  bindHeaderFlagErrorHandler();
  let selectedStoreIds: string[] = [];

  if (llmQueryEnabled() && llmOpenBtn && llmModal && llmRefreshBtn && llmContextPreview) {
    llmOpenBtn.hidden = false;
    const syncLlmPreview = () => {
      llmContextPreview.value = buildLlmContextPreview(state.parseResult);
    };
    llmOpenBtn.addEventListener("click", () => {
      syncLlmPreview();
      llmModal.showModal();
    });
    llmRefreshBtn.addEventListener("click", () => {
      syncLlmPreview();
    });
    syncLlmPreview();
  }

  inspectorCopyBtn.addEventListener("click", async () => {
    if (selectedStoreIds.length === 0) return;
    const payload = selectedStoreIds.join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      flashCopySuccess(inspectorCopyBtn, "Copied");
    } catch {
      flashCopySuccess(inspectorCopyBtn, "Copy failed", true);
    }
  });

  inspectorToggle.addEventListener("click", () => {
    const isOpen = inspector.dataset.open === "true";
    setInspectorOpen(!isOpen);
  });

  // YAML editor expand toggle: flips a data-expanded flag on the section so
  // CSS can resize the CodeMirror panel; rAF gives layout a tick before
  // requestMeasure so gutters/scrollbars realign cleanly.
  yamlExpandBtn.addEventListener("click", () => {
    if (!yamlSection) return;
    const next = yamlSection.dataset.expanded !== "true";
    yamlSection.dataset.expanded = String(next);
    yamlExpandBtn.setAttribute("aria-pressed", String(next));
    yamlExpandBtn.setAttribute(
      "aria-label",
      next ? "Collapse editor" : "Expand editor",
    );
    yamlExpandBtn.title = next ? "Collapse editor" : "Expand editor";
    requestAnimationFrame(() => editor.view.requestMeasure());
  });

  const demoMode = demoModeEnabled();

  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "\u2014 custom \u2014";
  samplePicker.appendChild(customOpt);
  if (demoMode) {
    for (const s of SAMPLES) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      samplePicker.appendChild(opt);
    }
  } else {
    // No demo mode: hide the picker (label + dropdown) so the workbench has
    // no synthetic data on offer; the "Load file…" button stays visible so
    // users can bring their own YAML.
    const pickerLabel = document.querySelector<HTMLLabelElement>(
      'label[for="sample-picker"]',
    );
    if (pickerLabel) pickerLabel.hidden = true;
    samplePicker.hidden = true;
  }

  // Initial body: in demo mode prefer non-empty storage > first sample.
  // Without demo, start from storage but never restore a body that happens to
  // equal one of the bundled samples (a previous demo-mode session may have
  // persisted it), so a non-demo URL really shows no demo data. Empty / blank
  // storage is treated as "no stored content" in either mode.
  const storedRaw = readStorage();
  const stored = storedRaw && storedRaw.trim() !== "" ? storedRaw : null;
  const storedIsSample =
    stored != null && SAMPLES.some((s) => s.body === stored);
  const initialBody = demoMode
    ? (stored ?? SAMPLES[0].body)
    : (stored != null && !storedIsSample ? stored : "");

  const editor: YamlEditorHandle = mountYamlEditor(yamlHost, {
    initial: initialBody,
    onChange: (text) => {
      reparseAndRender(text);
      const matchingSample = SAMPLES.find((s) => s.body === text);
      samplePicker.value = matchingSample ? matchingSample.id : "__custom__";
    },
  });

  samplePicker.addEventListener("change", () => {
    const s = SAMPLES.find((x) => x.id === samplePicker.value);
    if (s) {
      editor.setValue(s.body);
      // Set value triggers onChange, which reparses + re-renders.
    }
  });

  loadFileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    editor.setValue(text);
    fileInput.value = "";
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

  // Sync sample-picker label for the seeded body, then run the first parse.
  const initialSample = SAMPLES.find((s) => s.body === initialBody);
  samplePicker.value = initialSample ? initialSample.id : "__custom__";
  reparseAndRender(initialBody);

  // Page-load choreography. Honours prefers-reduced-motion.
  runWorkbenchEntryAnimation();

  function reparseAndRender(text: string): void {
    writeStorage(text);
    if (text.trim() === "") {
      banner.hidden = true;
      editor.setDiagnostics([]);
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
      editor.setDiagnostics([]);
      rerender();
    } catch (err) {
      const msg =
        err instanceof ParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      flashBanner(banner, msg, "error");
      // Surface the error inline as a CM6 diagnostic when we know the position.
      const diagnostic = parseErrorToDiagnostic(err, text);
      editor.setDiagnostics(diagnostic ? [diagnostic] : []);
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

  function parseErrorToDiagnostic(
    err: unknown,
    _text: string,
  ): Diagnostic | null {
    if (!(err instanceof ParseError)) return null;
    const pos = err.position;
    const editorState = editor.view.state;
    if (!pos) {
      // Schema-level error without a YAML mark: pin to start of doc so a gutter
      // marker still appears even though we can't be more precise.
      return {
        from: 0,
        to: Math.min(editorState.doc.length, editorState.doc.line(1).length),
        severity: "error",
        message: err.message,
        source: "SetAnalysis",
      };
    }
    const offset = lineColumnToOffset(editorState, pos.line, pos.column);
    // Highlight the line containing the offset for visibility.
    const line = editorState.doc.lineAt(offset);
    return {
      from: line.from,
      to: line.to,
      severity: "error",
      message: err.message,
      source: "SetAnalysis",
    };
  }

  function clearSelectionInspector(): void {
    selectedStoreIds = [];
    inspector.hidden = true;
    inspector.dataset.open = "false";
    inspectorBody.style.height = "";
    inspectorSummary.textContent = "Selection inspector";
    inspectorMeta.textContent = "";
    inspectorStoreList.textContent = "";
    inspectorCopyBtn.textContent = "Copy store IDs";
    inspectorCopyBtn.classList.remove("is-flash-success", "is-flash-error");
  }

  function setInspectorOpen(open: boolean, animateTransition = true): void {
    const next = open ? "true" : "false";
    if (inspector.dataset.open === next) return;
    inspector.dataset.open = next;
    inspectorToggle.setAttribute("aria-expanded", next);

    if (!animateTransition || prefersReducedMotion()) {
      inspectorBody.style.height = open ? "auto" : "0px";
      inspectorBody.style.opacity = open ? "1" : "0";
      return;
    }

    const start = inspectorBody.getBoundingClientRect().height;
    inspectorBody.style.height = `${start}px`;
    // Force layout so the next height change animates.
    void inspectorBody.offsetHeight;
    if (open) {
      inspectorBody.style.height = "auto";
      const target = inspectorBody.getBoundingClientRect().height;
      inspectorBody.style.height = `${start}px`;
      void inspectorBody.offsetHeight;
      animate(
        inspectorBody,
        { height: [`${start}px`, `${target}px`], opacity: [0.4, 1] },
        { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] },
      ).finished.then(() => {
        if (inspector.dataset.open === "true") {
          inspectorBody.style.height = "auto";
        }
      });
    } else {
      animate(
        inspectorBody,
        { height: [`${start}px`, "0px"], opacity: [1, 0] },
        { duration: 0.18, ease: [0.4, 0, 0.6, 1] },
      );
    }
  }

  function flashCopySuccess(
    btn: HTMLButtonElement,
    label: string,
    isError = false,
  ): void {
    btn.textContent = label;
    btn.classList.remove("is-flash-success", "is-flash-error");
    btn.classList.add(isError ? "is-flash-error" : "is-flash-success");
    window.setTimeout(() => {
      btn.textContent = "Copy store IDs";
      btn.classList.remove("is-flash-success", "is-flash-error");
    }, isError ? 1200 : 900);
  }

  function showSelectionInspector(
    selection: DrilldownSelection,
    viewLabel: string,
  ): void {
    const stores = selection.stores;
    selectedStoreIds = stores;
    const wasHidden = inspector.hidden;
    inspector.hidden = false;
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
    } else {
      inspectorStoreList.textContent = lines;
    }

    // First reveal slides the panel up + open; subsequent selections only
    // refresh content unless the user had collapsed it.
    if (wasHidden) {
      inspector.dataset.open = "false";
      inspectorBody.style.height = "0px";
      inspectorBody.style.opacity = "0";
      void inspector.offsetHeight;
      if (prefersReducedMotion()) {
        setInspectorOpen(true, false);
        return;
      }
      animate(
        inspector,
        { opacity: [0, 1], y: [8, 0] },
        { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] },
      );
      setInspectorOpen(true, true);
    } else if (inspector.dataset.open !== "true") {
      setInspectorOpen(true, true);
    }
  }

  function syncExportButtons(isDual: boolean): void {
    downloadBtn.hidden = isDual;
    downloadMenuBtn.hidden = !isDual;
    downloadParamsBtn.hidden = !isDual;
  }

  function rerender(): void {
    if (!state.parseResult) return;
    const pr = state.parseResult;

    // Cross-fade: nudge old contents out, swap, fade new in. Skipped under
    // prefers-reduced-motion so screenreaders / users with vestibular issues
    // get an instant update.
    if (!prefersReducedMotion()) {
      const outgoingChildren = [...plotStack.children, ...captionStrip.children];
      if (outgoingChildren.length > 0) {
        animate(
          outgoingChildren as Element[],
          { opacity: [1, 0] },
          { duration: 0.08, ease: "easeIn" },
        );
      }
    }

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
      fadeInPlotContents();
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
    fadeInPlotContents();
  }

  function fadeInPlotContents(): void {
    if (prefersReducedMotion()) return;
    const incoming = [...plotStack.children, ...captionStrip.children];
    if (incoming.length === 0) return;
    animate(
      incoming as Element[],
      { opacity: [0, 1], y: [4, 0] },
      { duration: 0.22, ease: "easeOut", delay: stagger(0.012) },
    );
  }

  function runWorkbenchEntryAnimation(): void {
    if (prefersReducedMotion()) return;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-stage='header'], [data-stage='left-1'], [data-stage='left-2'], [data-stage='left-3'], [data-stage='right']",
      ),
    );
    if (targets.length === 0) return;
    targets.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
    });
    animate(
      targets,
      { opacity: [0, 1], y: [6, 0] },
      { duration: 0.32, ease: [0.2, 0.7, 0.2, 1], delay: stagger(0.05) },
    ).finished.then(() => {
      // Clear inline styles so subsequent transforms (e.g. sticky) aren't capped.
      targets.forEach((el) => {
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
      });
    });
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
