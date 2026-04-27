import { describe, expect, it } from "vitest";
import { anonymiseHeroInput } from "./landing-hero";
import type { ParsedInput } from "./types";

describe("anonymiseHeroInput", () => {
  function buildInput(): ParsedInput {
    return {
      meta: {
        market: "UK",
        snapshot: "2026-04-26",
        dimension: "menu_sets",
        source: "real-source.tsv",
        evidence: "inferred",
      },
      elements: [
        { id: "UK-001", sets: ["Breakfast", "Grill"] },
        { id: "UK-002", sets: ["Breakfast"] },
        { id: "UK-003", sets: ["Grill", "McCafe"] },
        { id: "UK-004", sets: ["Breakfast", "Grill", "McCafe"] },
      ],
    };
  }

  it("renames sets by occurrence (largest first) and renumbers element IDs in appearance order", () => {
    const out = anonymiseHeroInput(buildInput());
    expect(out.meta.market).toBe("Demo");
    expect(out.meta.source).toBe("synthetic");

    // Breakfast appears 3 times, Grill 3, McCafe 2. With ties broken by name
    // ascending, Breakfast (B) < Grill (G), so Breakfast wins #1.
    expect(out.elements.map((e) => e.sets)).toEqual([
      ["MenuSet-1", "MenuSet-2"],
      ["MenuSet-1"],
      ["MenuSet-2", "MenuSet-3"],
      ["MenuSet-1", "MenuSet-2", "MenuSet-3"],
    ]);

    expect(out.elements.map((e) => e.id)).toEqual([
      "Store #1",
      "Store #2",
      "Store #3",
      "Store #4",
    ]);
  });

  it("uses 'Feature' prefix when dimension is features", () => {
    const src = buildInput();
    src.meta.dimension = "features";
    const out = anonymiseHeroInput(src);
    expect(out.elements[0].sets).toEqual(["Feature-1", "Feature-2"]);
  });

  it("preserves attrs unchanged on each element", () => {
    const src = buildInput();
    src.elements[0].attrs = { feature_count: 7 };
    const out = anonymiseHeroInput(src);
    expect(out.elements[0].attrs).toEqual({ feature_count: 7 });
  });
});
