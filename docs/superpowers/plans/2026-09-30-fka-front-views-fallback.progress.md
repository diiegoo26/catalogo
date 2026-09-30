# 2026-09-30 FKA Front Views Fallback — Progress

## Task 0 — dependencies
- date: 2026-09-30
- sharp version: 0.35.5
- chromium installed: yes
- FKA home via Playwright: 403 / body 5410 bytes

## Task 1 — phase 0 verdict
- date: 2026-09-30
- WAF defeated: no. Playwright Chromium 403 on all three clubs (granada, cerezo-osaka, boca-juniors), body 5410 bytes each; headed A/B also 403. robots.txt via default-UA curl = 200 (IP not blanket-blocked); browser UA (curl or Playwright) = 403 on robots.txt too.
- CF signature: status 403, title "Attention Required! | Cloudflare", h1 "Sorry, you have been blocked", server: cloudflare, cf-ray a431a1f3a93c0144-MAD (headless) / a431a20dffb9ac8c-MAD (headed), no Error 10xx, no JS challenge. Hard WAF block, not a solvable challenge.
- 2026-27 present: not evaluable (no DOM retrievable from any club).
- frontal quality: not evaluable (no image URLs reachable).
- actual club URL shape: UNCONFIRMED — brief's /es/<slug>-kits/ is a Wikidata guess, never validated against live HTML.
- season-block selector: n/a (no DOM).
- image attribute: n/a (no DOM).
- fixtures: no content fixtures; evidence only at fixtures/fka/_robots.txt.html, _granada-headless-403.html, _granada-headed.html.
- GO / NO-GO: NO-GO. Plan stops here; do not build Tasks 2-7. Recommend owner-supplied images.
