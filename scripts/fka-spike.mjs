// Phase 0: proves whether FKA is reachable by a real browser and whether the
// three sampled clubs expose 2026-27 kits. Read-only: writes fixtures, never the DB.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CLUBS = ['granada', 'cerezo-osaka', 'boca-juniors'];
const BASE = 'https://www.footballkitarchive.com';

mkdirSync('fixtures/fka', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'es-ES', userAgent: UA });

for (const slug of CLUBS) {
  const page = await ctx.newPage();
  // The club-history URL shape is confirmed against the live DOM in Step 2.
  const url = `${BASE}/es/${slug}-kits/`;
  let status = null;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = res?.status() ?? null;
  } catch (err) {
    console.log(`${slug}: navigation error ${err.message}`);
  }
  const html = await page.content();
  console.log(`${slug}: status=${status} bytes=${html.length} url=${url}`);
  if (status === 200 && html.length > 5000) {
    writeFileSync(`fixtures/fka/${slug}.html`, html);
  }
  await page.close();
  await new Promise((r) => setTimeout(r, 2000));
}

await browser.close();
