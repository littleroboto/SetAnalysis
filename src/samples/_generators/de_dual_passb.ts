// DE dual Pass B: menu_sets + parameters per store. Run: npm run gen:de-dual-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0xde_ad_be_f0;
const STORE_ID_START = 27_600_000;
const TOTAL_STORES = 1473;
const LONGTAIL_TARGET = 368;
const VARIANT_COUNT = 55;

const MENU_SETS = [
  "Kernspeisekarte_DE",
  "Fruehstueck_Standard",
  "McCafe_Vollsortiment",
  "Drive_Zusatzpakete",
  "Spaetverkauf_Menu",
  "Bahnhof_Kompakt",
  "McSmart_App_Bonus",
  "Eiskaffee_Testlauf",
] as const;

const ALL_PARAMS = [
  "SYS_DE_POS_Base",
  "SYS_DE_Kitchen_STD",
  "SYS_DE_DT_Lane",
  "SYS_DE_Breakfast_Route",
  "SYS_DE_McCafe_Route",
  "SYS_DE_VAT_Reporting",
  "SYS_DE_Kiosk_STD",
  "SYS_DE_Night_Menu",
  "SYS_DE_Loyalty_STD",
  "SYS_DE_EOD_STD",
  "CUST_DE_Bahnhof_Mode",
  "CUST_DE_App_Pilot",
] as const;

interface MenuArch {
  readonly name: string;
  readonly count: number;
  readonly menu_sets: readonly string[];
}

const MENU_ARCHETYPES: readonly MenuArch[] = [
  {
    name: "Autobahn Vollprogramm",
    count: 461,
    menu_sets: [
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
    menu_sets: [
      "Kernspeisekarte_DE",
      "Fruehstueck_Standard",
      "McCafe_Vollsortiment",
      "Bahnhof_Kompakt",
    ],
  },
  {
    name: "City Express (ohne McCafe)",
    count: 276,
    menu_sets: [
      "Kernspeisekarte_DE",
      "Fruehstueck_Standard",
      "Drive_Zusatzpakete",
      "Spaetverkauf_Menu",
    ],
  },
];

const PARAM_BY_MENU: Record<string, readonly string[]> = {
  "Autobahn Vollprogramm": [
    "SYS_DE_POS_Base",
    "SYS_DE_Kitchen_STD",
    "SYS_DE_DT_Lane",
    "SYS_DE_Breakfast_Route",
    "SYS_DE_McCafe_Route",
    "SYS_DE_VAT_Reporting",
    "SYS_DE_Kiosk_STD",
    "SYS_DE_Night_Menu",
    "SYS_DE_Loyalty_STD",
    "SYS_DE_EOD_STD",
  ],
  "Bahnhof kompakt": [
    "SYS_DE_POS_Base",
    "SYS_DE_Kitchen_STD",
    "SYS_DE_Breakfast_Route",
    "SYS_DE_McCafe_Route",
    "SYS_DE_VAT_Reporting",
    "SYS_DE_Kiosk_STD",
    "SYS_DE_EOD_STD",
    "CUST_DE_Bahnhof_Mode",
  ],
  "City Express (ohne McCafe)": [
    "SYS_DE_POS_Base",
    "SYS_DE_Kitchen_STD",
    "SYS_DE_DT_Lane",
    "SYS_DE_Breakfast_Route",
    "SYS_DE_VAT_Reporting",
    "SYS_DE_Night_Menu",
    "SYS_DE_EOD_STD",
    "CUST_DE_App_Pilot",
  ],
};

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

function mutateParams(rand: () => number, base: readonly string[]): string[] {
  const sets = new Set(base);
  const ops = rand() < 0.55 ? 1 : 2;
  for (let o = 0; o < ops; o++) {
    if (rand() < 0.45 && sets.size > 3) {
      const arr = [...sets];
      sets.delete(pick(rand, arr));
    } else {
      const missing = ALL_PARAMS.filter((p) => !sets.has(p));
      if (missing.length > 0) sets.add(pick(rand, missing));
    }
  }
  return [...sets].sort();
}

interface RowOut {
  id: string;
  menu_sets: string[];
  parameters: string[];
  attrs?: Record<string, string | number>;
}

function buildRows(rand: () => number): RowOut[] {
  const rows: RowOut[] = [];
  let nextId = STORE_ID_START;
  const menuKeys = new Set(MENU_ARCHETYPES.map((a) => canonicalKey(a.menu_sets)));

  for (const arch of MENU_ARCHETYPES) {
    const p = PARAM_BY_MENU[arch.name];
    if (!p) throw new Error(arch.name);
    for (let i = 0; i < arch.count; i++) {
      rows.push({
        id: String(nextId++),
        menu_sets: [...arch.menu_sets],
        parameters: [...p],
        attrs: { archetype: arch.name },
      });
    }
  }

  const variants: { menu_sets: string[]; derivedFrom: string }[] = [];
  let guard = 0;
  while (variants.length < VARIANT_COUNT) {
    guard++;
    if (guard > 12_000) throw new Error("de_dual: variants");
    const arch = pick(rand, MENU_ARCHETYPES);
    const sets = new Set(arch.menu_sets);
    const operations = rand() < 0.55 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      if (rand() < 0.48 && sets.size > 1) {
        sets.delete(pick(rand, [...sets]));
      } else {
        const missing = MENU_SETS.filter((s) => !sets.has(s));
        if (missing.length > 0) sets.add(pick(rand, missing));
      }
    }
    if (sets.size === 0) continue;
    const sorted = [...sets].sort();
    const key = canonicalKey(sorted);
    if (menuKeys.has(key)) continue;
    if (variants.some((v) => canonicalKey(v.menu_sets) === key)) continue;
    variants.push({ menu_sets: sorted, derivedFrom: arch.name });
  }

  const counts = new Array<number>(VARIANT_COUNT).fill(1);
  let remaining = LONGTAIL_TARGET - VARIANT_COUNT;
  const CAP = 7;
  while (remaining > 0) {
    const idx = Math.floor(rand() * VARIANT_COUNT);
    if (counts[idx] < CAP) {
      counts[idx]++;
      remaining--;
    }
  }

  variants.forEach((v, i) => {
    const base = PARAM_BY_MENU[v.derivedFrom];
    if (!base) throw new Error(v.derivedFrom);
    for (let k = 0; k < counts[i]; k++) {
      rows.push({
        id: String(nextId++),
        menu_sets: v.menu_sets,
        parameters: mutateParams(rand, base),
        attrs: { archetype: "long_tail", derived_from: v.derivedFrom },
      });
    }
  });

  if (rows.length !== TOTAL_STORES) {
    throw new Error(`de_dual: expected ${TOTAL_STORES}, got ${rows.length}`);
  }
  return rows;
}

function main(): void {
  const elements = buildRows(mulberry32(SEED));
  const meta = {
    market: "DE",
    snapshot: "2026-04-24",
    dimension: "dual" as const,
    source: "viz/upset-tool/src/samples/synthetic-de-dual-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic DE dual Pass B. ${TOTAL_STORES} stores; long menu tail (~25%) vs compact DE parameter surface. ` +
      `Seed 0x${SEED.toString(16)}. npm run gen:de-dual-passb. Fiction.`,
  };
  const body = yaml.dump({ meta, elements }, { sortKeys: false, lineWidth: 200, noRefs: true });
  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-de-dual-passb.yaml",
  );
  writeFileSync(
    outPath,
    `# de_dual_passb.ts seed 0x${SEED.toString(16)}\n` + body,
    "utf8",
  );
  console.log(`wrote ${elements.length} rows to ${outPath}`);
}

main();
