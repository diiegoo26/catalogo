// Diagnoses the Google Drive product images: upstream response vs Next optimizer response.
// Run: node scripts/diagnose-drive.mjs
const ids = [
  '1HbX4LYd11HtxdT-GkSLaGijVfYNnO2ju',
  '1RPrmb8CLsOYLAiq6BNhe_dUT2BUb3W_0',
  '1gFFIQBr7hGwUPwWc58PcXYV9Fa6x8qOy',
];
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

for (const id of ids) {
  const url = `https://lh3.googleusercontent.com/d/${id}`;
  try {
    const r = await fetch(url, { headers: UA, redirect: 'manual' });
    const buf = new Uint8Array(await r.arrayBuffer());
    console.log(`upstream ${r.status}  type=${r.headers.get('content-type')}  bytes=${buf.length}  loc=${(r.headers.get('location') ?? '-').slice(0, 70)}`);
  } catch (e) {
    console.log(`upstream ERR ${e.message}`);
  }
}

console.log('\n--- optimizer ---');
for (const port of ['3000', '3123']) {
  for (const id of ids.slice(0, 2)) {
    const src = `https://lh3.googleusercontent.com/d/${id}`;
    const u = `http://localhost:${port}/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`;
    try {
      const r = await fetch(u, { headers: UA });
      const body = await r.arrayBuffer();
      const head = Buffer.from(body).toString('utf8').slice(0, 120).replace(/\s+/g, ' ');
      console.log(`port ${port}: ${r.status}  type=${r.headers.get('content-type')}  bytes=${body.byteLength}  body="${head}"`);
    } catch (e) {
      console.log(`port ${port}: ERR ${e.message}`);
    }
  }
}
