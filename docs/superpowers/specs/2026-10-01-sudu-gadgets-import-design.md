# SUDU-Gadgets 2026-9 Catalog Import — Design

**Date:** 2026-10-01
**Source:** `C:\Users\corra\Desktop\sudu-gadgets 2026-9.xlsx` (supplier: SUDU-Gadgets, Weidian)
**Status:** Approved, pending implementation plan

## Goal

Import the supplier catalog into the KOVA ZONE database: create the products that do not yet
exist, and refresh the imagery of the ones that do. Prices are explicitly out of scope for this
pass.

## Source workbook

Two sheets, `Main speadsheet` and `HOT SALE`.

| Column | Content |
|---|---|
| A | Model name (often multi-line) |
| B / C / D | Unit price CNY / USD / EUR — **ignored this pass** |
| E | "Picture" — empty as cell values; photos are embedded drawing objects |
| F | Weidian product URL |

`Main speadsheet` holds **394 product rows** across 14 sections. `HOT SALE` holds 37 rows that are
a **promotional subset** of the main sheet — the same Weidian `itemID` values, so it introduces no
new products. It is used only to flag which products are featured.

A **section header** is any row with text in column A but no Weidian URL in column F. That
heuristic yields the `row → category` ranges without guessing:

Earbuds (r6) · Watches (r49) · Speakers (r59) · Mobile phones (r76) · Hair tools (r85) ·
Other accsessories (r104) · Perfumes (r131) · T-shirts (r153) · Hoodies & Sweater & Jacket (r198) ·
Pants (r286) · Jersey (r313) · Coats (r332) · Bags and accessioes (r345) · Shoes (r366)

### Imagery

381 distinct photos live in `xl/media/`, anchored as floating objects across
`xl/drawings/drawing1.xml` (main) and `drawing2.xml` (HOT SALE). The anchor's `from` row gives the
owning product row. The anchor column is negative (images float left of column A), which does not
affect row mapping. 384 anchors cover 368 product rows; 6 products carry two images.

26 product rows have no embedded image. One row (r365) has prices and a URL but **no model name**;
it is not imported and is reported instead.

## Decisions

| Decision | Choice |
|---|---|
| Duplicate handling | Replace imagery only; never touch an existing product's title, slug or brand |
| Image hosting | Extract to `public/productos/sudu/<slug>.webp`, served like the existing 934 assets |
| Names | Normalize to storefront quality and attach the detected brand |
| New categories | Create `Móviles` only; hair tools fold into `Cuidado personal` |
| HOT SALE | Sets `is_featured = true` on the corresponding products |

Out of scope: prices, variants, stock, and any product not present in the workbook.

## Architecture

Three phases with a **human gate** between extraction and database writes.

```
Phase 1  Extract (Python, offline)  ──> manifest.json + report.md + *.webp
             │  no database access
             ▼
         ── HUMAN REVIEW GATE ──
             ▼
Phase 2  Apply (SQL via Supabase)   ──> inserts + image-only updates
             ▼
Phase 3  Verify (SQL + web spot-check)
```

The gate is the point of the design: 394 rows land in a 2,180-row catalog, and the extraction
rules are the part most likely to need correction. Re-running the extractor is cheap and
side-effect free; re-running a direct database write is not.

### Phase 1 — Extraction

Python 3.13 + openpyxl, plus the standard library `zipfile`/`ElementTree` for the drawing XML.
Images convert to WebP with `sharp` (already a devDependency).

1. **Structure** — read both sheets, classify each row as section header or product.
2. **Imagery** — resolve each drawing anchor to its media file and its owning row.
3. **Normalization** — collapse embedded newlines, strip zero-width characters (`\u200b` appears in
   `‌Dolce & Gabbana`), collapse runs of whitespace.
4. **Brand spellings** — apply a fixed dictionary of supplier misspellings:

   `Airpods`→`AirPods` · `Boes`→`Bose` · `Mashall`/`Marshalll`→`Marshall` · `Snoy`→`Sony` ·
   `Luluemon`→`lululemon` · `Coetiz`→`Corteiz` · `Galleyr Dept`→`Gallery Dept` ·
   `Philp`→`Philips` · `BEFFON`→`Boffon` · `Superme`→`Supreme` · `Palkech`→`Palace`

5. **Brand detection** — take the leading token, resolve it against the 114 existing brands by
   normalized name; create a brand only when genuinely absent.
6. **Category mapping** — section → `categories.slug` per the table below.
7. **Emission** — one manifest record per product, and one `.webp` per image.

### Phase 2 — Matching (three tiers)

Both sides normalize to lowercase, accent-stripped, punctuation-free text.

| Tier | Criterion | Action |
|---|---|---|
| **Safe** | Normalized titles are identical | Replace `images`, apply `is_featured` |
| **Probable** | Rules below all hold, and exactly one candidate qualifies | Replace `images`, apply `is_featured`, list in report |
| **Unmatched** | Anything else | **No write.** List in report |

