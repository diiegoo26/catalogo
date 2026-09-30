// Probes every www.footylogos.com url in the merged plan (liveness + dimensions).
// Run: node scripts/probe-www-urls.mjs
import { readFileSync } from 'node:fs';

const plan = JSON.parse(readFileSync('supabase/equipaciones-2026-27-plan.json', 'utf8'));
const urls = [...new Set(Object.values(plan).flatMap((v) => v.urls).filter((u) => u.includes('www.footylogos.com')))];
console.log(`www urls to probe: ${urls.length}`);

async function probe(u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.status !== 200) return `${r.status} ${u}`;
    const buf = new Uint8Array(await r.arrayBuffer());
    let dims = '?';
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      const dv = new DataView(buf.buffer);
      dims = `${dv.getUint32(16)}x${dv.getUint32(20)}`;
    } else if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1];
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(mk)) {
          dims = `${(buf[i + 7] << 8) | buf[i + 8]}x${(buf[i + 5] << 8) | buf[i + 6]}`;
          break;
        }
        if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
        i += 2 + ((buf[i + 2] << 8) | buf[i + 3]);
      }
    } else if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
      dims = `webp(${buf.length}b)`;
    }
    return { u, dims, bytes: buf.length };
  } catch (e) {
    return `ERR ${e.message} ${u}`;
  }
}

const results = [];
for (let i = 0; i < urls.length; i += 12) {
  results.push(...await Promise.all(urls.slice(i, i + 12).map(probe)));
}
const bad = results.filter((r) => typeof r === 'string');
const good = results.filter((r) => typeof r !== 'string');
console.log(`HTTP 200: ${good.length}/${results.length}   failures: ${bad.length}`);
bad.slice(0, 15).forEach((b) => console.log('  ', b));
const dims = good.map((g) => g.dims);
console.log('sample dims:', dims.slice(0, 5));
const bytes = good.map((g) => g.bytes).sort((a, b) => a - b);
if (bytes.length) console.log(`bytes: min=${bytes[0]} median=${bytes[bytes.length >> 1]} max=${bytes[bytes.length - 1]}`);
