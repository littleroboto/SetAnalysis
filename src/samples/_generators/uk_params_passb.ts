// Synthetic UK Pass B on the **parameters** dimension — many distinct parameter
// names in the union (fiction: UK-style dense feature/parameter surface) with a
// mix of SYS_* (system-scoped standard) and CUST_* (custom / regional / pilot)
// labels. Contrasts with PL parameters sample (low k, high menu-set estate in attrs).
//
// Run: npm run gen:uk-params-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0x55_c0_de_43;
const STORE_ID_START = 8_260_000;
const TOTAL_STORES = 1500;
const LONGTAIL_TARGET = 75;
const VARIANT_COUNT = 38;

const ALL_PARAMS = [
  "SYS_POS_UK_Base",
  "SYS_Kitchen_Display_STD",
  "SYS_Kiosk_Catalogue_UK",
  "SYS_DT_Lane_Logic",
  "SYS_Table_Routing_UK",
  "SYS_Delivery_Gate_UK",
  "SYS_VAT_Reporting_UK",
  "SYS_Cashdrawer_UK",
  "SYS_Loyalty_App_UK",
  "SYS_Breakfast_Auto_Window",
  "SYS_LateNight_Auto_Window",
  "SYS_Allergen_UK_Print",
  "SYS_KDS_Course_STD",
  "SYS_Remote_Support_UK",
  "SYS_Inventory_Floor_UK",
  "SYS_EOD_Reporting_STD",
  "SYS_DT_Timer_STD",
  "SYS_McCafe_Route_STD",
  "SYS_Pricing_Branch_Base",
  "SYS_Staff_Meal_UK",
  "SYS_HACCP_STD",
  "SYS_Waste_Tracking_STD",
  "SYS_Backoffice_UK",
  "SYS_POS_Offline_Queue",
  "SYS_Lab_Readonly_Flag",
  "SYS_Digital_Receipt_UK",
  "CUST_Scot_Regional_Promo",
  "CUST_Wales_Bun_Override",
  "CUST_London_Surcharge_Mode",
  "CUST_Stadium_Venue_Core",
  "CUST_Airport_Concourse",
  "CUST_Campus_Extended_Hours",
  "CUST_Lab_Sandwich_A",
  "CUST_Lab_Sandwich_B",
  "CUST_Xmas_Seasonal_UK",
  "CUST_GameDay_Overlay_UK",
  "CUST_Highway_MS_Only",
  "CUST_Dynamic_Surge_Pilot",
  "CUST_Retail_Park_Bundle",
] as const;

