// NL dual Pass B: NL catalog menu names + compact NL parameters. Run: npm run gen:nl-dual-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0x4e4c_0003;
const STORE_ID_START = 31_000_000;
const TOTAL_STORES = 270;
const LONGTAIL_TARGET = 8;
const VARIANT_COUNT = 8;
const PER_VARIANT_CAP = 2;

const MENU_SETS = [
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

const ALL_PARAMS = [
  "SYS_NL_POS_Core",
  "SYS_NL_Kitchen_STD",
  "SYS_NL_McCafe_Route",
  "SYS_NL_ODMB",
  "SYS_NL_Deposit",
  "SYS_NL_VAT_Reporting",
  "CUST_NL_Schiphol_Profile",
  "CUST_NL_Lab_Flag",
] as const;

interface MenuArch {
  readonly name: string;
  readonly count: number;
  readonly menu_sets: readonly string[];
}

const MENU_ARCHETYPES: readonly MenuArch[] = [
  {
    name: "NL_core_standard",
    count: 240,
    menu_sets: [
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
    menu_sets: [
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
    menu_sets: [
      "Menu Item Set - Netherlands",
      "Menu Item Set - McCafé",
      "Menu Item Set - Hot Choco",
      "Menu Item Set - Salad Bar",
      "Bottle Deposit",
    ],
  },
];

const PARAM_BY_MENU: Record<string, readonly string[]> = {
  NL_core_standard: [
    "SYS_NL_POS_Core",
    "SYS_NL_Kitchen_STD",
    "SYS_NL_McCafe_Route",
    "SYS_NL_ODMB",
    "SYS_NL_Deposit",
    "SYS_NL_VAT_Reporting",
  ],
  NL_schiphol_cluster: [
    "SYS_NL_POS_Core",
    "SYS_NL_Kitchen_STD",
    "SYS_NL_McCafe_Route",
    "SYS_NL_ODMB",
    "SYS_NL_Deposit",
    "CUST_NL_Schiphol_Profile",
  ],
  NL_cafe_snack_forward: [
    "SYS_NL_POS_Core",
    "SYS_NL_Kitchen_STD",
    "SYS_NL_McCafe_Route",
    "SYS_NL_ODMB",
    "CUST_NL_Lab_Flag",
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
  if (rand() < 0.5 && sets.size > 3) {
    sets.delete(pick(rand, [...sets]));
  } else {
    const missing = ALL_PARAMS.filter((p) => !sets.has(p));
    if (missing.length > 0) sets.add(pick(rand, missing));
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
    if (guard > 40_000) throw new Error("nl_dual: variants");
    const arch = pick(rand, MENU_ARCHETYPES);
    const sets = new Set(arch.menu_sets);
    const operations = rand() < 0.65 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      if (rand() < 0.42 && sets.size > 1) {
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
  while (remaining > 0) {
    const idx = Math.floor(rand() * VARIANT_COUNT);
    if (counts[idx] < PER_VARIANT_CAP) {
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
    throw new Error(`nl_dual: expected ${TOTAL_STORES}, got ${rows.length}`);
  }
  return rows;
}

function main(): void {
  const elements = buildRows(mulberry32(SEED));
  const meta = {
    market: "NL",
    snapshot: "2026-04-24",
    dimension: "dual" as const,
    source: "viz/upset-tool/src/samples/synthetic-nl-dual-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic NL dual: menu-set names align with nl_menu_sets.tsv catalog; ` +
      `parameters are compact fiction. ${TOTAL_STORES} stores. Seed 0x${SEED.toString(16)}. Fiction.`,
  };
  const body = yaml.dump({ meta, elements }, { sortKeys: false, lineWidth: 200, noRefs: true });
  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-nl-dual-passb.yaml",
  );
  writeFileSync(outPath, `# nl_dual_passb.ts\n` + body, "utf8");
  console.log(`wrote ${elements.length} rows to ${outPath}`);
}

main();
