import {
  DEFAULT_RENDER_OPTIONS,
  type RenderOptions,
  type SortMode,
} from "./types";

export interface ControlsAPI {
  getOptions: () => RenderOptions;
  setOptions: (next: Partial<RenderOptions>) => void;
}

const SORT_LABELS: Record<SortMode, string> = {
  size_desc: "Size (descending)",
  degree_asc: "Degree (ascending)",
  degree_desc: "Degree (descending)",
  name_asc: "Set names (A\u2013Z)",
};

export function mountControls(
  host: HTMLElement,
  initial: Partial<RenderOptions>,
  onChange: (opts: RenderOptions) => void,
): ControlsAPI {
  const state: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...initial };

  host.replaceChildren();

  const numberRow = (
    label: string,
    key: "topNSets" | "topNCombinations" | "minCombinationSize",
    min: number,
    max: number,
    hint: string,
  ) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(state[key]);
    input.addEventListener("change", () => {
      const v = Number(input.value);
      if (Number.isFinite(v) && v >= min) {
        state[key] = Math.min(max, Math.max(min, Math.floor(v)));
        input.value = String(state[key]);
        onChange({ ...state });
      } else {
        input.value = String(state[key]);
      }
    });

    const help = document.createElement("span");
    help.className = "control-help";
    help.textContent = hint;

    lbl.appendChild(input);
    wrapper.appendChild(lbl);
    wrapper.appendChild(help);
    host.appendChild(wrapper);
  };

  numberRow(
    "Top-N sets (rows)",
    "topNSets",
    0,
    9999,
    "Primary legibility dial when k is large: caps matrix height. 0 = every distinct set; else keep the N largest by store count; remainder folds into the legend residual.",
  );
  numberRow(
    "Top-N intersections (columns)",
    "topNCombinations",
    0,
    99999,
    "Secondary to set trim for most readouts: caps intersection columns before Other. 0 = all combinations after filters below.",
  );
  numberRow(
    "Min intersection size",
    "minCombinationSize",
    1,
    1000,
    "Drop combinations below this store count.",
  );

  // Other rollup checkbox
  {
    const wrapper = document.createElement("div");
    wrapper.className = "control-row";
    const lbl = document.createElement("label");
    lbl.className = "checkbox-label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.otherRollup;
    input.addEventListener("change", () => {
      state.otherRollup = input.checked;
      onChange({ ...state });
    });
    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode("Roll long tail into Other bar"));
    const help = document.createElement("span");
    help.className = "control-help";
    help.textContent =
      "When off, dropped combinations are silently hidden \u2014 use only when you have a separate appendix.";
    wrapper.appendChild(lbl);
    wrapper.appendChild(help);
    host.appendChild(wrapper);
  }

  // Hide empty intersection
  {
    const wrapper = document.createElement("div");
    wrapper.className = "control-row";
    const lbl = document.createElement("label");
    lbl.className = "checkbox-label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.hideEmptyIntersection;
    input.addEventListener("change", () => {
      state.hideEmptyIntersection = input.checked;
      onChange({ ...state });
    });
    lbl.appendChild(input);
    lbl.appendChild(
      document.createTextNode("Hide \u201cno sets\u201d intersection"),
    );
    const help = document.createElement("span");
    help.className = "control-help";
    help.textContent = "Stores with no enabled sets in this dimension.";
    wrapper.appendChild(lbl);
    wrapper.appendChild(help);
    host.appendChild(wrapper);
  }

  // Sort dropdown
  {
    const wrapper = document.createElement("div");
    wrapper.className = "control-row";
    const lbl = document.createElement("label");
    lbl.textContent = "Sort intersections by";

    const select = document.createElement("select");
    for (const [value, label] of Object.entries(SORT_LABELS) as [
      SortMode,
      string,
    ][]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (value === state.sortMode) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      state.sortMode = select.value as SortMode;
      onChange({ ...state });
    });
    lbl.appendChild(select);
    wrapper.appendChild(lbl);
    host.appendChild(wrapper);
  }

  return {
    getOptions: () => ({ ...state }),
    setOptions: (next) => {
      Object.assign(state, next);
      // Re-render this control panel by remounting with current state.
      mountControls(host, state, onChange);
    },
  };
}
