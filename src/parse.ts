import yaml from "js-yaml";
import type {
  DimensionKind,
  Element,
  EvidenceGrade,
  InputMeta,
  ParseResult,
  ParsedInput,
} from "./types";

const EVIDENCE_GRADES: ReadonlySet<EvidenceGrade> = new Set([
  "output_only",
  "input_config",
  "inferred",
  "SME_confirmed",
]);

const DIMENSION_KINDS: ReadonlySet<DimensionKind> = new Set([
  "menu_sets",
  "features",
  "parameters",
  "dual",
]);

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

interface RawDoc {
  meta?: unknown;
  elements?: unknown;
}

/**
 * Parse a YAML document and validate it against the workbench schema.
 *
 * Single view: `meta.dimension` is `menu_sets` | `features` | `parameters` and
 * each element has `sets`.
 *
 * Dual view: `meta.dimension` is `dual`; each element has `menu_sets` and
 * `parameters` (arrays; may be empty). Renders two UpSet panels stacked vertically.
 */
export function parseInput(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = yaml.load(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ParseError(`YAML parse error: ${detail}`);
  }

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(
      "Top-level YAML must be a mapping with `meta:` and `elements:` keys.",
    );
  }
  const doc = raw as RawDoc;

  const meta = parseMeta(doc.meta);

  if (meta.dimension === "dual") {
    const dualElements = parseDualElements(doc.elements);
    const menuSets: ParsedInput = {
      meta: {
        ...meta,
        dimension: "menu_sets",
        notes: appendDualNote(meta.notes, "menu_sets"),
      },
      elements: dualElements.map((e) => ({
        id: e.id,
        sets: e.menu_sets,
        attrs: e.attrs,
      })),
    };
    const parameters: ParsedInput = {
      meta: {
        ...meta,
        dimension: "parameters",
        notes: appendDualNote(meta.notes, "parameters"),
      },
      elements: dualElements.map((e) => ({
        id: e.id,
        sets: e.parameters,
        attrs: e.attrs,
      })),
    };
    return { kind: "dual", menuSets, parameters };
  }

  const elements = parseSingleElements(doc.elements);
  return { kind: "single", parsed: { meta, elements } };
}

function appendDualNote(notes: string | undefined, view: string): string | undefined {
  const tag = `Dual-input YAML; this panel is ${view}.`;
  if (notes == null || notes.trim() === "") return tag;
  return `${notes} ${tag}`;
}

function parseMeta(raw: unknown): InputMeta {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError("`meta` is required and must be a mapping.");
  }
  const m = raw as Record<string, unknown>;

  const market = requireString(m, "meta.market");
  const snapshot = requireString(m, "meta.snapshot");
  const dimension = requireString(m, "meta.dimension");
  const source = requireString(m, "meta.source");
  const evidence = requireString(m, "meta.evidence");
  const notes = m.notes == null ? undefined : String(m.notes);

  if (!DIMENSION_KINDS.has(dimension as DimensionKind)) {
    throw new ParseError(
      `meta.dimension must be one of: ${[...DIMENSION_KINDS].join(", ")} (got ${JSON.stringify(dimension)}).`,
    );
  }
  if (!EVIDENCE_GRADES.has(evidence as EvidenceGrade)) {
    throw new ParseError(
      `meta.evidence must be one of: ${[...EVIDENCE_GRADES].join(", ")} (got ${JSON.stringify(evidence)}).`,
    );
  }

  return {
    market,
    snapshot,
    dimension: dimension as DimensionKind,
    source,
    evidence: evidence as EvidenceGrade,
    notes,
  };
}

interface DualElementRow {
  id: string;
  menu_sets: string[];
  parameters: string[];
  attrs?: Record<string, number | string>;
}

