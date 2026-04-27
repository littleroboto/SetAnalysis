// Synthetic UK "Pass B" generator for the RFM UpSet workbench.
//
// Produces ../synthetic-uk-passb.yaml — 1500 stores, 14 menu-sets, eight named
// archetypes covering ~95% of the estate plus ~5% long-tail variants. Output
// is deterministic for a given SEED so the YAML is reproducible.
//
// Run with:  npm run gen:uk-passb
//
// IMPORTANT: this file is hand-rolled fiction. It is intended to exercise the
// renderer ("does the workbench survive 1.5k stores and a long tail?") and to
// give analysts something concrete to react to ("does Top-N + Other land the
// way I expected?"). It carries NO real estate signal — the real Pass B file
// will replace it once the upstream extraction pipeline lands.

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

// 32-bit seed; bumping this regenerates the file with a different deterministic
// distribution. Bump deliberately — analysts may calibrate intuition on the
// current shape.
const SEED = 0x55_c0_de_42;

const STORE_ID_START = 8_260_000;
const TOTAL_STORES = 1500;
const LONGTAIL_TARGET = 75; // 5% of 1500
const VARIANT_COUNT = 40;   // distinct long-tail membership tuples

const SETS = [
  "Core_Menu",
  "Breakfast",
  "McCafé",
  "DriveThru_Add-ons",
  "LateNight_Menu",
  "Mall_LimitedMenu",
  "Loyalty_Promo_2026Q1",
  "LabTest_Iced",
  // Additional UK-flavoured surfaces (fiction — exercises higher k in the workbench).
  "Delivery_Platforms",
  "Kiosk_FullMenu",
  "Table_Service_Zone",
  "Plant_Based_Expanded",
  "Regional_Specials_UK",
  "GameDay_Promo_Bundle",
] as const;

interface Archetype {
  readonly name: string;
  readonly count: number;
  readonly sets: readonly string[];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: "Freestanding standard",
    count: 420,
    sets: ["Core_Menu", "Breakfast", "McCafé", "DriveThru_Add-ons", "LateNight_Menu"],
  },
  {
    name: "Mall standard",
    count: 350,
    sets: [
      "Core_Menu",
      "Breakfast",
      "McCafé",
      "Mall_LimitedMenu",
      "Table_Service_Zone",
    ],
  },
  {
    name: "DT-express",
    count: 280,
    sets: ["Core_Menu", "Breakfast", "DriveThru_Add-ons", "LateNight_Menu"],
  },
  {
    name: "Loyalty pilot",
    count: 120,
    sets: [
      "Core_Menu",
      "Breakfast",
      "McCafé",
      "DriveThru_Add-ons",
      "LateNight_Menu",
      "Loyalty_Promo_2026Q1",
    ],
  },
  {
    name: "Lab cohort",
    count: 75,
    sets: ["Core_Menu", "Breakfast", "McCafé", "LabTest_Iced"],
  },
  {
    name: "Delivery & digital",
    count: 100,
    sets: [
      "Core_Menu",
      "Breakfast",
      "McCafé",
      "DriveThru_Add-ons",
      "LateNight_Menu",
      "Delivery_Platforms",
      "Kiosk_FullMenu",
    ],
  },
  {
    name: "Plant-forward trial",
    count: 50,
    sets: ["Core_Menu", "Breakfast", "McCafé", "Plant_Based_Expanded"],
  },
  {
    name: "Regional & gameday overlay",
    count: 30,
    sets: [
      "Core_Menu",
      "Breakfast",
      "McCafé",
      "Regional_Specials_UK",
      "GameDay_Promo_Bundle",
    ],
  },
];

// Mulberry32 — small, fast, deterministic 32-bit PRNG. Good enough for sample
// data; do not use for anything cryptographic.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
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

  // Core 95% — 1425 stores spread across the named archetypes.
  for (const arch of ARCHETYPES) {
    for (let i = 0; i < arch.count; i++) {
      elements.push({
        id: String(nextId++),
        sets: [...arch.sets],
        attrs: { archetype: arch.name },
      });
    }
  }

  // Long tail 5% — 75 stores split across ~40 distinct membership tuples,
  // each derived from one archetype with 1 or 2 set add/remove operations
  // (pool includes all 14 menu-sets).
  const archetypeKeys = new Set(ARCHETYPES.map((a) => canonicalKey(a.sets)));
  const variants: { sets: string[]; derivedFrom: string }[] = [];
  let safetyGuard = 0;

  while (variants.length < VARIANT_COUNT) {
    safetyGuard++;
    if (safetyGuard > 5000) {
      throw new Error("uk_passb generator: could not find enough unique variants");
    }
    const arch = pick(rand, ARCHETYPES);
    const sets = new Set(arch.sets);
    // 60% one-off, 40% two-off.
    const operations = rand() < 0.6 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      const addOrRemove = rand();
      if (addOrRemove < 0.5 && sets.size > 1) {
        // Remove a random set.
        const arr = [...sets];
        sets.delete(pick(rand, arr));
      } else {
        // Add a random set not currently present.
        const missing = SETS.filter((s) => !sets.has(s));
        if (missing.length > 0) {
          sets.add(pick(rand, missing));
        }
      }
    }
    if (sets.size === 0) continue;
    const sorted = [...sets].sort();
    const key = canonicalKey(sorted);
    if (archetypeKeys.has(key)) continue; // skip — collapses into a known archetype
    if (variants.some((v) => canonicalKey(v.sets) === key)) continue;
    variants.push({ sets: sorted, derivedFrom: arch.name });
  }

  // Distribute LONGTAIL_TARGET stores across the variants. Floor every variant
  // at 1 store, then deal the remaining slots with a soft per-variant cap so
  // the tail stays "long" rather than collapsing onto a few duplicates.
  const counts = new Array<number>(VARIANT_COUNT).fill(1);
  let remaining = LONGTAIL_TARGET - VARIANT_COUNT;
  const PER_VARIANT_CAP = 4;
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
      `uk_passb generator: expected ${TOTAL_STORES} elements, got ${elements.length}`,
    );
  }
  return elements;
}

function main(): void {
  const rand = mulberry32(SEED);
  const elements = buildElements(rand);

  const meta = {
    market: "UK",
    snapshot: "2026-04-23",
    dimension: "menu_sets" as const,
    source: "viz/upset-tool/src/samples/synthetic-uk-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic Pass B for the workbench. ${TOTAL_STORES} stores, ` +
      `${SETS.length} menu-sets, 8 named archetypes (~95%) + ` +
      `${VARIANT_COUNT} long-tail variants (~5%). ` +
      `Deterministic Mulberry32, seed 0x${SEED.toString(16)}. ` +
      "Regenerate with `npm run gen:uk-passb`. Carries no real estate signal.",
  };

  const body = yaml.dump(
    { meta, elements },
    { sortKeys: false, lineWidth: 200, noRefs: true },
  );

  const banner =
    `# Generated by viz/upset-tool/src/samples/_generators/uk_passb.ts\n` +
    `# Seed: 0x${SEED.toString(16)}. Stores: ${TOTAL_STORES}. Sets: ${SETS.length}.\n` +
    `# Regenerate with \`npm run gen:uk-passb\`. Do not edit by hand.\n`;

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-uk-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(`wrote ${elements.length} elements to ${outPath}`);
}

main();
