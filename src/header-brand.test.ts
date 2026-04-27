import { describe, expect, it } from "vitest";
import { formatDimensionLabel } from "./header-brand";

describe("formatDimensionLabel", () => {
  it("maps YAML parameters dimension to features for display", () => {
    expect(formatDimensionLabel("parameters")).toBe("features");
  });

  it("keeps features and replaces underscores elsewhere", () => {
    expect(formatDimensionLabel("features")).toBe("features");
    expect(formatDimensionLabel("menu_sets")).toBe("menu sets");
    expect(formatDimensionLabel("dual")).toBe("dual");
  });
});
