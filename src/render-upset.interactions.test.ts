import { describe, expect, it } from "vitest";
import { renderUpset } from "./render-upset";
import { DEFAULT_RENDER_OPTIONS, type CombinationSummary, type InputMeta } from "./types";

describe("renderUpset interactions", () => {
  it("emits selection payload when a combo bar is clicked", () => {
    const host = document.createElement("div");
    const meta: InputMeta = {
      market: "UK",
      snapshot: "2026-04-26",
      dimension: "menu_sets",
      source: "test",
      evidence: "inferred",
    };
    const summary: CombinationSummary = {
      sets: [{ name: "Breakfast", size: 2, elementIds: ["UK001", "UK002"] }],
      combinations: [
        { sets: ["Breakfast"], size: 2, elementIds: ["UK001", "UK002"] },
      ],
    };

    const seen: unknown[] = [];
    renderUpset(
      host,
      meta,
      2,
      summary,
      { ...DEFAULT_RENDER_OPTIONS },
      (selection) => {
        seen.push(selection);
      },
    );

    const comboBar = host.querySelector(".combo-bar") as SVGRectElement | null;
    expect(comboBar).toBeTruthy();
    comboBar?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      type: "combination",
      stores: ["UK001", "UK002"],
      count: 2,
      sets: ["Breakfast"],
      dimension: "menu_sets",
      market: "UK",
    });
  });
});