interface Archetype {
  readonly name: string;
  readonly count: number;
  readonly sets: readonly string[];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: "standard_freestanding",
    count: 400,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_DT_Lane_Logic",
      "SYS_Delivery_Gate_UK",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Loyalty_App_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_LateNight_Auto_Window",
      "SYS_Allergen_UK_Print",
      "SYS_KDS_Course_STD",
      "SYS_Remote_Support_UK",
      "SYS_Inventory_Floor_UK",
      "SYS_EOD_Reporting_STD",
      "SYS_DT_Timer_STD",
      "SYS_McCafe_Route_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_Staff_Meal_UK",
      "SYS_HACCP_STD",
      "SYS_Waste_Tracking_STD",
      "SYS_Backoffice_UK",
      "SYS_Digital_Receipt_UK",
    ],
  },
  {
    name: "mall_table_service",
    count: 280,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_Table_Routing_UK",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Loyalty_App_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_Allergen_UK_Print",
      "SYS_KDS_Course_STD",
      "SYS_Inventory_Floor_UK",
      "SYS_EOD_Reporting_STD",
      "SYS_McCafe_Route_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_Staff_Meal_UK",
      "SYS_HACCP_STD",
      "SYS_Waste_Tracking_STD",
      "SYS_Backoffice_UK",
      "SYS_POS_Offline_Queue",
      "SYS_Digital_Receipt_UK",
      "CUST_Retail_Park_Bundle",
    ],
  },
  {
    name: "dt_express",
    count: 250,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_DT_Lane_Logic",
      "SYS_Delivery_Gate_UK",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_LateNight_Auto_Window",
      "SYS_KDS_Course_STD",
      "SYS_EOD_Reporting_STD",
      "SYS_DT_Timer_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_Staff_Meal_UK",
      "SYS_HACCP_STD",
      "SYS_Waste_Tracking_STD",
      "SYS_Backoffice_UK",
      "SYS_Digital_Receipt_UK",
    ],
  },
  {
    name: "digital_heavy",
    count: 150,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_DT_Lane_Logic",
      "SYS_Delivery_Gate_UK",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Loyalty_App_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_LateNight_Auto_Window",
      "SYS_Allergen_UK_Print",
      "SYS_KDS_Course_STD",
      "SYS_EOD_Reporting_STD",
      "SYS_DT_Timer_STD",
      "SYS_McCafe_Route_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_HACCP_STD",
      "SYS_Waste_Tracking_STD",
      "SYS_Backoffice_UK",
      "SYS_Digital_Receipt_UK",
      "CUST_Dynamic_Surge_Pilot",
      "CUST_Lab_Sandwich_A",
      "CUST_Lab_Sandwich_B",
    ],
  },
  {
    name: "loyalty_pilot",
    count: 120,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_DT_Lane_Logic",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Loyalty_App_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_LateNight_Auto_Window",
      "SYS_Allergen_UK_Print",
      "SYS_KDS_Course_STD",
      "SYS_Remote_Support_UK",
      "SYS_Inventory_Floor_UK",
      "SYS_EOD_Reporting_STD",
      "SYS_DT_Timer_STD",
      "SYS_McCafe_Route_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_Staff_Meal_UK",
      "SYS_HACCP_STD",
      "SYS_Waste_Tracking_STD",
      "SYS_Backoffice_UK",
      "SYS_Digital_Receipt_UK",
      "CUST_Dynamic_Surge_Pilot",
      "CUST_Xmas_Seasonal_UK",
    ],
  },
  {
    name: "lab_cohort",
    count: 85,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_KDS_Course_STD",
      "SYS_EOD_Reporting_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_HACCP_STD",
      "SYS_Backoffice_UK",
      "SYS_Lab_Readonly_Flag",
      "SYS_POS_Offline_Queue",
      "CUST_Lab_Sandwich_A",
      "CUST_Lab_Sandwich_B",
      "CUST_Dynamic_Surge_Pilot",
      "CUST_GameDay_Overlay_UK",
    ],
  },
  {
    name: "regional_overlay",
    count: 90,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_DT_Lane_Logic",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Loyalty_App_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_LateNight_Auto_Window",
      "SYS_Allergen_UK_Print",
      "SYS_KDS_Course_STD",
      "SYS_Inventory_Floor_UK",
      "SYS_EOD_Reporting_STD",
      "SYS_DT_Timer_STD",
      "SYS_McCafe_Route_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_Staff_Meal_UK",
      "SYS_HACCP_STD",
      "SYS_Waste_Tracking_STD",
      "SYS_Backoffice_UK",
      "SYS_Digital_Receipt_UK",
      "CUST_Scot_Regional_Promo",
      "CUST_Wales_Bun_Override",
      "CUST_London_Surcharge_Mode",
      "CUST_Xmas_Seasonal_UK",
    ],
  },
  {
    name: "venue_special",
    count: 50,
    sets: [
      "SYS_POS_UK_Base",
      "SYS_Kitchen_Display_STD",
      "SYS_Kiosk_Catalogue_UK",
      "SYS_VAT_Reporting_UK",
      "SYS_Cashdrawer_UK",
      "SYS_Breakfast_Auto_Window",
      "SYS_Allergen_UK_Print",
      "SYS_KDS_Course_STD",
      "SYS_EOD_Reporting_STD",
      "SYS_Pricing_Branch_Base",
      "SYS_HACCP_STD",
      "SYS_Backoffice_UK",
      "CUST_Stadium_Venue_Core",
      "CUST_Airport_Concourse",
      "CUST_Campus_Extended_Hours",
      "CUST_GameDay_Overlay_UK",
      "CUST_Highway_MS_Only",
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
          menu_set_active_count: 6 + Math.floor(rand() * 5),
          param_scope_mix:
            arch.sets.filter((p) => p.startsWith("CUST_")).length > 0
              ? "sys_plus_custom"
              : "sys_only",
        },
      });
    }
  }

  const archetypeKeys = new Set(ARCHETYPES.map((a) => canonicalKey(a.sets)));
  const variants: { sets: string[]; derivedFrom: string }[] = [];
  let safetyGuard = 0;

  while (variants.length < VARIANT_COUNT) {
    safetyGuard++;
    if (safetyGuard > 8000) {
      throw new Error("uk_params_passb: could not find enough unique variants");
    }
    const arch = pick(rand, ARCHETYPES);
    const sets = new Set(arch.sets);
    const operations = rand() < 0.55 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      if (rand() < 0.5 && sets.size > 3) {
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
          menu_set_active_count: 5 + Math.floor(rand() * 8),
        },
      });
    }
  });

  if (elements.length !== TOTAL_STORES) {
    throw new Error(
      `uk_params_passb: expected ${TOTAL_STORES} elements, got ${elements.length}`,
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
    market: "UK",
    snapshot: "2026-04-23",
    dimension: "parameters" as const,
    source: "viz/upset-tool/src/samples/synthetic-uk-parameters-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic Pass B, parameters dimension. ${TOTAL_STORES} stores, ` +
      `${k.size} distinct parameter names in the union (SYS_* standard vs CUST_* custom/pilot). ` +
      `Fiction: UK-style dense parameter surface vs a relatively smaller menu-set footprint per store ` +
      `(see attrs.menu_set_active_count). Mulberry32 seed 0x${SEED.toString(16)}. ` +
      "Regenerate: `npm run gen:uk-params-passb`. No real estate signal.",
  };

  const body = yaml.dump(
    { meta, elements },
    { sortKeys: false, lineWidth: 200, noRefs: true },
  );

  const banner =
    `# Generated by viz/upset-tool/src/samples/_generators/uk_params_passb.ts\n` +
    `# Seed: 0x${SEED.toString(16)}. Dimension: parameters.\n` +
    `# Regenerate: npm run gen:uk-params-passb\n`;

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-uk-parameters-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(`wrote ${elements.length} elements, k=${k.size} to ${outPath}`);
}

main();
