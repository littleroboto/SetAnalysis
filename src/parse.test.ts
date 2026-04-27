import { describe, expect, it } from "vitest";
import { parseInput, ParseError } from "./parse";

const validMeta = `meta:
  market: UK
  snapshot: "2026-04-23"
  dimension: menu_sets
  source: data/estate/uk_pass_b_synthetic.tsv
  evidence: input_config
  notes: synthetic
`;

function parseSingle(text: string) {
  const out = parseInput(text);
  if (out.kind !== "single") {
    throw new Error("expected single parse");
  }
  return out.parsed;
}

describe("parseInput", () => {
  it("parses a minimal valid document", () => {
    const text = `${validMeta}
elements:
  - id: "1"
    sets: ["A", "B"]
  - id: "2"
    sets: ["A"]
`;
    const out = parseSingle(text);
    expect(out.meta.market).toBe("UK");
    expect(out.meta.dimension).toBe("menu_sets");
    expect(out.meta.evidence).toBe("input_config");
    expect(out.elements).toHaveLength(2);
    expect(out.elements[0]).toMatchObject({ id: "1", sets: ["A", "B"] });
  });

  it("coerces numeric ids to strings", () => {
    const text = `${validMeta}
elements:
  - id: 8260654
    sets: []
`;
    const out = parseSingle(text);
    expect(out.elements[0].id).toBe("8260654");
  });

  it("rejects missing meta.evidence (workbench discipline)", () => {
    const text = `meta:
  market: UK
  snapshot: "2026-04-23"
  dimension: menu_sets
  source: x
elements:
  - id: "1"
    sets: []
`;
    expect(() => parseInput(text)).toThrow(ParseError);
  });

  it("rejects unknown evidence grades", () => {
    const text = `meta:
  market: UK
  snapshot: "2026-04-23"
  dimension: menu_sets
  source: x
  evidence: hand_wave
elements:
  - id: "1"
    sets: []
`;
    expect(() => parseInput(text)).toThrow(/evidence must be one of/);
  });

  it("accepts dimension parameters", () => {
    const text = `meta:
  market: PL
  snapshot: "2026-04-23"
  dimension: parameters
  source: viz/upset-tool/src/samples/synthetic-pl-parameters-passb.yaml
  evidence: input_config
elements:
  - id: "1"
    sets: ["SYS_PL_POS_Core", "SYS_PL_Kitchen_STD"]
`;
    const out = parseSingle(text);
    expect(out.meta.dimension).toBe("parameters");
  });

  it("parses dual YAML into menu_sets and parameters views", () => {
    const text = `meta:
  market: UK
  snapshot: "2026-04-24"
  dimension: dual
  source: viz/upset-tool/src/samples/synthetic-uk-dual-passb.yaml
  evidence: input_config
elements:
  - id: "1"
    menu_sets: ["Core_Menu", "Breakfast"]
    parameters: ["SYS_POS_UK_Base"]
  - id: "2"
    menu_sets: ["Core_Menu"]
    parameters: ["SYS_POS_UK_Base", "SYS_Kitchen_Display_STD"]
`;
    const out = parseInput(text);
    expect(out.kind).toBe("dual");
    if (out.kind !== "dual") throw new Error("expected dual");
    expect(out.menuSets.meta.dimension).toBe("menu_sets");
    expect(out.parameters.meta.dimension).toBe("parameters");
    expect(out.menuSets.elements[0].sets).toEqual(["Core_Menu", "Breakfast"]);
    expect(out.parameters.elements[0].sets).toEqual(["SYS_POS_UK_Base"]);
    expect(out.menuSets.elements[1].id).toBe("2");
  });

  it("rejects dual elements that still use sets", () => {
    const text = `meta:
  market: UK
  snapshot: "2026-04-24"
  dimension: dual
  source: x
  evidence: input_config
elements:
  - id: "1"
    sets: ["A"]
    menu_sets: ["Core_Menu"]
    parameters: []
`;
    expect(() => parseInput(text)).toThrow(/menu_sets.*parameters.*instead of.*sets/);
  });

  it("rejects single dimension when elements use menu_sets", () => {
    const text = `${validMeta}
elements:
  - id: "1"
    menu_sets: ["Core_Menu"]
    parameters: []
`;
    expect(() => parseInput(text)).toThrow(/meta.dimension: dual/);
  });

  it("rejects unknown dimension kinds", () => {
    const text = `meta:
  market: UK
  snapshot: "2026-04-23"
  dimension: vibes
  source: x
  evidence: input_config
elements:
  - id: "1"
    sets: []
`;
    expect(() => parseInput(text)).toThrow(/dimension must be one of/);
  });

  it("rejects empty elements list", () => {
    const text = `${validMeta}
elements: []
`;
    expect(() => parseInput(text)).toThrow(/empty/);
  });

  it("rejects duplicate element ids", () => {
    const text = `${validMeta}
elements:
  - id: "1"
    sets: ["A"]
  - id: "1"
    sets: ["B"]
`;
    expect(() => parseInput(text)).toThrow(/duplicated/);
  });

  it("normalises whitespace and dedupes set names within an element", () => {
    const text = `${validMeta}
elements:
  - id: "1"
    sets: [" A ", "A", "", "B"]
`;
    const out = parseSingle(text);
    expect(out.elements[0].sets).toEqual(["A", "B"]);
  });

  it("preserves attrs as numbers or strings", () => {
    const text = `${validMeta}
elements:
  - id: "1"
    sets: ["A"]
    attrs:
      feature_count: 142
      cohort: pilot
`;
    const out = parseSingle(text);
    expect(out.elements[0].attrs).toEqual({
      feature_count: 142,
      cohort: "pilot",
    });
  });

  it("surfaces YAML syntax errors with a useful message", () => {
    expect(() => parseInput(":\n  not: [valid")).toThrow(/YAML parse error/);
  });
});
