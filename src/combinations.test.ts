import { describe, expect, it } from "vitest";
import { extractCombinations } from "./combinations";
import type { Element } from "./types";

const e = (id: string, sets: string[]): Element => ({ id, sets });

describe("extractCombinations", () => {
  it("returns empty summary for empty input", () => {
    const out = extractCombinations([]);
    expect(out.sets).toEqual([]);
    expect(out.combinations).toEqual([]);
  });

  it("groups identical membership tuples into one combination", () => {
    const out = extractCombinations([
      e("1", ["A", "B"]),
      e("2", ["B", "A"]),
      e("3", ["A", "B"]),
    ]);
    expect(out.combinations).toHaveLength(1);
    expect(out.combinations[0]).toMatchObject({
      sets: ["A", "B"],
      size: 3,
      elementIds: ["1", "2", "3"],
    });
  });

  it("counts set sizes correctly even when membership tuples overlap", () => {
    const out = extractCombinations([
      e("1", ["A", "B"]),
      e("2", ["A"]),
      e("3", ["B"]),
      e("4", ["A", "B", "C"]),
    ]);
    const setMap = new Map(out.sets.map((s) => [s.name, s.size]));
    expect(setMap.get("A")).toBe(3);
    expect(setMap.get("B")).toBe(3);
    expect(setMap.get("C")).toBe(1);
  });

  it("treats element with no sets as the empty-intersection bucket", () => {
    const out = extractCombinations([e("1", []), e("2", [])]);
    expect(out.combinations).toHaveLength(1);
    expect(out.combinations[0].sets).toEqual([]);
    expect(out.combinations[0].size).toBe(2);
  });

  it("produces stable ordering: size desc, then degree asc, then name asc", () => {
    const out = extractCombinations([
      e("1", ["A"]),
      e("2", ["B"]),
      e("3", ["A", "B"]),
      e("4", ["A", "B"]),
    ]);
    expect(out.combinations.map((c) => c.sets.join("|"))).toEqual([
      "A|B",
      "A",
      "B",
    ]);
  });

  it("normalises whitespace and dedupes names per element", () => {
    const out = extractCombinations([e("1", [" A ", "A", "B"])]);
    expect(out.combinations).toHaveLength(1);
    expect(out.combinations[0].sets).toEqual(["A", "B"]);
  });

  it("captures element ids per set in input order", () => {
    const out = extractCombinations([
      e("alpha", ["X"]),
      e("beta", ["X"]),
      e("gamma", ["Y"]),
    ]);
    const x = out.sets.find((s) => s.name === "X");
    expect(x?.elementIds).toEqual(["alpha", "beta"]);
  });
});
