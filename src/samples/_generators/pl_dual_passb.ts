// PL dual Pass B: live menu_sets (~12–13 per store) + catalog-only unassigned
// menu sets in YAML + low-k parameters. Run: npm run gen:pl-dual-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import {
  CATALOG_MENU_SETS_NOT_LIVE,
  LIVE_MENU_SETS,
  PL_LONGTAIL_TARGET,
  PL_MENU_ARCHETYPES,
  PL_TOTAL_STORES,
  PL_VARIANT_COUNT,
} from "./pl_menu_catalog";

const SEED = 0x504c_02bd;
const STORE_ID_START = 48_000_000;
const PER_VARIANT_CAP = 4;

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

const PARAM_BY_MENU: Record<string, readonly string[]> = {
  Autostrada_pelna: [
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
  Dworzec_kompakt: [
    "SYS_PL_POS_Core",
    "SYS_PL_Kitchen_STD",
    "SYS_PL_DriveThru",
    "SYS_PL_Breakfast_Route",
    "SYS_PL_McCafe_Route",
    "SYS_PL_Kiosk_STD",
    "SYS_PL_VAT_Reporting",
    "SYS_PL_Night_Menu",
  ],
  Miasto_bez_McCafe: [
    "SYS_PL_POS_Core",
    "SYS_PL_Kitchen_STD",
    "SYS_PL_DriveThru",
    "SYS_PL_Breakfast_Route",
    "SYS_PL_Delivery_Gate",
    "SYS_PL_VAT_Reporting",
    "SYS_PL_Night_Menu",
  ],
  Galeria_limit: [
    "SYS_PL_POS_Core",
    "SYS_PL_Kitchen_STD",
    "SYS_PL_Breakfast_Route",
    "SYS_PL_McCafe_Route",
    "SYS_PL_Kiosk_STD",
    "SYS_PL_Loyalty_STD",
    "SYS_PL_VAT_Reporting",
  ],
  Aplikacja_lojalnosc: [
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
  Lokal_testy_sezon: [
    "SYS_PL_POS_Core",
    "SYS_PL_Kitchen_STD",
    "SYS_PL_Breakfast_Route",
    "SYS_PL_McCafe_Route",
    "SYS_PL_VAT_Reporting",
    "SYS_PL_Kiosk_STD",
    "CUST_PL_Lab_Menu_X",
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
      sets.delete(pick(rand, [...sets]));
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
  const menuKeys = new Set(
    PL_MENU_ARCHETYPES.map((a) => canonicalKey(a.menu_sets)),
  );

  for (const arch of PL_MENU_ARCHETYPES) {
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
  while (variants.length < PL_VARIANT_COUNT) {
    guard++;
    if (guard > 25_000) throw new Error("pl_dual: variants");
    const arch = pick(rand, PL_MENU_ARCHETYPES);
    const sets = new Set(arch.menu_sets);
    const operations = rand() < 0.58 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      if (rand() < 0.46 && sets.size > 1) {
        sets.delete(pick(rand, [...sets]));
      } else {
        const missing = LIVE_MENU_SETS.filter((s) => !sets.has(s));
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

  const counts = new Array<number>(PL_VARIANT_COUNT).fill(1);
  let remaining = PL_LONGTAIL_TARGET - PL_VARIANT_COUNT;
  while (remaining > 0) {
    const idx = Math.floor(rand() * PL_VARIANT_COUNT);
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

  if (rows.length !== PL_TOTAL_STORES) {
    throw new Error(`pl_dual: expected ${PL_TOTAL_STORES}, got ${rows.length}`);
  }
  return rows;
}

function main(): void {
  const elements = buildRows(mulberry32(SEED));
  const liveUnion = new Set<string>();
  for (const el of elements) for (const s of el.menu_sets) liveUnion.add(s);

  const meta = {
    market: "PL",
    snapshot: "2026-04-24",
    dimension: "dual" as const,
    source: "viz/upset-tool/src/samples/synthetic-pl-dual-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic PL dual. ${PL_TOTAL_STORES} restaurants (fiction ~national PL n); menu side uses ~12–13 live menu-sets per archetype ` +
      `(${LIVE_MENU_SETS.length} labels in live pool; stores union k=${liveUnion.size}). ` +
      `catalog_menu_sets_unassigned: ${CATALOG_MENU_SETS_NOT_LIVE.length} names never on a store. ` +
      `Seed 0x${SEED.toString(16)}. npm run gen:pl-dual-passb. Fiction.`,
  };

  const doc = {
    meta,
    elements,
    catalog_menu_sets_unassigned: [...CATALOG_MENU_SETS_NOT_LIVE],
  };

  const body = yaml.dump(doc, { sortKeys: false, lineWidth: 200, noRefs: true });
  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-pl-dual-passb.yaml",
  );
  writeFileSync(
    outPath,
    `# pl_dual_passb.ts — seed 0x${SEED.toString(16)}\n` + body,
    "utf8",
  );
  console.log(
    `wrote ${elements.length} rows, live union k=${liveUnion.size}, catalog-only=${CATALOG_MENU_SETS_NOT_LIVE.length} to ${outPath}`,
  );
}

main();
