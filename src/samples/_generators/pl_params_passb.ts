// Synthetic PL Pass B on the **parameters** dimension — **low k** (few distinct
// parameter names in the union) while attrs carry a modest fictionally **live**
// menu-set count per store (~12–14), aligned with PL menu samples (~700 restaurants).
//
// Run: npm run gen:pl-params-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0x504c_02be;
const STORE_ID_START = 3_100_000;
/** Fiction ~national PL restaurant count. */
const TOTAL_STORES = 700;
const LONGTAIL_TARGET = 42;
const VARIANT_COUNT = 24;

const ALL_PARAMS = [
  "SYS_PL_POS_Core",
  "SYS_PL_Kitchen_STD",
  "SYS_PL_DriveThru",
  "SYS_PL_Breakfast_Route",
  "SYS_PL_McCafe_Route",
  "SYS_PL_Delivery_Gate",
  "SYS_PL_Kiosk_STD",
  "SYS_PL_Loyalty_STD",
  "SYS_PL_VAT_Reporting",
  "SYS_PL_Night_Menu",
  "CUST_PL_Seasonal_Layer",
  "CUST_PL_Lab_Menu_X",
] as const;

interface Archetype {
  readonly name: string;
  readonly count: number;
  readonly sets: readonly string[];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: "core_freestanding",
    count: 132,
    sets: [
      "SYS_PL_POS_Core",
      "SYS_PL_Kitchen_STD",
      "SYS_PL_DriveThru",
      "SYS_PL_Breakfast_Route",
      "SYS_PL_McCafe_Route",
      "SYS_PL_Delivery_Gate",
      "SYS_PL_Kiosk_STD",
      "SYS_PL_Loyalty_STD",
      "SYS_PL_VAT_Reporting",
      "SYS_PL_Night_Menu",
    ],
  },
  {
    name: "mall_limited_dt",
    count: 122,
    sets: [
      "SYS_PL_POS_Core",
      "SYS_PL_Kitchen_STD",
      "SYS_PL_DriveThru",
      "SYS_PL_Breakfast_Route",
      "SYS_PL_McCafe_Route",
      "SYS_PL_Kiosk_STD",
      "SYS_PL_VAT_Reporting",
      "SYS_PL_Night_Menu",
    ],
  },
  {
    name: "dt_heavy",
    count: 114,
    sets: [
      "SYS_PL_POS_Core",
      "SYS_PL_Kitchen_STD",
      "SYS_PL_DriveThru",
      "SYS_PL_Breakfast_Route",
      "SYS_PL_Delivery_Gate",
      "SYS_PL_VAT_Reporting",
      "SYS_PL_Night_Menu",
    ],
  },
  {
    name: "mccafe_forward",
    count: 105,
    sets: [
      "SYS_PL_POS_Core",
      "SYS_PL_Kitchen_STD",
      "SYS_PL_Breakfast_Route",
      "SYS_PL_McCafe_Route",
      "SYS_PL_Kiosk_STD",
      "SYS_PL_Loyalty_STD",
      "SYS_PL_VAT_Reporting",
    ],
  },
  {
    name: "seasonal_pilot",
    count: 96,
    sets: [
      "SYS_PL_POS_Core",
      "SYS_PL_Kitchen_STD",
      "SYS_PL_DriveThru",
      "SYS_PL_Breakfast_Route",
      "SYS_PL_McCafe_Route",
      "SYS_PL_Delivery_Gate",
      "SYS_PL_Kiosk_STD",
      "SYS_PL_VAT_Reporting",
      "SYS_PL_Night_Menu",
      "CUST_PL_Seasonal_Layer",
    ],
  },
  {
    name: "lab_menu",
    count: 89,
    sets: [
      "SYS_PL_POS_Core",
      "SYS_PL_Kitchen_STD",
      "SYS_PL_Breakfast_Route",
      "SYS_PL_McCafe_Route",
      "SYS_PL_VAT_Reporting",
      "SYS_PL_Kiosk_STD",
      "CUST_PL_Lab_Menu_X",
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
  attrs?: Record<string, string | number>;
}

function menuSetCountForArchetype(
  rand: () => number,
  name: string,
): number {
  /** Fiction aligned with PL live menu-set footprint (~12–13 on most stores). */
  const base =
    name === "mall_limited_dt"
      ? 12
      : name === "lab_menu"
        ? 12
        : name === "seasonal_pilot"
          ? 13
          : 12;
  return base + Math.floor(rand() * 2);
}

function buildElements(rand: () => number): ElementOut[] {
  const elements: ElementOut[] = [];
  let nextId = STORE_ID_START;

  for (const arch of ARCHETYPES) {
    for (let i = 0; i < arch.count; i++) {
      elements.push({
        id: String(nextId++),
        sets: [...arch.sets],
        attrs: {
          archetype: arch.name,
          menu_set_active_count: menuSetCountForArchetype(rand, arch.name),
          parameter_surface: "low_k_system_heavy",
        },
      });
    }
  }

  const archetypeKeys = new Set(ARCHETYPES.map((a) => canonicalKey(a.sets)));
  const variants: { sets: string[]; derivedFrom: string }[] = [];
  let safetyGuard = 0;

  while (variants.length < VARIANT_COUNT) {
    safetyGuard++;
    if (safetyGuard > 6000) {
      throw new Error("pl_params_passb: could not find enough unique variants");
    }
    const arch = pick(rand, ARCHETYPES);
    const sets = new Set(arch.sets);
    const operations = rand() < 0.5 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      if (rand() < 0.48 && sets.size > 4) {
        const arr = [...sets];
        sets.delete(pick(rand, arr));
      } else {
        const missing = ALL_PARAMS.filter((p) => !sets.has(p));
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
  const PER_VARIANT_CAP = 8;
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
          menu_set_active_count: 12 + Math.floor(rand() * 3),
        },
      });
    }
  });

  if (elements.length !== TOTAL_STORES) {
    throw new Error(
      `pl_params_passb: expected ${TOTAL_STORES} elements, got ${elements.length}`,
    );
  }
  return elements;
}

function main(): void {
  const rand = mulberry32(SEED);
  const elements = buildElements(rand);
  const k = new Set<string>();
  for (const el of elements) for (const s of el.sets) k.add(s);

  const meta = {
    market: "PL",
    snapshot: "2026-04-23",
    dimension: "parameters" as const,
    source: "viz/upset-tool/src/samples/synthetic-pl-parameters-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic Pass B, parameters dimension. ${TOTAL_STORES} restaurants (fiction ~national PL n), only ` +
      `${ALL_PARAMS.length} parameter labels in the generator pool (fiction: low parameter cardinality ` +
      `in the UpSet view). attrs.menu_set_active_count is ~12–14 to align with the PL menu-set ` +
      `fiction (typical live footprint, not a huge menu surface per store). ` +
      `Most rows are SYS_PL_* (system); CUST_PL_* appear on pilot/lab cohorts. Seed 0x${SEED.toString(16)}. ` +
      "Regenerate: `npm run gen:pl-params-passb`. No real estate signal.",
  };

  const body = yaml.dump(
    { meta, elements },
    { sortKeys: false, lineWidth: 200, noRefs: true },
  );

  const banner =
    `# Generated by viz/upset-tool/src/samples/_generators/pl_params_passb.ts\n` +
    `# Seed: 0x${SEED.toString(16)}. Dimension: parameters.\n` +
    `# Regenerate: npm run gen:pl-params-passb\n`;

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-pl-parameters-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(`wrote ${elements.length} elements, k=${k.size} to ${outPath}`);
}

main();
