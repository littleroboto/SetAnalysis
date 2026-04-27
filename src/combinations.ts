import type {
  Combination,
  CombinationSummary,
  Element,
  SetSummary,
} from "./types";

/**
 * Group elements into UpSet combinations.
 *
 * Algorithm (deliberately small &mdash; do NOT crib from `@upsetjs/model`):
 *
 *   1. Per-element: sort `sets` to canonicalise membership, build a key.
 *   2. Bucket elements by key.
 *   3. Emit one `Combination` per bucket (ordered first by descending size
 *      then by lexicographic key for stable output).
 *   4. Walk every set name to fill `SetSummary` (size + element ids).
 *
 * The function is intentionally pure: same input -> same output. Trim/sort
 * decisions live in the renderer, not here.
 */
export function extractCombinations(elements: Element[]): CombinationSummary {
  const setBuckets = new Map<string, string[]>();
  const comboBuckets = new Map<string, { sets: string[]; ids: string[] }>();

  for (const el of elements) {
    const sortedSets = dedupeAndSort(el.sets);
    const key = sortedSets.join("\u0000");
    let combo = comboBuckets.get(key);
    if (!combo) {
      combo = { sets: sortedSets, ids: [] };
      comboBuckets.set(key, combo);
    }
    combo.ids.push(el.id);

    for (const setName of sortedSets) {
      let bucket = setBuckets.get(setName);
      if (!bucket) {
        bucket = [];
        setBuckets.set(setName, bucket);
      }
      bucket.push(el.id);
    }
  }

  const sets: SetSummary[] = [...setBuckets.entries()]
    .map(([name, ids]) => ({
      name,
      size: ids.length,
      elementIds: ids,
    }))
    .sort((a, b) => b.size - a.size || compareString(a.name, b.name));

  const combinations: Combination[] = [...comboBuckets.values()]
    .map<Combination>((b) => ({
      sets: b.sets,
      size: b.ids.length,
      elementIds: b.ids,
    }))
    .sort(
      (a, b) =>
        b.size - a.size ||
        a.sets.length - b.sets.length ||
        compareString(a.sets.join("|"), b.sets.join("|")),
    );

  return { sets, combinations };
}

function dedupeAndSort(sets: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const s of sets) {
    const name = s.trim();
    if (name === "") continue;
    seen.add(name);
  }
  return [...seen].sort(compareString);
}

function compareString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
