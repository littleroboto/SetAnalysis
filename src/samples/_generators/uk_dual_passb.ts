// UK dual Pass B: same stores, `menu_sets` + `parameters` per row (meta.dimension: dual).
// Menu archetypes match uk_passb; parameter presets align by cohort narrative.
//
// Run: npm run gen:uk-dual-passb

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SEED = 0x55_c0_de_44;
const STORE_ID_START = 8_260_000;
const TOTAL_STORES = 1500;
const LONGTAIL_TARGET = 75;
const VARIANT_COUNT = 40;

const MENU_SETS = [
  "Core_Menu",
  "Breakfast",
  "McCafé",
  "DriveThru_Add-ons",
  "LateNight_Menu",
  "Mall_LimitedMenu",
  "Loyalty_Promo_2026Q1",
  "LabTest_Iced",
  "Delivery_Platforms",
  "Kiosk_FullMenu",
  "Table_Service_Zone",
  "Plant_Based_Expanded",
  "Regional_Specials_UK",
  "GameDay_Promo_Bundle",
] as const;

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

interface MenuArch {
  readonly name: string;
  readonly count: number;
  readonly menu_sets: readonly string[];
}

const MENU_ARCHETYPES: readonly MenuArch[] = [
  {
    name: "Freestanding standard",
    count: 420,
    menu_sets: [
      "Core_Menu",
      "Breakfast",
      "McCafé",
      "DriveThru_Add-ons",
      "LateNight_Menu",
    ],
  },
  {
    name: "Mall standard",
    count: 350,
    menu_sets: [
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
    menu_sets: ["Core_Menu", "Breakfast", "DriveThru_Add-ons", "LateNight_Menu"],
  },
  {
    name: "Loyalty pilot",
    count: 120,
    menu_sets: [
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
    menu_sets: ["Core_Menu", "Breakfast", "McCafé", "LabTest_Iced"],
  },
  {
    name: "Delivery & digital",
    count: 100,
    menu_sets: [
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
    menu_sets: ["Core_Menu", "Breakfast", "McCafé", "Plant_Based_Expanded"],
  },
  {
    name: "Regional & gameday overlay",
    count: 30,
    menu_sets: [
      "Core_Menu",
      "Breakfast",
      "McCafé",
      "Regional_Specials_UK",
      "GameDay_Promo_Bundle",
    ],
  },
];

/** Parameter bundle paired with each menu archetype name (fiction). */
const PARAM_BY_MENU: Record<string, readonly string[]> = {
  "Freestanding standard": [
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
  "Mall standard": [
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
  "DT-express": [
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
  "Loyalty pilot": [
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
  "Lab cohort": [
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
  "Delivery & digital": [
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
  "Plant-forward trial": [
    "SYS_POS_UK_Base",
    "SYS_Kitchen_Display_STD",
    "SYS_McCafe_Route_STD",
    "SYS_Pricing_Branch_Base",
    "SYS_Backoffice_UK",
    "SYS_Digital_Receipt_UK",
    "CUST_Dynamic_Surge_Pilot",
  ],
  "Regional & gameday overlay": [
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

function mutateParams(
  rand: () => number,
  base: readonly string[],
): string[] {
  const sets = new Set(base);
  const ops = rand() < 0.55 ? 1 : 2;
  for (let o = 0; o < ops; o++) {
    if (rand() < 0.45 && sets.size > 4) {
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
    const params = PARAM_BY_MENU[arch.name];
    if (!params) throw new Error(`missing PARAM_BY_MENU for ${arch.name}`);
    for (let i = 0; i < arch.count; i++) {
      rows.push({
        id: String(nextId++),
        menu_sets: [...arch.menu_sets],
        parameters: [...params],
        attrs: {
          archetype: arch.name,
          menu_set_count: arch.menu_sets.length,
          param_count: params.length,
        },
      });
    }
  }

  const variants: { menu_sets: string[]; derivedFrom: string }[] = [];
  let guard = 0;
  while (variants.length < VARIANT_COUNT) {
    guard++;
    if (guard > 6000) throw new Error("uk_dual: not enough menu variants");
    const arch = pick(rand, MENU_ARCHETYPES);
    const sets = new Set(arch.menu_sets);
    const operations = rand() < 0.6 ? 1 : 2;
    for (let op = 0; op < operations; op++) {
      if (rand() < 0.5 && sets.size > 1) {
        const arr = [...sets];
        sets.delete(pick(rand, arr));
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
  const CAP = 4;
  while (remaining > 0) {
    const idx = Math.floor(rand() * VARIANT_COUNT);
    if (counts[idx] < CAP) {
      counts[idx]++;
      remaining--;
    }
  }

  variants.forEach((v, i) => {
    const baseParams = PARAM_BY_MENU[v.derivedFrom];
    if (!baseParams) throw new Error(`tail preset ${v.derivedFrom}`);
    for (let k = 0; k < counts[i]; k++) {
      rows.push({
        id: String(nextId++),
        menu_sets: v.menu_sets,
        parameters: mutateParams(rand, baseParams),
        attrs: {
          archetype: "long_tail",
          derived_from: v.derivedFrom,
        },
      });
    }
  });

  if (rows.length !== TOTAL_STORES) {
    throw new Error(`uk_dual: expected ${TOTAL_STORES} rows, got ${rows.length}`);
  }
  return rows;
}

function main(): void {
  const rand = mulberry32(SEED);
  const elements = buildRows(rand);

  const meta = {
    market: "UK",
    snapshot: "2026-04-24",
    dimension: "dual" as const,
    source: "viz/upset-tool/src/samples/synthetic-uk-dual-passb.yaml",
    evidence: "input_config" as const,
    notes:
      `Synthetic dual Pass B: each store has menu_sets and parameters. ${TOTAL_STORES} stores, ` +
      `${MENU_SETS.length} menu labels in pool, ${ALL_PARAMS.length} parameter labels in pool. ` +
      `Workbench renders two UpSet panels stacked vertically. Mulberry32 seed 0x${SEED.toString(16)}. ` +
      "`npm run gen:uk-dual-passb`. Fiction only.",
  };

  const body = yaml.dump(
    { meta, elements },
    { sortKeys: false, lineWidth: 200, noRefs: true },
  );
  const banner =
    `# Generated by uk_dual_passb.ts — seed 0x${SEED.toString(16)}\n` +
    `# npm run gen:uk-dual-passb\n`;
  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "synthetic-uk-dual-passb.yaml",
  );
  writeFileSync(outPath, banner + body, "utf8");
  console.log(`wrote ${elements.length} dual rows to ${outPath}`);
}

main();
