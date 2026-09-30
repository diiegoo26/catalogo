// Renders a remote image as ASCII art so the garment's silhouette can be judged.
// Run: node scripts/ascii-kit.mjs <url>
import sharp from 'sharp';

const url = process.argv[2];
const W = 56;
const RAMP = ' .:-=+*#%@';

const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status} ${url}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const meta = await sharp(buf).metadata();
const { data } = await sharp(buf)
  .resize(W, W, { fit: 'fill' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });

console.log(`${url}`);
console.log(`  ${meta.width}x${meta.height} ${meta.format} ${buf.length}b\n`);
let out = '';
for (let y = 0; y < W; y++) {
  let line = '';
  for (let x = 0; x < W; x++) {
    const v = data[y * W + x];
    line += RAMP[Math.min(RAMP.length - 1, Math.floor((v / 255) * RAMP.length))];
  }
  out += line + '\n';
}
console.log(out);
