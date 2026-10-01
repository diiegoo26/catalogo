import { chromium } from 'playwright';

const browser = await chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 120)); });
  await page.goto('http://localhost:3000/perfumes/chanel', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `.prod-${name}.png`, fullPage: false });
  const m = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('ul img'));
    const first = imgs[0]?.getBoundingClientRect();
    return {
      vw: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      nImgs: imgs.length,
      firstImg: first ? { w: Math.round(first.width), h: Math.round(first.height) } : null,
    };
  });
  console.log(name, JSON.stringify(m), 'errores:', errores.length ? errores : 'ninguno');
  await ctx.close();
}
await browser.close();
console.log('ok');