function parseDualElements(raw: unknown): DualElementRow[] {
  if (!Array.isArray(raw)) {
    throw new ParseError("`elements` is required and must be a non-empty list.");
  }
  if (raw.length === 0) {
    throw new ParseError("`elements` is empty &mdash; nothing to plot.");
  }

  const seen = new Set<string>();
  const out: DualElementRow[] = [];

  raw.forEach((entry, idx) => {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ParseError(
        `elements[${idx}] must be a mapping with \`id\`, \`menu_sets\`, and \`parameters\`.`,
      );
    }
    const e = entry as Record<string, unknown>;

    if ("sets" in e) {
      throw new ParseError(
        `elements[${idx}]: with meta.dimension: dual, use \`menu_sets\` and \`parameters\` instead of \`sets\`.`,
      );
    }

    const idValue = e.id;
    if (idValue == null || (typeof idValue !== "string" && typeof idValue !== "number")) {
      throw new ParseError(`elements[${idx}].id is required (string or number).`);
    }
    const id = String(idValue);
    if (seen.has(id)) {
      throw new ParseError(`elements[${idx}].id is duplicated: ${JSON.stringify(id)}`);
    }
    seen.add(id);

    if (!Array.isArray(e.menu_sets)) {
      throw new ParseError(`elements[${idx}].menu_sets must be an array (may be empty).`);
    }
    if (!Array.isArray(e.parameters)) {
      throw new ParseError(`elements[${idx}].parameters must be an array (may be empty).`);
    }

    const menu_sets = normaliseStringList(e.menu_sets);
    const parameters = normaliseStringList(e.parameters);

    let attrs: Record<string, number | string> | undefined;
    if (e.attrs != null) {
      if (typeof e.attrs !== "object" || Array.isArray(e.attrs)) {
        throw new ParseError(
          `elements[${idx}].attrs must be a mapping if present.`,
        );
      }
      attrs = {};
      for (const [k, v] of Object.entries(e.attrs as Record<string, unknown>)) {
        if (typeof v === "number" || typeof v === "string") {
          attrs[k] = v;
        } else {
          attrs[k] = String(v);
        }
      }
    }

    out.push({ id, menu_sets, parameters, attrs });
  });

  return out;
}

function parseSingleElements(raw: unknown): Element[] {
  if (!Array.isArray(raw)) {
    throw new ParseError("`elements` is required and must be a non-empty list.");
  }
  if (raw.length === 0) {
    throw new ParseError("`elements` is empty &mdash; nothing to plot.");
  }

  const seen = new Set<string>();
  const out: Element[] = [];

  raw.forEach((entry, idx) => {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ParseError(
        `elements[${idx}] must be a mapping with \`id\` and \`sets\`.`,
      );
    }
    const e = entry as Record<string, unknown>;

    if ("menu_sets" in e || "parameters" in e) {
      throw new ParseError(
        `elements[${idx}]: found \`menu_sets\` or \`parameters\` — set meta.dimension: dual for two-panel mode, or use only \`sets\` for a single panel.`,
      );
    }

    const idValue = e.id;
    if (idValue == null || (typeof idValue !== "string" && typeof idValue !== "number")) {
      throw new ParseError(`elements[${idx}].id is required (string or number).`);
    }
    const id = String(idValue);
    if (seen.has(id)) {
      throw new ParseError(`elements[${idx}].id is duplicated: ${JSON.stringify(id)}`);
    }
    seen.add(id);

    if (!Array.isArray(e.sets)) {
      throw new ParseError(
        `elements[${idx}].sets must be an array (may be empty).`,
      );
    }
    const sets = normaliseStringList(e.sets);

    let attrs: Record<string, number | string> | undefined;
    if (e.attrs != null) {
      if (typeof e.attrs !== "object" || Array.isArray(e.attrs)) {
        throw new ParseError(
          `elements[${idx}].attrs must be a mapping if present.`,
        );
      }
      attrs = {};
      for (const [k, v] of Object.entries(e.attrs as Record<string, unknown>)) {
        if (typeof v === "number" || typeof v === "string") {
          attrs[k] = v;
        } else {
          attrs[k] = String(v);
        }
      }
    }

    out.push({ id, sets, attrs });
  });

  return out;
}

function normaliseStringList(raw: readonly unknown[]): string[] {
  const sets: string[] = [];
  const dedupe = new Set<string>();
  for (const s of raw) {
    if (s == null) continue;
    const name = String(s).trim();
    if (name === "") continue;
    if (dedupe.has(name)) continue;
    dedupe.add(name);
    sets.push(name);
  }
  return sets;
}

function requireString(
  m: Record<string, unknown>,
  path: string,
): string {
  const raw = m[path.split(".").pop() as string];
  if (raw == null) {
    throw new ParseError(`${path} is required.`);
  }
  const s = String(raw).trim();
  if (s === "") {
    throw new ParseError(`${path} must not be blank.`);
  }
  return s;
}
