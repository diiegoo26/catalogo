# Task 6 — Plantillas 2026-27: Reporte

## Fix round 1 (Critical)

**Issue:** Three real players were seeded at two clubs each (authenticity defect). Fix applied to seed file and live DB.

**Rows removed (wrong club):**
- `('1e9012fb-8174-4f61-a795-208749232dd2', 'Jack Grealish', 18)` — Man City (Grealish is on loan at Everton)
- `('f7e47f31-aea1-4f78-837e-b27f8f9bfc86', 'Liam Delap', 12)` — Chelsea (Delap sold to Nottingham Forest)
- `('00c63d7c-3c65-419b-b6d2-2eab16da91e5', 'Ethan Pinnock', 5)` — Brentford (Pinnock sold to Coventry City)

**Rows kept (correct club):**
- Everton #10 — Jack Grealish
- Nottingham Forest #19 — Liam Delap
- Coventry City #2 — Ethan Pinnock

**Files changed:**
- `supabase/seed-plantillas-2026-27.sql` (3 wrong-club lines removed)
- DB: 3 rows deleted via SQL (by team UUID + name + number)

**Corrected total:** 445 players.

**Note:** The earlier "total 446 vs 448" discrepancy flagged by the reviewer was itself incorrect — the DB held 448 before this fix.

**Verification (Premier League):**
- players = 445
- distinct_numbers = 445
- bad_numbers = 0

**Spot-check:** Grealish → Everton #10; Delap → Nottingham Forest #19; Pinnock → Coventry City #2. Each player now appears in exactly one club.