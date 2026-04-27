/**
 * Shared PL fiction: live menu-set labels (subset assigned per store, ~12–13
 * each) vs catalog-only test labels never linked to any store.
 *
 * Estate **n** is calibrated to ~700 restaurants (fiction; order-of-magnitude PL).
 * Used by pl_passb.ts and pl_dual_passb.ts — keep in sync.
 */

/** Total store rows (archetypes + long tail). */
export const PL_TOTAL_STORES = 700;

/** Long-tail store count after named archetypes (~6% of n). */
export const PL_LONGTAIL_TARGET = 42;

/** Distinct long-tail membership tuples (menu mutation diversity). */
export const PL_VARIANT_COUNT = 30;

/** Labels that may appear on at least one store (mutation pool for long tail). */
export const LIVE_MENU_SETS = [
  "Jadlospis_Glowny_PL",
  "Sniadanie_Standard",
  "McCafe_Pelny",
  "DriveThru_Rozszerzenia",
  "Nocna_Ofera",
  "Menu_WG_Dworca",
  "Menu_Dworzec_Kompakt",
  "McDelivery_Integracja",
  "Kiosk_Pelny",
  "Kanapki_Sniadaniowe_DL",
  "Lokalne_Sezone_PL",
  "Zestawy_Dzienne_PL",
  "Regionalne_Addony",
  "Mall_Ograniczone_Menu",
  "Strefa_Stolowa",
  "Kawa_na_Wynos_PL",
  "Menu_Dzieciece_PL",
  "Sok_i_Shake",
  "Promo_Aplikacja_McSmart",
  "Lojalnosc_Kampania",
  "Drive_Drugie_Okno",
  "Wege_Rozszerzone",
  "Test_Lody_2026",
  "Festiwal_Burgerow_Q2",
  "Menu_Ramadanowe_PL",
  "McCafe_Seasonal_PL",
  "Breakfast_AllDay_PL",
  "Party_Box_PL",
] as const;

/**
 * Test / lab menu-set names present in catalog data but never assigned to a
 * store row — exercises Top-N and legend when k_in_catalog >> k_live.
 */
export const CATALOG_MENU_SETS_NOT_LIVE: readonly string[] = (() => {
  const out: string[] = [];
  for (let i = 1; i <= 52; i++) {
    const n = String(i).padStart(3, "0");
    out.push(`TEST_PL_CatalogOnly_Menu_${n}`);
  }
  for (let i = 1; i <= 18; i++) {
    out.push(`LAB_PL_Unassigned_Surface_${String(i).padStart(2, "0")}`);
  }
  return out;
})();

export interface PlMenuArchetype {
  readonly name: string;
  readonly count: number;
  readonly menu_sets: readonly string[];
}

/** Six cohorts (counts sum to PL_TOTAL_STORES − PL_LONGTAIL_TARGET); ~12–13 live menu-sets each. */
export const PL_MENU_ARCHETYPES: readonly PlMenuArchetype[] = [
  {
    name: "Autostrada_pelna",
    count: 167,
    menu_sets: [
      "Jadlospis_Glowny_PL",
      "Sniadanie_Standard",
      "McCafe_Pelny",
      "DriveThru_Rozszerzenia",
      "Nocna_Ofera",
      "Menu_WG_Dworca",
      "McDelivery_Integracja",
      "Drive_Drugie_Okno",
      "Kiosk_Pelny",
      "Kanapki_Sniadaniowe_DL",
      "Zestawy_Dzienne_PL",
      "Lokalne_Sezone_PL",
      "Regionalne_Addony",
    ],
  },
  {
    name: "Dworzec_kompakt",
    count: 140,
    menu_sets: [
      "Jadlospis_Glowny_PL",
      "Sniadanie_Standard",
      "McCafe_Pelny",
      "Menu_Dworzec_Kompakt",
      "Kiosk_Pelny",
      "Zestawy_Dzienne_PL",
      "Nocna_Ofera",
      "DriveThru_Rozszerzenia",
      "Menu_WG_Dworca",
      "McDelivery_Integracja",
      "Sok_i_Shake",
      "Menu_Dzieciece_PL",
    ],
  },
  {
    name: "Miasto_bez_McCafe",
    count: 122,
    menu_sets: [
      "Jadlospis_Glowny_PL",
      "Sniadanie_Standard",
      "DriveThru_Rozszerzenia",
      "Nocna_Ofera",
      "Lokalne_Sezone_PL",
      "Zestawy_Dzienne_PL",
      "Regionalne_Addony",
      "Kiosk_Pelny",
      "Kanapki_Sniadaniowe_DL",
      "Mall_Ograniczone_Menu",
      "Wege_Rozszerzone",
      "Promo_Aplikacja_McSmart",
    ],
  },
  {
    name: "Galeria_limit",
    count: 83,
    menu_sets: [
      "Jadlospis_Glowny_PL",
      "Sniadanie_Standard",
      "Mall_Ograniczone_Menu",
      "Strefa_Stolowa",
      "Kawa_na_Wynos_PL",
      "Menu_Dzieciece_PL",
      "Sok_i_Shake",
      "McCafe_Pelny",
      "Zestawy_Dzienne_PL",
      "Nocna_Ofera",
      "DriveThru_Rozszerzenia",
      "Kiosk_Pelny",
      "Wege_Rozszerzone",
    ],
  },
  {
    name: "Aplikacja_lojalnosc",
    count: 66,
    menu_sets: [
      "Jadlospis_Glowny_PL",
      "Sniadanie_Standard",
      "McCafe_Pelny",
      "Promo_Aplikacja_McSmart",
      "Lojalnosc_Kampania",
      "McDelivery_Integracja",
      "DriveThru_Rozszerzenia",
      "Kiosk_Pelny",
      "Nocna_Ofera",
      "Kanapki_Sniadaniowe_DL",
      "Festiwal_Burgerow_Q2",
      "Test_Lody_2026",
    ],
  },
  {
    name: "Lokal_testy_sezon",
    count: 80,
    menu_sets: [
      "Jadlospis_Glowny_PL",
      "Sniadanie_Standard",
      "McCafe_Pelny",
      "Lokalne_Sezone_PL",
      "Wege_Rozszerzone",
      "Test_Lody_2026",
      "Festiwal_Burgerow_Q2",
      "Menu_Ramadanowe_PL",
      "McCafe_Seasonal_PL",
      "Breakfast_AllDay_PL",
      "Party_Box_PL",
      "Zestawy_Dzienne_PL",
      "Drive_Drugie_Okno",
    ],
  },
];
