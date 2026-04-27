// Synthetic PL "Pass B" generator for the RFM UpSet workbench.
//
// Produces ../synthetic-pl-passb.yaml — most stores carry ~12–13 live menu-sets,
// while YAML also lists many catalog-only TEST_/LAB_ menu sets never assigned
// to any store (high catalog k vs moderate live k). Fiction only.
//
// Run with:  npm run gen:pl-passb

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

/** Bump when PL estate shape changes (see PL_TOTAL_STORES in pl_menu_catalog). */
const SEED = 0x504c_02bc;

const STORE_ID_START = 48_000_000;
const PER_VARIANT_CAP = 4;

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

  for (const arch of PL_MENU_ARCHETYPES) {
    for (let i = 0; i < arch.count; i++) {
      elements.push({
        id: String(nextId++),
        sets: [...arch.menu_sets],
        attrs: {
          archetype: arch.name,
          live_menu_set_count: String(arch.menu_sets.length),
        },
      });
    }
  }

  const archetypeKeys = new Set(
    PL_MENU_ARCHETYPES.map((a) => canonicalKey(a.menu_sets)),
  );
  const variants: { sets: string[]; derivedFrom: string }[] = [];
  let safetyGuard = 0;

  while (variants.length < PL_VARIANT_COUNT) {
    safetyGuard++;
    if (safetyGuard > 20_000) {
      throw new Error("pl_passb generator: could not find enough unique variants");
    }
    const arch = pick(rand, PL_MENU_ARCHETYPES);
    const sets = new Set(arch.menu_sets);
    const operations = rand() < 0.58 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      const addOrRemove = rand();
      if (addOrRemove < 0.46 && sets.size > 1) {
        const arr = [...sets];
        sets.delete(pick(rand, arr));
      } else {
        const missing = LIVE_MENU_SETS.filter((s) => !sets.has(s));
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
    for (let k = 0; k < counts[i]; k++) {
      elements.push({
        id: String(nextId++),
        sets: v.sets,
        attrs: {
          archetype: "long_tail",
          derived_from: v.derivedFrom,
          live_menu_set_count: String(v.sets.length),
        },
      });
    }
  });

  if (elements.length !== PL_TOTAL_STORES) {
    throw new Error(
      `pl_passb generator: expected ${PL_TOTAL_STORES} elements, got ${elements.length}`,
    );
  }
  return elements;
}

function main(): void {
  const rand = mulberry32(SEED);
  const elements = buildElements(rand);

  const liveUnion = new Set<string>();
  for (const el of elements) for (const s of el.sets) liveUnion.add(s);

  const meta = {
    market: "PL",
    snapshot: "2026-04-24",
    dimension: "menu_sets" as const,
    source: "viz/upset-tool/src/samples/synthetic-pl-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic PL Pass B. ${PL_TOTAL_STORES} restaurants (fiction ~national PL n); archetypes and tail use only ` +
      `${LIVE_MENU_SETS.length} live-catalog labels (stores typically 12–13 menu-sets each). ` +
      `Sibling key catalog_menu_sets_unassigned lists ${CATALOG_MENU_SETS_NOT_LIVE.length} ` +
      `TEST_/LAB_ menu sets never linked to any store — fiction for catalog bloat vs estate footprint. ` +
      `Live union size on stores: ${liveUnion.size}. Mulberry32 seed 0x${SEED.toString(16)}. ` +
      "`npm run gen:pl-passb`. No real estate signal.",
  };

  const doc = {
    meta,
    elements,
    catalog_menu_sets_unassigned: [...CATALOG_MENU_SETS_NOT_LIVE],
  };

  const body = yaml.dump(doc, { sortKeys: false, lineWidth: 200, noRefs: true });

  const banner =
    `# Generated by viz/upset-tool/src/samples/_generators/pl_passb.ts\n` +
    `# Seed: 0x${SEED.toString(16)}. Stores: ${PL_TOTAL_STORES}. Live pool: ${LIVE_MENU_SETS.length}. ` +
    `# Catalog-only (no store): ${CATALOG_MENU_SETS_NOT_LIVE.length}.\n` +
    `# Regenerate with \`npm run gen:pl-passb\`. Do not edit by hand.\n`;

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-pl-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(
    `wrote ${elements.length} elements, live k=${liveUnion.size}, catalog-only=${CATALOG_MENU_SETS_NOT_LIVE.length} to ${outPath}`,
  );
}

main();
