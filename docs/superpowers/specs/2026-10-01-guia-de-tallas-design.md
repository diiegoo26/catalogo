# Size Guide Page (`/guia-de-tallas`) — Design

**Date:** 2026-10-01
**Status:** Approved, pending implementation plan
**Storefront:** KOVA ZONE (Spanish, Next.js App Router)

## Goal

Add a `/guia-de-tallas` page that helps customers pick the right size before ordering, and link
to it from every place where a size is chosen. It reuses the existing content-page pattern already
established by `app/envios-devoluciones/page.tsx` (Breadcrumbs + PageHeading + icon sections).

Source content is the owner's first-person sizing tips plus three supplier measurement tables
(player cut, fan cut, kids). All copy is re-authored to second person, emoji-free, with no
shopping-agent terminology (`CNFANS`, `QC`). Project convention is SVG icons, never emoji.

## Decisions

| Decision | Choice |
|---|---|
| Placement | Dedicated page `/guia-de-tallas` + contextual link on product page + Footer link |
| Voice | Second person (`tú`), neutral register, no first person |
| Terminology | No `CNFANS` / `QC`; use "tabla de tallas del producto" and "fotos reales de otros compradores" |
| Numbered/📏 rules | Keep the practical "size up" rules; add a scannable summary table |
| Weight units | Converted from pounds to kg (kids table) |
| Content source | `lib/guia-tallas.ts` (single source for cards + summary table + measurement tables) |
| Shared layout | Extract `Seccion` + icon set into `components/SeccionInfo.tsx`, reused by envios-devoluciones |
| Product link | Inside `OpcionesPedido`, hidden when the product only offers the single size `Única` |

## Page content

Page metadata: `title: 'Guía de tallas'`, description about choosing the right size.

1. **Heading** — eyebrow `Antes de comprar`, title `Guía de tallas`, description
   "Cómo elegir tu talla sin fallar".
2. **Conoce tus medidas** — know your size across garment types; the reliable method is to measure
   clothes you already own (width, length, waist, shoulders) with a tape and note the numbers so
   they stay on hand.
3. **Cómo saber si una prenda te quedará bien**:
   - *Tabla de tallas del producto* — many listings include a measurement table further down;
     compare your numbers against it.
   - *Fotos reales de otros compradores* — real photos of the garment measured with a tape. Check
     the size in the photo and compare: if it (e.g. an L) is larger than your measurements, go a
     size down; if smaller, go a size up.
   - *Consejo* — when in doubt, one size **up** beats one size down.
4. **Recomendaciones por prenda** — cards driven by `RECOMENDACIONES`.
5. **Tablas de medidas de equipaciones** — the three tables below.
6. **Tabla resumen** — garment → one-line recommendation.
7. **Consejo final** — if still unsure, consult the brand's official guide and its fit (fitted /
   loose).

### Recomendaciones por prenda (card copy)

| Prenda | Resumen (summary table) | Detalle (card bullets) |
|---|---|---|
| Zapatillas y calzado | Tu talla habitual; si dudas, media talla o una más | Usa tu talla habitual. Si quieres ir sobre seguro, media talla o una talla más. |
| Camisetas | Slim o deportivas +1/+2 · Normales tu talla o +1 · Oversize tu talla · Fútbol (jugador) +1 | `Slim o deportivas: +1 o +2 tallas` · `Normales: tu talla o +1` · `Oversize: tu talla` · `Fútbol (versión jugador): +1 sí o sí` |
| Shorts y pantalones | Tu talla habitual; si son deportivos, +1 | Usa tu talla habitual. Si son deportivos, mejor una talla más. |
| Calzoncillos y bañadores | Vienen pequeños: pide +2 o +3 | Van pequeños: pide 2 o 3 tallas más. |
| Sudaderas y chaquetas | Tu talla o +1 | Tu talla o una talla más. |
| Abrigos | +1 o +2 (suelen venir ajustados) | Sube una o dos tallas: suelen venir ajustados. |

## Measurement tables (data)

