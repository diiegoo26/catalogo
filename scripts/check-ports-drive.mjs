// Checks a Drive-based product page and its images across every local server port.
// Run: node scripts/check-ports-drive.mjs
const PORTS = ['3000', '3001', '3123', '3130'];
const SRC = 'https://lh3.googleusercontent.com/d/1HbX4LYd11HtxdT-GkSLaGijVfYNnO2ju';
const PAGES = ['/producto/lacosta-13', '/chandal', '/calzado/solea'];

for (const port of PORTS) {
  console.log(`\n=== port ${port} ===`);
  for (const p of PAGES) {
    try {
      const r = await fetch(`http://localhost:${port}${p}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await r.text();
      const err = text.includes('Internal Server Error');
      console.log(`  page ${String(r.status).padEnd(4)} ${p.padEnd(20)} len=${String(text.length).padEnd(7)} errorText=${err}`);
    } catch (e) {
      console.log(`  page ERR  ${p}  ${e.message}`);
    }
  }
  try {
    const u = `http://localhost:${port}/_next/image?url=${encodeURIComponent(SRC)}&w=640&q=75`;
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const body = Buffer.from(await r.arrayBuffer()).toString('utf8').slice(0, 60).replace(/\s+/g, ' ');
    console.log(`  image ${r.status}  type=${r.headers.get('content-type')}  body="${r.status === 200 ? '(binary)' : body}"`);
  } catch (e) {
    console.log(`  image ERR ${e.message}`);
  }
}
