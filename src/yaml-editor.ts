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
  HighlightStyle,
} from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";

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
 * Dark theme tuned to sit cleanly inside the otherwise-light workbench:
 * cool slate panel, low-contrast gutter, syntax tones picked from the
 * "one dark" family so YAML keys / values / comments are easy to scan.
 */
const PALETTE = {
  bg: "#1e2128",
  bgGutter: "#191c22",
  bgActive: "#262a32",
  bgSelection: "#3b4252",
  bgSelectionMatch: "rgb(255 255 255 / 0.06)",
  border: "#30343c",
  borderFocus: "#4b5263",
  text: "#dbe0e8",
  textMuted: "#7a8290",
  caret: "#d7dae0",
  // Syntax accents (one-dark inspired, slightly desaturated for neutrality).
  comment: "#6c7383",
  key: "#7aa2f7",
  string: "#9ece6a",
  number: "#e0af68",
  bool: "#bb9af7",
  punct: "#9aa1ad",
  meta: "#73daca",
  invalid: "#f7768e",
};

const workbenchHighlight = HighlightStyle.define([
  { tag: t.comment, color: PALETTE.comment, fontStyle: "italic" },
  { tag: t.lineComment, color: PALETTE.comment, fontStyle: "italic" },
  { tag: t.blockComment, color: PALETTE.comment, fontStyle: "italic" },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: PALETTE.key, fontWeight: "500" },
  { tag: t.string, color: PALETTE.string },
  { tag: t.number, color: PALETTE.number },
  { tag: t.bool, color: PALETTE.bool },
  { tag: t.null, color: PALETTE.bool },
  { tag: t.keyword, color: PALETTE.bool },
  { tag: t.atom, color: PALETTE.bool },
  { tag: t.meta, color: PALETTE.meta },
  { tag: t.punctuation, color: PALETTE.punct },
  { tag: t.bracket, color: PALETTE.punct },
  { tag: t.invalid, color: PALETTE.invalid },
]);

const workbenchTheme = EditorView.theme(
  {
    "&": {
      fontSize: "12px",
      backgroundColor: PALETTE.bg,
      color: PALETTE.text,
      borderRadius: "6px",
      border: `1px solid ${PALETTE.border}`,
    },
    "&.cm-focused": {
      outline: "none",
      borderColor: PALETTE.borderFocus,
      boxShadow: "0 0 0 3px rgb(122 162 247 / 0.18)",
    },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      lineHeight: "1.45",
    },
    ".cm-content": {
      padding: "8px 4px",
      caretColor: PALETTE.caret,
    },
    ".cm-gutters": {
      backgroundColor: PALETTE.bgGutter,
      color: PALETTE.textMuted,
      border: "none",
      borderRight: `1px solid ${PALETTE.border}`,
    },
    ".cm-activeLineGutter": {
      backgroundColor: PALETTE.bgActive,
      color: PALETTE.text,
    },
    ".cm-activeLine": {
      backgroundColor: "rgb(255 255 255 / 0.02)",
    },
    ".cm-selectionMatch": {
      backgroundColor: PALETTE.bgSelectionMatch,
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: PALETTE.bgSelection,
      },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: PALETTE.caret,
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 10px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: PALETTE.bgActive,
      color: PALETTE.text,
      border: `1px solid ${PALETTE.border}`,
      padding: "0 4px",
      borderRadius: "3px",
    },
    ".cm-tooltip": {
      border: `1px solid ${PALETTE.border}`,
      backgroundColor: PALETTE.bgActive,
      color: PALETTE.text,
      borderRadius: "4px",
      boxShadow: "0 4px 14px rgb(0 0 0 / 0.4)",
    },
    ".cm-tooltip .cm-diagnostic": {
      padding: "6px 10px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
      color: PALETTE.text,
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: PALETTE.bgSelection,
      color: PALETTE.text,
    },
    ".cm-diagnostic-error": {
      borderLeftColor: "#f87171",
    },
    ".cm-diagnostic-warning": {
      borderLeftColor: "#fbbf24",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      backgroundColor: "rgb(248 113 113 / 0.12)",
      borderBottom: "2px wavy #f87171",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      backgroundColor: "rgb(251 191 36 / 0.12)",
      borderBottom: "2px wavy #fbbf24",
    },
    ".cm-panels": {
      backgroundColor: PALETTE.bgGutter,
      color: PALETTE.text,
      borderTop: `1px solid ${PALETTE.border}`,
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: `1px solid ${PALETTE.border}`,
      borderTop: "none",
    },
    ".cm-panel input, .cm-panel button": {
      backgroundColor: PALETTE.bg,
      color: PALETTE.text,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: "3px",
    },
    ".cm-panel button:hover": {
      backgroundColor: PALETTE.bgActive,
    },
    ".cm-searchMatch": {
      backgroundColor: "rgb(224 175 104 / 0.25)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgb(224 175 104 / 0.45)",
    },
  },
  { dark: true },
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
    syntaxHighlighting(workbenchHighlight, { fallback: true }),
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
