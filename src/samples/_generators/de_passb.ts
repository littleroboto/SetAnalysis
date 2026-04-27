// Synthetic DE "Pass B" generator for the RFM UpSet workbench.
//
// Produces ../synthetic-de-passb.yaml — 1473 stores, 8 menu-sets, **three**
// dominant archetypes (~75%) plus a deliberately **long** tail (~25%) so the
// chart contrasts with the UK sample (many named archetypes @ ~95%, shorter tail).
//
// Run with:  npm run gen:de-passb
//
// Fiction only — no real estate signal. Replace with upstream extracts when ready.

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0xde_ad_be_ef;

const STORE_ID_START = 27_600_000;
const TOTAL_STORES = 1473;
/** ~25% — much heavier residue than UK (~5%). */
const LONGTAIL_TARGET = 368;
const VARIANT_COUNT = 55;

const SETS = [
  "Kernspeisekarte_DE",
  "Fruehstueck_Standard",
  "McCafe_Vollsortiment",
  "Drive_Zusatzpakete",
  "Spaetverkauf_Menu",
  "Bahnhof_Kompakt",
  "McSmart_App_Bonus",
  "Eiskaffee_Testlauf",
] as const;

interface Archetype {
  readonly name: string;
  readonly count: number;
  readonly sets: readonly string[];
}

/** Three big buckets + long tail = TOTAL_STORES — marginal looks simple; tail is heavy vs UK. */
const ARCHETYPES: readonly Archetype[] = [
  {
    name: "Autobahn Vollprogramm",
    count: 461,
    sets: [
      "Kernspeisekarte_DE",
      "Fruehstueck_Standard",
      "McCafe_Vollsortiment",
      "Drive_Zusatzpakete",
      "Spaetverkauf_Menu",
    ],
  },
  {
    name: "Bahnhof kompakt",
    count: 368,
    sets: [
      "Kernspeisekarte_DE",
      "Fruehstueck_Standard",
      "McCafe_Vollsortiment",
      "Bahnhof_Kompakt",
    ],
  },
  {
    name: "City Express (ohne McCafe)",
    count: 276,
    sets: [
      "Kernspeisekarte_DE",
      "Fruehstueck_Standard",
      "Drive_Zusatzpakete",
      "Spaetverkauf_Menu",
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
    if (safetyGuard > 8000) {
      throw new Error("de_passb generator: could not find enough unique variants");
    }
    const arch = pick(rand, ARCHETYPES);
    const sets = new Set(arch.sets);
    const operations = rand() < 0.55 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      const addOrRemove = rand();
      if (addOrRemove < 0.48 && sets.size > 1) {
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
  const PER_VARIANT_CAP = 7;
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
      `de_passb generator: expected ${TOTAL_STORES} elements, got ${elements.length}`,
    );
  }
  return elements;
}

function main(): void {
  const rand = mulberry32(SEED);
  const elements = buildElements(rand);

  const meta = {
    market: "DE",
    snapshot: "2026-04-24",
    dimension: "menu_sets" as const,
    source: "viz/upset-tool/src/samples/synthetic-de-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic DE Pass B for the workbench. ${TOTAL_STORES} stores, ` +
      `${SETS.length} menu-sets, 3 dominant archetypes (~75%) + ` +
      `${VARIANT_COUNT} long-tail variants (~25%). Contrasts UK: fewer big ` +
      `cohorts, much heavier residue in the Other rollup when Top-N is tight. ` +
      `Deterministic Mulberry32, seed 0x${SEED.toString(16)}. ` +
      "Regenerate with `npm run gen:de-passb`. Carries no real estate signal.",
  };

  const body = yaml.dump(
    { meta, elements },
    { sortKeys: false, lineWidth: 200, noRefs: true },
  );

  const banner =
    `# Generated by viz/upset-tool/src/samples/_generators/de_passb.ts\n` +
    `# Seed: 0x${SEED.toString(16)}. Stores: ${TOTAL_STORES}. Sets: ${SETS.length}.\n` +
    `# Regenerate with \`npm run gen:de-passb\`. Do not edit by hand.\n`;

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-de-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(`wrote ${elements.length} elements to ${outPath}`);
}

main();