A **probable** match requires all of:

1. The existing title contains at least one distinctive model token — length ≥ 4 characters,
   not a brand name, not a generic term from a stop list (`pro`, `max`, `gen`, `edition`,
   `quality`, `version`, `serie`, `collection`, `type`, `plus`, `mini`, `ultra`, `new`).
   `HD08`, `charge6`, `BOOMBOX3` qualify; `01` and `Pro` do not.
2. That token also appears in the workbook name after normalization.
3. Both brands resolve to the same brand, or the workbook side has no detectable brand.
4. **Exactly one** existing product satisfies 1–3. Two or more candidates ⇒ unmatched, never a
   coin flip.

The unmatched tier exists because the existing catalog contains placeholder titles — `Nike 01`…
`Nike 20`, `Balenciaga 01`…`04` — that identify no model. Those hold no distinctive token, so rule 1
excludes them automatically and rule 4 catches the rest. Matching *Nike NOCTA Hot Step 2* against
*Nike 03* is a guess, and a wrong guess puts one shoe's photo on another product. Leaving ~40
products untouched for human review is the correct trade.

> **Scope note.** Applying `is_featured` to a matched product widens the "imagery only" rule by one
> boolean. The owner chose to mark HOT SALE products as featured, and `is_featured` is a display
> flag rather than catalog data, so it is applied. Title, slug, brand, category and description of
> an existing product are never modified.

### Category mapping

| Workbook section | Target category |
|---|---|
| Earbuds | Auriculares |
| Watches | Relojes |
| Speakers | Altavoces |
| Perfumes | Perfumes |
| T-shirts, Hoodies & Sweater & Jacket, Pants, Coats | Streetwear |
| Jersey | Equipaciones |
| Bags and accessioes | Bolsos when the item is a bag, otherwise Accesorios |
| Shoes | Sneakers |
| Hair tools | Cuidado personal |
| Other accsessories | Accesorios |
| Mobile phones | **Móviles** (new) |

`Other accsessories` is a mixed bag — vacuums, toothbrushes, microphones, controllers, chargers,
sunglasses, belts. All land in Accesorios; no finer split is attempted.

The `Bags and accessioes` split is a keyword test on the normalized workbook name. If it contains
any of `bag`, `backpack`, `shoulder`, `tote`, `crossbody`, `duffle`, `satchel`, `travel bag` it
becomes Bolsos; otherwise Accesorios. So `LV black crossbody shoulder bag` → Bolsos, while
`Stussy Wallet`, `Carhartt belt`, `RayBan sunglasses` and `Stussy baseball cap` → Accesorios.

### Phase 3 — Apply

Order: create `Móviles` if absent → create missing brands → write products.

**New products** — `title` (normalized), `slug` (suffixed `-2`, `-3`… on collision, since `slug` is
unique), `description = NULL`, `images`, `category_id`, `brand_id`, `is_featured` per HOT SALE.

`description` stays `NULL` on purpose. An earlier import wrote "Producto importado desde
https://…" into 288 descriptions and it later had to be hidden from the storefront.

`gender` and `season` are also left `NULL`. The workbook carries neither, and inferring a value
would be invention.

**Matched products** — `UPDATE products SET images = …, is_featured = … WHERE id = …`. Nothing else
changes.

**Products without a photo** — created with `images = []` and listed in the report.

### Idempotency

Matching *is* the idempotency mechanism. On a second run every product created by the first run
now exists and matches at the safe tier, so the run re-writes identical imagery and inserts nothing.
There is no `weidian_id` column and none is added, so re-running the extractor against a changed
workbook relies on this same title match rather than a source identifier.

## Review report

Emitted before any database write:

- Totals: new, safe-matched, probable-matched, unmatched, without image.
- **Every unmatched product**, with the Excel name and the existing candidates considered — so the
  owner can rule on `Nike NOCTA Hot Step 2` ↔ `Nike 07` directly.
- Every probable match, so it can be reverted.
- Final rendered titles of new products.
- Brands and categories that would be created.

## Verification

After applying:

- Row counts per category; the 13 pre-existing categories must keep their prior product counts
  except for image-only updates.
- No duplicate slugs.
- Every matched product has at least one image.
- Visual spot-check of 4–5 product pages in the running app.

## Risks

| Risk | Mitigation |
|---|---|
| Placeholder titles defeat matching | Unmatched tier never writes; surfaced for a human ruling |
| Duplicate Weidian URLs (`Philp`/`Philp S9000` → `7734212969`; `Eu 20w adapter` twice; one `itemID` shared by a Nike and a Gucci) | Treat each workbook row as its own product; do not collapse on `itemID` |
| ~8 MB of new assets in the deployment bundle | Accepted; matches the existing `public/productos/alice/` pattern |
| Supplier naming is machine-translated and often ungrammatical | Normalization fixes spelling only; semantics stay as supplied |
| Repo grows by ~380 files | Image files are binary and unrelated to code review |