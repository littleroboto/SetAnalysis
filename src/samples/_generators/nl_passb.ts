// Synthetic NL "Pass B" generator for the RFM UpSet workbench.
//
// Menu-set **names** match the tight NL estate catalog in
// `data/estate/nl_menu_sets.tsv` (24 distinct — input_config in repo docs).
// **Per-store bundles** are synthetic fiction shaped as a **mostly uniform**
// estate (heavy overlap on Netherlands + McCafé core), not a high-k PL-style
// stress test. ~270 stores (order-of-magnitude NL n).
//
// Run with:  npm run gen:nl-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0x4e4c_0002;

const STORE_ID_START = 31_000_000;
const TOTAL_STORES = 270;
/** Small tail so Other / long-tail controls still have something to chew on. */
const LONGTAIL_TARGET = 8;
const VARIANT_COUNT = 8;
const PER_VARIANT_CAP = 2;

/**
 * Exact strings from `data/estate/nl_menu_sets.tsv` (line order preserved).
 * Catalog is tight vs PL/DE; estate metrics: 24 distinct menu sets.
 */
const SETS = [
  "Bottle Deposit",
  "Menu Item Set - Condimenten test",
  "Menu Item Set - Customisation test 2",
  "Menu Item Set - Hot Choco",
  "Menu Item Set - Lab testing",
  "Menu Item Set - Lab testing 1215",
  "Menu Item Set - Maestro Egg",
  "Menu Item Set - McBreak + Fris",
  "Menu Item Set - McCafé",
  "Menu Item Set - McDelivery Test",
  "Menu Item Set - Netherlands",
  "Menu Item Set - ODMB",
  "Menu Item Set - PI \\ Platform Integration",
  "Menu Item Set - Pimp Je Burger",
  "Menu Item Set - Re-usable/SurCharge",
  "Menu Item Set - Salad Bar",
  "Menu Item Set - Schiphol",
  "Menu-Item Set - Re-useable/SurCharge LAB",
  "TBD - Menu Item Set - Groningen",
  "TBD - Menu Item Set - Lab",
  "TBD - Menu Item Set - Rotterdam",
  "TDB - Menu Item Set - Non_Innovation",
  "TDB - Menu Item Set - Renske van Mameren",
  "Test Water",
] as const;

interface Archetype {
  readonly name: string;
  readonly count: number;
  readonly sets: readonly string[];
}

/** Three overlapping cohorts — marginal looks "everyone has the core"; bundle still splits a little. */
const ARCHETYPES: readonly Archetype[] = [
  {
    name: "NL_core_standard",
    count: 240,
    sets: [
      "Menu Item Set - Netherlands",
      "Menu Item Set - McCafé",
      "Bottle Deposit",
      "Menu Item Set - McBreak + Fris",
      "Menu Item Set - ODMB",
      "Menu Item Set - Pimp Je Burger",
    ],
  },
  {
    name: "NL_schiphol_cluster",
    count: 14,
    sets: [
      "Menu Item Set - Netherlands",
      "Menu Item Set - McCafé",
      "Bottle Deposit",
      "Menu Item Set - Schiphol",
      "Menu Item Set - McBreak + Fris",
    ],
  },
  {
    name: "NL_cafe_snack_forward",
    count: 8,
    sets: [
      "Menu Item Set - Netherlands",
      "Menu Item Set - McCafé",
      "Menu Item Set - Hot Choco",
      "Menu Item Set - Salad Bar",
      "Bottle Deposit",
    ],
  },
];

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function canonicalKey(sets: readonly string[]): string {
  return [...sets].sort().join("|");
}

interface ElementOut {
  id: string;
  sets: string[];
  attrs?: Record<string, string>;
}

function buildElements(rand: () => number): ElementOut[] {
  const elements: ElementOut[] = [];
  let nextId = STORE_ID_START;

  for (const arch of ARCHETYPES) {
    for (let i = 0; i < arch.count; i++) {
      elements.push({
        id: String(nextId++),
        sets: [...arch.sets],
        attrs: { archetype: arch.name },
      });
    }
  }

  const archetypeKeys = new Set(ARCHETYPES.map((a) => canonicalKey(a.sets)));
  const variants: { sets: string[]; derivedFrom: string }[] = [];
  let safetyGuard = 0;

  while (variants.length < VARIANT_COUNT) {
    safetyGuard++;
    if (safetyGuard > 30_000) {
      throw new Error("nl_passb generator: could not find enough unique variants");
    }
    const arch = pick(rand, ARCHETYPES);
    const sets = new Set(arch.sets);
    const operations = rand() < 0.65 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      const addOrRemove = rand();
      if (addOrRemove < 0.42 && sets.size > 1) {
        const arr = [...sets];
        sets.delete(pick(rand, arr));
      } else {
        const missing = SETS.filter((s) => !sets.has(s));
        if (missing.length > 0) sets.add(pick(rand, missing));
      }
    }
    if (sets.size === 0) continue;
    const sorted = [...sets].sort();
    const key = canonicalKey(sorted);
    if (archetypeKeys.has(key)) continue;
    if (variants.some((v) => canonicalKey(v.sets) === key)) continue;
    variants.push({ sets: sorted, derivedFrom: arch.name });
  }

  const counts = new Array<number>(VARIANT_COUNT).fill(1);
  let remaining = LONGTAIL_TARGET - VARIANT_COUNT;
  while (remaining > 0) {
    const idx = Math.floor(rand() * VARIANT_COUNT);
    if (counts[idx] < PER_VARIANT_CAP) {
      counts[idx]++;
      remaining--;
    }
  }

  variants.forEach((v, i) => {
    for (let k = 0; k < counts[i]; k++) {
      elements.push({
        id: String(nextId++),
        sets: v.sets,
        attrs: {
          archetype: "long_tail",
          derived_from: v.derivedFrom,
        },
      });
    }
  });

  if (elements.length !== TOTAL_STORES) {
    throw new Error(
      `nl_passb generator: expected ${TOTAL_STORES} elements, got ${elements.length}`,
    );
  }
  return elements;
}

function main(): void {
  const rand = mulberry32(SEED);
  const elements = buildElements(rand);

  const meta = {
    market: "NL",
    snapshot: "2026-04-24",
    dimension: "menu_sets" as const,
    source: "viz/upset-tool/src/samples/synthetic-nl-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic NL Pass B. ${TOTAL_STORES} stores (fiction n). Menu-set **names** ` +
      `match the 24-row estate list \`data/estate/nl_menu_sets.tsv\` (tight NL catalog). ` +
      `**Bundles** are synthetic: 3 overlapping archetypes (~97%) + ${LONGTAIL_TARGET}-store tail. ` +
      `Uniform estate shape (not PL-style high-k chaos). Mulberry32 seed 0x${SEED.toString(16)}. ` +
      "`npm run gen:nl-passb`. No real per-store signal.",
  };

  const body = yaml.dump(
    { meta, elements },
    { sortKeys: false, lineWidth: 200, noRefs: true },
  );

  const banner =
    `# Generated by viz/upset-tool/src/samples/_generators/nl_passb.ts\n` +
    `# Seed: 0x${SEED.toString(16)}. Stores: ${TOTAL_STORES}. Catalog: ${SETS.length} names from data/estate/nl_menu_sets.tsv.\n` +
    `# Regenerate with \`npm run gen:nl-passb\`. Do not edit by hand.\n`;

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-nl-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(`wrote ${elements.length} elements to ${outPath}`);
}

main();
