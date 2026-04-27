// Shared types for the UpSet workbench.
//
// The shapes here intentionally mirror the YAML schema documented in
// `public/schema.md`. Renderer + combinations math + parser all agree on these
// names so the surface stays small.

export type EvidenceGrade =
  | "output_only"
  | "input_config"
  | "inferred"
  | "SME_confirmed";

export type DimensionKind = "menu_sets" | "features" | "parameters" | "dual";

export interface InputMeta {
  market: string;
  snapshot: string;
  dimension: DimensionKind;
  source: string;
  evidence: EvidenceGrade;
  notes?: string;
}

export interface Element {
  id: string;
  sets: string[];
  attrs?: Record<string, number | string>;
}

export interface ParsedInput {
  meta: InputMeta;
  elements: Element[];
}

/** Top-level YAML with `meta.dimension: dual` and per-store `menu_sets` + `parameters`. */
export type ParseResult =
  | { kind: "single"; parsed: ParsedInput }
  | { kind: "dual"; menuSets: ParsedInput; parameters: ParsedInput };

export interface SetSummary {
  name: string;
  size: number;
  elementIds: string[];
}

export interface Combination {
  /** Sorted set names that are IN this combination. Empty array = "no sets". */
  sets: string[];
  /** Count of elements with exactly this membership tuple. */
  size: number;
  /** Element ids that belong to this combination. */
  elementIds: string[];
}

export interface CombinationSummary {
  sets: SetSummary[];
  combinations: Combination[];
}

export type SortMode =
  | "size_desc"
  | "degree_asc"
  | "degree_desc"
  | "name_asc";

export interface RenderOptions {
  /**
   * Keep only the N largest sets; the rest fold into the legend residual.
   * Use `0` for no cap (show every distinct set in the file). In practice this
   * is usually the first trim analysts touch when menu-set cardinality is high.
   */
  topNSets: number;
  /** Drop combinations whose `size` is strictly less than this. */
  minCombinationSize: number;
  /**
   * Keep only the N largest combinations after `minCombinationSize`.
   * Use `0` for no cap (every combination row after filters).
   */
  topNCombinations: number;
  /** When true, roll the dropped tail into a single "Other" bar. */
  otherRollup: boolean;
  /** Hide combinations whose membership is the empty set. */
  hideEmptyIntersection: boolean;
  /** Sort order applied after trimming. */
  sortMode: SortMode;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  topNSets: 0,
  minCombinationSize: 1,
  topNCombinations: 0,
  otherRollup: true,
  hideEmptyIntersection: true,
  sortMode: "size_desc",
};
