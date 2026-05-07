// Convierte el SVG master a PNG transparente y JPG en varias resoluciones.
// Uso: node brand/generate.js
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'simple-block-builder.svg');
const svg = await readFile(svgPath);

const sizes = [512, 1024];

for (const size of sizes) {
  const png = await sharp(svg, { density: 600 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(join(__dirname, `simple-block-builder-${size}.png`), png);

  const jpg = await sharp(svg, { density: 600 })
    .resize(size, size)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92 })
    .toBuffer();
  await writeFile(join(__dirname, `simple-block-builder-${size}.jpg`), jpg);
}

console.log('OK — PNG y JPG generados en /brand');
