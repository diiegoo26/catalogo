// Phase 0 diagnostics for the FKA go/no-go gate. Read-only probe, sequential,
// never writes to the database. Produces evidence for:
//   1. IP-block vs bot-policy (robots.txt vs a content path, same context)
//   2. The exact Cloudflare signature on the 403 body
//   3. Headless vs headed A/B on a single club page
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://www.footballkitarchive.com';
const CLUB = 'granada';
const CLUB_URL = `${BASE}/es/${CLUB}-kits/`;

mkdirSync('fixtures/fka', { recursive: true });

function extractSignature(html, headers) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? null;
  const errCode = html.match(/Error\s*([0-9]{3,4})/i)?.[1] ?? null;
  const rayFromBody = html.match(/Ray ID:\s*<\/?[^>]*>?\s*([a-f0-9]{16})/i)?.[1] ?? null;
  return {
    title,
    h1,
    errCode,
    rayIdBody: rayFromBody,
    cfRay: headers['cf-ray'] ?? null,
    cfMitigated: headers['cf-mitigated'] ?? null,
    server: headers['server'] ?? null,
    status: headers[':status'] ?? null,
  };
}

function dumpHeaders(res) {
  try { return res?.headers() ?? {}; } catch { return {}; }
}

// --- Diagnostic 1 + 2: same browser context, robots.txt vs content path ---
console.log('=== DIAGNOSTIC 1+2: robots.txt vs content path (headless, same context) ===');
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'es-ES', userAgent: UA });

// D1a: robots.txt
{
  const page = await ctx.newPage();
  let status = null;
  let headers = {};
  try {
    const res = await page.goto(`${BASE}/robots.txt`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = res?.status() ?? null;
    headers = dumpHeaders(res);
  } catch (err) {
    console.log(`robots.txt: navigation error ${err.message}`);
  }
  const body = await page.content();
  console.log(`robots.txt: status=${status} bytes=${body.length}`);
  writeFileSync('fixtures/fka/_robots.txt.html', body);
  await page.close();
  await new Promise((r) => setTimeout(r, 2000));
  void headers;
}

// D1b + D2: club content path, headless
let headlessClub = { status: null, bytes: null, sig: null };
{
  const page = await ctx.newPage();
  let headers = {};
  try {
    const res = await page.goto(CLUB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    headlessClub.status = res?.status() ?? null;
    headers = dumpHeaders(res);
  } catch (err) {
    console.log(`${CLUB} headless: navigation error ${err.message}`);
  }
  const body = await page.content();
  headlessClub.bytes = body.length;
  headlessClub.sig = extractSignature(body, headers);
  console.log(`${CLUB} headless: status=${headlessClub.status} bytes=${body.length}`);
  console.log(`  signature: ${JSON.stringify(headlessClub.sig)}`);
  writeFileSync('fixtures/fka/_granada-headless-403.html', body);
  await page.close();
}

await browser.close();

// --- Diagnostic 3: headed A/B on the same club page ---
console.log('\n=== DIAGNOSTIC 3: headed A/B ===');
const headedBrowser = await chromium.launch({ headless: false });
const headedCtx = await headedBrowser.newContext({ locale: 'es-ES', userAgent: UA });
let headedClub = { status: null, bytes: null, sig: null };
{
  const page = await headedCtx.newPage();
  let headers = {};
  try {
    const res = await page.goto(CLUB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    headedClub.status = res?.status() ?? null;
    headers = dumpHeaders(res);
  } catch (err) {
    console.log(`${CLUB} headed: navigation error ${err.message}`);
  }
  const body = await page.content();
  headedClub.bytes = body.length;
  headedClub.sig = extractSignature(body, headers);
  console.log(`${CLUB} headed: status=${headedClub.status} bytes=${body.length}`);
  console.log(`  signature: ${JSON.stringify(headedClub.sig)}`);
  writeFileSync('fixtures/fka/_granada-headed.html', body);
  await page.close();
}
await headedBrowser.close();

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify({
  robots: 'see above',
  headlessClub,
  headedClub,
}, null, 2));
