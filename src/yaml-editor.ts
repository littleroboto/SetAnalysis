// CodeMirror 6 wrapper for the workbench YAML pane.
//
// Exposes a tiny imperative API (mountYamlEditor) so the rest of main.ts can
// keep treating the input as "give me text / set me text", with parse errors
// reflected as inline lint markers instead of a detached banner-only message.

import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { searchKeymap, search, highlightSelectionMatches } from "@codemirror/search";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";

export interface YamlEditorMountOptions {
  /** Initial document body. */
  initial: string;
  /** Called on every effective change (debounced upstream by main.ts). */
  onChange(text: string): void;
}

export interface YamlEditorHandle {
  view: EditorView;
  /** Replace the document with `text` without firing onChange. */
  setValue(text: string): void;
  /** Get the current document text. */
  getValue(): string;
  /** Replace lint diagnostics with `next` (set [] to clear). */
  setDiagnostics(next: Diagnostic[]): void;
  /** Move keyboard focus into the editor. */
  focus(): void;
}

/**
 * Light theme tuned to match the workbench's neutral palette:
 * white panel, subtle gutter, no chrome that competes with the diagram.
 */
const workbenchTheme = EditorView.theme(
  {
    "&": {
      fontSize: "12px",
      backgroundColor: "#ffffff",
      color: "#171717",
      borderRadius: "6px",
      border: "1px solid #e5e5e5",
    },
    "&.cm-focused": {
      outline: "none",
      borderColor: "#9ca3af",
      boxShadow: "0 0 0 3px rgb(23 23 23 / 0.06)",
    },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: "1.45",
    },
    ".cm-content": {
      padding: "8px 4px",
      caretColor: "#171717",
    },
    ".cm-gutters": {
      backgroundColor: "#fafafa",
      color: "#a3a3a3",
      borderRight: "1px solid #ececec",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#f3f4f6",
      color: "#525252",
    },
    ".cm-activeLine": {
      backgroundColor: "rgb(23 23 23 / 0.025)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgb(23 23 23 / 0.08)",
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "rgb(37 99 235 / 0.18)",
    },
    ".cm-cursor": {
      borderLeftColor: "#171717",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 6px 0 8px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "#f3f4f6",
      color: "#525252",
      border: "1px solid #e5e5e5",
      padding: "0 4px",
      borderRadius: "3px",
    },
    ".cm-tooltip": {
      border: "1px solid #e5e5e5",
      backgroundColor: "#ffffff",
      borderRadius: "4px",
      boxShadow: "0 4px 14px rgb(0 0 0 / 0.06)",
    },
    ".cm-tooltip .cm-diagnostic": {
      padding: "6px 10px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
    },
    ".cm-diagnostic-error": {
      borderLeftColor: "#b53030",
    },
    ".cm-diagnostic-warning": {
      borderLeftColor: "#b08800",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      backgroundColor: "rgb(181 48 48 / 0.12)",
      borderBottom: "2px wavy #b53030",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      backgroundColor: "rgb(176 136 0 / 0.12)",
      borderBottom: "2px wavy #b08800",
    },
  },
  { dark: false },
);

/**
 * Create a single editor extension list. Kept as a function so we can wire
 * the onChange listener into the closure cleanly.
 */
function buildExtensions(opts: {
  onChange(text: string): void;
}): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    history(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    yaml(),
    lintGutter(),
    search({ top: true }),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
    workbenchTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        opts.onChange(u.state.doc.toString());
      }
    }),
  ];
}

/** Compartment so we can replace diagnostics without rebuilding the editor. */
const diagnosticsCompartment = new Compartment();

export function mountYamlEditor(
  host: HTMLElement,
  opts: YamlEditorMountOptions,
): YamlEditorHandle {
  // Allow a single mount point — clear anything left from prior mounts (HMR safe).
  host.replaceChildren();

  const state = EditorState.create({
    doc: opts.initial,
    extensions: [
      ...buildExtensions({ onChange: opts.onChange }),
      diagnosticsCompartment.of([]),
    ],
  });
  const view = new EditorView({ state, parent: host });

  const handle: YamlEditorHandle = {
    view,
    setValue(text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        // Don't move scroll on programmatic loads (sample switch / file load).
        scrollIntoView: false,
        annotations: [],
      });
    },
    getValue() {
      return view.state.doc.toString();
    },
    setDiagnostics(next) {
      view.dispatch(setDiagnostics(view.state, next));
    },
    focus() {
      view.focus();
    },
  };

  return handle;
}

/**
 * Convert a 0-indexed (line, column) ParseError position into a CM6 character
 * offset. Falls back to first line if the position can't be located.
 */
export function lineColumnToOffset(
  state: EditorState,
  line: number,
  column: number,
): number {
  const lineNo = Math.max(1, Math.min(state.doc.lines, line + 1));
  const lineInfo = state.doc.line(lineNo);
  const offset = lineInfo.from + Math.max(0, Math.min(lineInfo.length, column));
  return offset;
}

export type { Diagnostic };
