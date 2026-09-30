# Design - FKA front views for the 58 teams without FootyLogos

## Problem

### Current state

The 2026-27 `equipaciones` catalog holds 279 products across 175 teams. Two independent
image states now coexist:

| Scope | Products | Teams | Images per product |
| --- | --- | --- | --- |
| Covered by FootyLogos | 190 | 117 | 1-5 front views (one per variant) |
| No FootyLogos page | 69 | 58 | 20-40 Wix gallery photos |
| No team assigned | 20 | — | 20-40 Wix gallery photos |

The 190 FootyLogos products satisfy the catalog rule "one front view per kit variant".
The 69 products of the 58 uncovered teams still show full Wix galleries. The catalog
therefore presents **two different visual standards** to customers.

### Why the gap exists

`scripts/gen-equipaciones-frentes.mjs` established that 58 of the 175 teams have no
FootyLogos page at all - mostly second divisions (LaLiga Hypermotion, J1 League,
EFL Championship, Scottish Premiership) plus South American clubs. The teams are:

- **Spain (12)**: granada, cadiz, zaragoza, albacete, cordoba, valladolid, las-palmas,
  almeria, sporting-gijon, leganes, burgos, cultural-leonesa
- **Japan (12)**: sanfrecce-hiroshima, kashima-antlers, fc-tokyo, avispa-fukuoka,
  yokohama-f-marinos, vissel-kobe, kyoto-sanga, nagoya-grampus, kawasaki-frontale,
  kashiwa-reysol, cerezo-osaka, gamba-osaka
- **Argentina (7)**: river-plate, argentinos-juniors, velez-sarsfield,
  racing-avellaneda, boca-juniors, newells-old-boys, estudiantes-lp
- **England (3)**: leicester-city, doncaster-rovers, bradford-city
- **Scotland (3)**: rangers-fc, dundee-united, heart-of-midlothian
- **Germany (3)**: fc-nurnberg, hannover-96, fortuna-dusseldorf
- **Chile (3)**: universidad-catolica, universidad-de-chile, colo-colo
- **Colombia (3)**: america-de-cali, millonarios, atletico-nacional
- **Brazil (2)**: sport-recife, nautico
- **Uruguay (2)**: penarol, nacional
- **Paraguay (2)**: olimpia, cerro-porteno
- **Portugal (1)**: sporting-braga
- **Italy (1)**: palermo
- **France (1)**: saint-etienne
- **Greece (1)**: panathinaikos
- **Serbia (1)**: red-star-belgrade
- **Norway (1)**: rosenborg

Wrexham is a separate case: it has a FootyLogos page but publishes no `home` cover, so
it already ships 2 of 3 variants.

### Proposed source and its constraints

footballkitarchive.com (FKA) documents these clubs. Established by test, not assumption:

- `robots.txt` returns 200 and disallows only `/account` and `/admin` paths. Crawling
  club pages is permitted by the site's own rules.
- Every other path returns **403** from this environment - HTML pages, all locales,
  all schemes, and even static `.png` assets. The block is a WAF/bot gate, not a
  path-level prohibition.
- The site requires submission without watermarks "so that the pictures can be used
  for your own projects". This is a contribution philosophy, **not a commercial
  licence**. Recorded as a decision for the catalogue owner, not resolved here.
- FKA operates a paid Plus tier that unlocks "additional kit images". Paywalled images
  must never be scraped.

### Decisions (user-confirmed)

| Question | Decision |
| --- | --- |
| Source | footballkitarchive.com |
| Extraction | Playwright for everything, gated by a phase 0 spike |
| Image hosting | Hotlink FKA URLs (no self-hosting) |
| Season | 2026-27 only; no fallback to earlier seasons |
| Existing Wix galleries | Replace with FKA front views |
| Non-frontal images | Verify and discard |

## Design

### 1. Pipeline shape

Mirrors the FootyLogos pipeline so there is one mental model to maintain:
**crawl -> JSON -> build SQL -> snapshot -> apply -> verify**.

```
scripts/fka-spike.mjs                 phase 0: 2-3 teams end-to-end, no DB writes
scripts/gen-equipaciones-fka.mjs      Playwright crawler
scripts/build-fka-sql.mjs             SQL + report builder
scripts/fka-map.json                  our team slug -> FKA club path
supabase/equipaciones-2026-27-fka.json           crawl output (source of truth)
supabase/equipaciones-2026-27-fka.sql            idempotent updates
supabase/equipaciones-2026-27-fka-sin-frente.md  human report
supabase/equipaciones-2026-27-fka-rollback.json  pre-change snapshot
```

Reused from the existing pipeline: the idempotent `update ... set images = '[...]'::jsonb
where p.id = '...'` shape, ASCII-only SQL, `sharp`-based image inspection, and the
snapshot / value-diff / rollback discipline.

