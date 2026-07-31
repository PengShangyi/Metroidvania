import { mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

const size = 16;
const pixels = Buffer.alloc(size * size * 4);
const colours = {
  edge: [3, 7, 18, 255],
  steel: [30, 64, 92, 255],
  inset: [9, 27, 45, 255],
  cyan: [67, 216, 232, 255],
  pale: [216, 247, 255, 255],
  amber: [255, 180, 84, 255],
};

function rect(x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const offset = (py * size + px) * 4;
      pixels.set(colour, offset);
    }
  }
}

rect(0, 0, 16, 16, colours.edge);
rect(1, 1, 14, 14, colours.steel);
rect(2, 5, 12, 9, colours.inset);
rect(2, 2, 12, 2, colours.cyan);
rect(4, 7, 1, 5, colours.pale);
rect(11, 7, 1, 5, colours.pale);
rect(7, 8, 2, 2, colours.amber);

const tileDirectory = fileURLToPath(new URL('../public/assets/tiles/', import.meta.url));
await mkdir(tileDirectory, { recursive: true });
await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(`${tileDirectory}reactor-tile.png`);

console.log('Generated seamless 16px Zero Reactor tile.');