All weights in kg (converted from the supplier's pounds). Length, chest and height in cm. The
supplier's `4XL` fan-cut weight (`200-220`) is an OCR/typo outlier, corrected to `100-120`.

**Versión jugador** (fitted cut)

| Talla | Largo | Pecho | Altura | Peso |
|---|---|---|---|---|
| S | 70 | 92 | 160-170 | 50-60 |
| M | 72 | 96 | 170-175 | 60-70 |
| L | 74 | 100 | 175-180 | 70-75 |
| XL | 76 | 104 | 180-185 | 75-80 |
| 2XL | 78 | 108 | 185-190 | 80-90 |

**Versión aficionado** (loose cut)

| Talla | Largo | Pecho | Altura | Peso |
|---|---|---|---|---|
| S | 70 | 100 | 160-170 | 50-60 |
| M | 72 | 104 | 165-175 | 60-70 |
| L | 74 | 108 | 175-185 | 70-80 |
| XL | 76 | 112 | 180-190 | 75-90 |
| 2XL | 78 | 116 | 185-200 | 80-100 |
| 3XL | 80 | 120 | 195-210 | 90-110 |
| 4XL | 82 | 126 | 200-210 | 100-120 |

**Talla infantil**

| Talla | Código | Edad | Largo | Altura | Peso |
|---|---|---|---|---|---|
| S | 16 | 2-3 años | 43 | 90-100 | < 14 |
| M | 18 | 3-4 años | 47 | 100-110 | 14-18 |
| L | 20 | 4-5 años | 50 | 110-120 | 18-23 |
| XL | 22 | 6-7 años | 53 | 120-130 | 23-27 |
| 2XL | 24 | 8-9 años | 56 | 130-140 | 27-32 |
| 3XL | 26 | 10-11 años | 58 | 140-150 | 32-36 |
| 4XL | 28 | 12-13 años | 61 | 150-160 | 36-41 |

## Architecture

```
lib/guia-tallas.ts
  ├── RECOMENDACIONES: Recomendacion[]   ──> cards (section 4) + summary table (section 6)
  └── TABLAS_TALLAS: TablaTallas[]       ──> three tables (section 5)

components/SeccionInfo.tsx               ──> Seccion + named SVG icons, shared
app/guia-de-tallas/page.tsx              ──> renders sections from the data above
components/OpcionesPedido.tsx            ──> adds contextual link
components/Footer.tsx                    ──> adds nav link
app/envios-devoluciones/page.tsx         ──> refactored to consume SeccionInfo
```

### `lib/guia-tallas.ts`

Pure data, no React import (so it stays unit-testable).

```ts
export type Recomendacion = {
  prenda: string;        // 'Camisetas'
  resumen: string;       // one-liner for the summary table
  detalle: string[];     // card bullets
  icono: string;         // key resolved to an icon in the page
};

export type TablaTallas = {
  titulo: string;        // 'Versión jugador'
  nota?: string;         // e.g. 'Corte ajustado'
  columnas: string[];    // ['Talla', 'Largo', 'Pecho', 'Altura', 'Peso']
  unidades?: string[];   // parallel to columnas, e.g. ['', 'cm', 'cm', 'cm', 'kg']
  filas: string[][];
};
```

### `components/SeccionInfo.tsx`

Extracts the `Seccion` helper and the icon primitives currently local to
`app/envios-devoluciones/page.tsx` (`IconoCamion`, `IconoCamiseta`, `IconoCruz`, `IconoInfo`) into
a shared module, and adds the icons the guide needs (shoes, trousers, shorts, jacket, coat,
measure tape). `envios-devoluciones` is updated to import them, removing the duplication. This is a
targeted refactor of code the work touches, not a broad reorganization.

### Entry points

- **Product page** — `OpcionesPedido` renders, under the size chips, a link
  "¿Dudas con tu talla? Consulta la guía de tallas" → `/guia-de-tallas`. It is hidden when the
  offered sizes are exactly `['Única']` (accessories, watches, perfumes, electronics), where a size
  guide is meaningless. This covers every product flow, since both `ProductPurchase` and
  `KitCustomizer` choose sizes through `OpcionesPedido`.
- **Footer** — add `<Link href="/guia-de-tallas">Guía de tallas</Link>` to the existing nav, next
  to "Envíos y devoluciones".

## Testing

- `tests/guia-tallas.test.ts` (Vitest, already configured):
  - every `RECOMENDACIONES` entry has non-empty `prenda`, `resumen`, `detalle` and a non-empty
    `icono`;
  - every `TABLAS_TALLAS` entry has rows whose length equals `columnas.length`;
  - no emoji characters appear in any authored string in `lib/guia-tallas.ts`.
- Manual verification: `npm run build` and `npm test`; open `/guia-de-tallas`, a product with
  clothing sizes (link visible), and a `Única` product (link hidden).

## Out of scope

- Per-product size charts read from the database — the tables are static page content this pass.
- Embedding a size-guide teaser or drawer inside the product page (the product gets a link, not a
  preview).
- Changing `lib/tallas.ts` size lists or `tallasParaProducto` behaviour.

## Risks

| Risk | Mitigation |
|---|---|
| Transcribed supplier numbers could be wrong for a real product | Tables were shown to the owner for validation during design; corrections are a one-line data edit |
| Extracted `Seccion` refactor touches a working page | Mechanical move; envios-devoluciones is verified by build + visual check, and its markup is unchanged |
| Link shown on products with no real size choice | Hidden whenever the offered sizes are exactly `['Única']` |
| Kids weights converted from pounds are non-round kg | Rounded to whole kg; presented as ranges, which is how customers read them |
| Content page drifts from the store's actual shipping/returns copy | The page is self-contained and linked from Footer, like envios-devoluciones |