### 2. Phase 0 spike (go/no-go gate)

The riskiest assumptions must be tested before building anything. Phase 0 covers three
teams end-to-end - one per major block: `granada` (Spain), `cerezo-osaka` (Japan),
`boca-juniors` (Argentina).

It must answer exactly three questions:

1. **WAF** - does Playwright load a club page and return real DOM (HTTP 200), or the
   403 error page?
2. **Coverage** - does the club page expose a 2026-27 section with kits?
3. **Quality** - do the candidate images pass the frontal check?

A failure on (1) or (2) stops the project: report and build nothing further. Deliverable
is a short report. **No database writes.**

### 3. Browser session and rate policy

- One Chromium instance, launched once and reused across pages.
- Locale `es-ES` (the catalogue is Spanish), realistic desktop user agent.
- **Strictly sequential.** Never parallel page loads.
- Fixed delay of 1.5-3 s with jitter between page loads.
- Up to 3 retries with exponential backoff on 403/429.
- If 403 persists after retries, the run **stops** rather than hammering the site; the
  partial JSON makes the run resumable.

### 4. Club mapping

`scripts/fka-map.json` maps our 58 team slugs to their FKA club path. Slugs do not
match automatically (`zaragoza` -> `real-zaragoza`, `leganes` -> `leganes`), so the map
is derived once, reviewed, and versioned alongside `equipaciones-2026-27-map.json`.

A team with no FKA page is skipped and reported, exactly as the FootyLogos crawler
reports absent teams. Skipped teams **keep their current images**; an empty array is
never written.

### 5. Kit discovery and season

- **2026-27 only.** A club without a 2026-27 section is skipped and the reason recorded.
  No earlier season is substituted, because a 2025-26 shirt photo would misrepresent a
  product sold as 2026-27.
- Variants follow the existing catalogue logic: `home`, `away`, `third`, plus `fourth`
  and `anniversary` when FKA publishes them. Variant labels come from FKA's own kit
  metadata.
- One front image per variant.

### 6. Frontal verification (the discard rule)

This is the least certain part of the design. The thresholds are **calibrated against
the real phase 0 images**, not invented up front.

Deterministic check via `sharp`, not visual inspection:

- trim uniform background, convert to greyscale, resize to a fixed working size;
- **horizontal symmetry score** - difference between the image and its mirrored half;
- **aspect ratio** inside a plausible shirt range;
- **foreground centroid** near horizontal centre;
- **foreground coverage ratio** to reject photos dominated by a person or scene.

Each candidate stores its verdict and metrics in the JSON so the decision is auditable
and repeatable. A variant that fails is **dropped** - it is never replaced by a worse
image. Borderline images are marked for human review and **never auto-applied**.

An image is downloaded **only to verify it**. Per the hotlink decision, the value
written to the database is the remote FKA URL, never a local path.

### 7. Output, application and rollback

- JSON entry per team: `{ name, fka_url, season, variants: [{ variant, url, verdict,
  metrics }], missing[] }`.
- SQL: one idempotent `UPDATE` per product, same shape as
  `equipaciones-2026-27-frentes.sql`, ASCII-only, single `begin;`/`commit;`.
- Report: skipped teams, dropped variants, partial-coverage teams.
- The affected set is the 69 products of the 58 uncovered teams, **minus** any team FKA
  cannot supply for 2026-27. The remaining count is only known after the crawl.
- Snapshot the affected products to `...-fka-rollback.json` **before** any write.
- Apply through admin SQL in verifiable slices, then **read the rows back and compare
  them to the JSON**. Never trust an exit code or an error-free batch: a mistyped UUID
  matches zero rows and fails silently inside a committed transaction.
- Rollback = re-apply the snapshot.

### 8. Environment constraints

- `playwright` is added as a devDependency; `npx playwright install chromium` downloads
  roughly 300 MB on first use.
- This directory is **not a git repository**. The design doc and generated artifacts
  live in the working tree and cannot be committed. Recorded here so a future session
  does not assume version control exists.

## Out of scope

- The 20 products with `team_id = null` - without a team, FKA cannot resolve them.
- Any season other than 2026-27.
- Self-hosting or mirroring images.
- Any legal or licensing determination about reusing third-party kit photos. This is
  flagged as a business decision for the catalogue owner.
- Modifying the 190 products already updated from FootyLogos.

## Verification

- Phase 0 report answers questions (1)-(3) with go/no-go.
- JSON vs live DB: **0 differences** across every touched product.
- Untouched products: **0 drift** against the pre-change snapshot.
- 0 empty arrays; 0 non-frontal images applied; 0 paywalled images referenced.
