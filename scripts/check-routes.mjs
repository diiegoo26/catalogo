// Hits every category route, the brand routes and the root, on one or more ports, and reports
// anything that is not 200 or that renders the string "Internal Server Error".
// Run: node scripts/check-routes.mjs 3000 3123
const ports = process.argv.slice(2);
const CATEGORIES = ['equipaciones', 'calzado', 'accesorios', 'packs', 'chandal', 'conjuntos', 'relojes',
  'gorras', 'bolsos', 'camisetas', 'pantalones', 'chanclas', 'chaquetas', 'selecciones'];
const BRANDS = ['packo', 'hublok', 'solea', 'cronos', 'nyke', 'kapsul', 'lacosta', 'vantor', 'marvella', 'rollex'];

for (const port of ports) {
  const paths = ['/', '/equipaciones', '/calzado',
    ...CATEGORIES.map((c) => `/${c}`),
    ...BRANDS.map((b) => `/calzado/${b}`)];
  const bad = [];
  for (const p of paths) {
    try {
      const r = await fetch(`http://localhost:${port}${p}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await r.text();
      const ies = text.includes('Internal Server Error') || text.includes('url" parameter is not allowed');
      if (r.status !== 200 || ies) bad.push([r.status, ies ? 'contains error text' : '', p]);
    } catch (e) {
      bad.push(['ERR', e.message, p]);
    }
  }
  console.log(`port ${port}: checked ${paths.length} routes, problems ${bad.length}`);
  for (const b of bad) console.log('   ', b.join('  '));
}
