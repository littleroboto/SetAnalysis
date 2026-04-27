# Input YAML schema

The workbench accepts a single YAML document. Every figure rendered must carry
its `meta` block in the caption strip, so the schema is stricter than it looks
&mdash; missing fields produce a parse-error banner rather than a silent default.

This is the canonical reference. The same shape is defined in
[`src/types.ts`](../src/types.ts) and validated by
[`src/parse.ts`](../src/parse.ts).

```yaml
meta:
  market: UK                                       # ISO-2 market code (string, required)
  snapshot: "2026-04-23"                           # date the source was extracted (string, required)
  dimension: menu_sets                             # one of: menu_sets | features | parameters | dual
  source: data/estate/uk_pass_b_synthetic.tsv     # provenance string, surfaced in caption (required)
  evidence: input_config                           # one of: output_only | input_config | inferred | SME_confirmed
  notes: "synthetic - see analysis/PROMPT-build-upset-workbench.md sec.7"

elements:                                          # one entry per store; non-empty
  - id: "8260654"                                  # store id (string or number, coerced to string; unique)
    sets:                                          # memberships for meta.dimension: menu-sets, feature flags, or active parameter names
      - "A - Grill Direct"
      - "Breakfast - Standard"
      - "McCafe - Full"
    attrs:                                         # OPTIONAL secondary numeric/string attrs (Phase 3+ heatmap)
      feature_count: 142
  - id: "8260655"
    sets: ["A - Grill Direct", "Breakfast - Standard"]
```

### Dual mode (two UpSet panels)

When `meta.dimension` is **`dual`**, each element carries **`menu_sets`** and
**`parameters`** instead of `sets`. The workbench renders **two** charts **one above the other** (same
trim/sort controls apply to both). Use bundled samples
`synthetic-*-dual-passb.yaml` per market.

```yaml
meta:
  market: UK
  snapshot: "2026-04-24"
  dimension: dual
  source: viz/upset-tool/src/samples/synthetic-uk-dual-passb.yaml
  evidence: input_config

elements:
  - id: "8260000"
    menu_sets:
      - Core_Menu
      - Breakfast
    parameters:
      - SYS_POS_UK_Base
      - SYS_Kitchen_Display_STD
```

| Field (dual) | Rule |
|--------------|------|
| `elements[i].menu_sets` | required array (may be empty); same normalisation as `sets` |
| `elements[i].parameters` | required array (may be empty) |
| `elements[i].sets` | must **not** appear (use `dual` + the two keys above) |

Single-dimension files must **not** mix `menu_sets` / `parameters` on elements;
use `dimension: dual` for that shape.

### Optional: catalog-only menu sets (PL samples)

Some PL fiction files include a top-level sibling array
`catalog_menu_sets_unassigned` listing menu-set names that exist in catalog/test
data but are **not** present on any `elements[].sets` (or `menu_sets`) row. The
workbench parser **ignores** this key for plotting (UpSet only reflects store
memberships); it is there for provenance and downstream extracts. See
`meta.notes` on those samples.

## Validation rules

| Field | Rule |
|-------|------|
| `meta.market` | required, non-blank string |
| `meta.snapshot` | required, non-blank string (date format is convention, not enforced) |
| `meta.dimension` | required; must be `menu_sets`, `features`, `parameters`, or `dual` |
| `meta.source` | required, non-blank string &mdash; surfaced verbatim in the caption strip |
| `meta.evidence` | required; must be `output_only`, `input_config`, `inferred`, or `SME_confirmed` |
| `meta.notes` | optional, free-form string |
| `elements` | required, non-empty list |
| `elements[i].id` | required (string or number); coerced to string; must be unique across all elements |
| `elements[i].sets` | required for non-dual dimensions: same rules as below (dual rows use `menu_sets` + `parameters` instead) |
| `elements[i].menu_sets` / `elements[i].parameters` | required when `meta.dimension` is `dual`; same trimming/deduping as `sets` |
| `elements[i].attrs` | optional mapping of `string -> number \| string`; non-string/number values are coerced to string |

## Conventions

- **`parameters` dimension:** each string in `sets` is an active parameter or
  feature-flag name for that store (opaque to the renderer). Samples use
  prefixes such as `SYS_` vs `CUST_` so analysts can eyeball system-scoped vs
  custom/pilot density; reconcile naming upstream for real extracts.
- **Set names** are matched as opaque strings &mdash; case-sensitive after
  whitespace trimming. Markets that surface different casings for "the same"
  set count as distinct sets here; reconcile upstream if that is wrong for
  your reading.
- **Empty `sets: []`** is a valid combination ("the no-set bucket"). It is
  hidden by default (the **Hide "no sets" intersection** toggle); turn the
  toggle off when the bucket is part of the analytical claim.
- **`meta.source`** should be a path inside the repo when the YAML was
  produced from a checked-in extract, so the caption traces back to the
  generator and keeps the workbench rule on full-data discipline.
