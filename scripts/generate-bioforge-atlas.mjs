import { mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

const frameSize = 22;
const frameCount = 4;
const atlasWidth = frameSize * frameCount;
const pixels = Buffer.alloc(atlasWidth * frameSize * 4);
const colours = {
  dark: [11, 24, 28, 255],
  shell: [52, 93, 83, 255],
  moss: [104, 148, 103, 255],
  glow: [237, 99, 214, 255],
  pale: [216, 247, 255, 255],
};

function pixel(frame, x, y, colour) {
  if (x < 0 || y < 0 || x >= frameSize || y >= frameSize) return;
  const offset = (y * atlasWidth + frame * frameSize + x) * 4;
  pixels.set(colour, offset);
}

function rect(frame, x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) pixel(frame, px, py, colour);
  }
}

function circle(frame, centreX, centreY, radius, colour) {
  for (let y = centreY - radius; y <= centreY + radius; y += 1) {
    for (let x = centreX - radius; x <= centreX + radius; x += 1) {
      if ((x - centreX) ** 2 + (y - centreY) ** 2 <= radius ** 2) {
        pixel(frame, x, y, colour);
      }
    }
  }
}

for (let frame = 0; frame < frameCount; frame += 1) {
  const bob = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const radius = frame === 2 ? 9 : 8;
  circle(frame, 11, 11 + bob, radius, colours.shell);
  circle(frame, 10, 9 + bob, radius - 3, colours.moss);
  rect(frame, 3, 16 + bob, 4, 4, colours.dark);
  rect(frame, 15, 16 + bob, 4, 4, colours.dark);
  circle(frame, 7, 8 + bob, 2, colours.glow);
  circle(frame, 14, 11 + bob, 2, colours.glow);
  pixel(frame, 7, 8 + bob, colours.pale);
  pixel(frame, 14, 11 + bob, colours.pale);
}

const spriteDirectory = fileURLToPath(new URL('../public/assets/sprites/', import.meta.url));
const tileDirectory = fileURLToPath(new URL('../public/assets/tiles/', import.meta.url));
await Promise.all([
  mkdir(spriteDirectory, { recursive: true }),
  mkdir(tileDirectory, { recursive: true }),
]);

await sharp(pixels, { raw: { width: atlasWidth, height: frameSize, channels: 4 } })
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(`${spriteDirectory}spore-atlas.png`);

const tileSize = 16;
const tile = Buffer.alloc(tileSize * tileSize * 4);
function tileRect(x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const offset = (py * tileSize + px) * 4;
      tile.set(colour, offset);
    }
  }
}
tileRect(0, 0, 16, 16, colours.dark);
tileRect(1, 1, 14, 14, colours.shell);
tileRect(1, 2, 14, 3, colours.moss);
tileRect(3, 7, 10, 7, colours.dark);
tileRect(4, 8, 2, 2, colours.glow);
tileRect(11, 11, 1, 1, colours.pale);

await sharp(tile, { raw: { width: tileSize, height: tileSize, channels: 4 } })
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(`${tileDirectory}bioforge-tile.png`);

console.log('Generated four-frame spore atlas and seamless 16px Bioforge tile.');
