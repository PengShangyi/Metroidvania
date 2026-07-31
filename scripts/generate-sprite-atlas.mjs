import { mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

const frameWidth = 24;
const frameHeight = 32;
const frameCount = 19;
const atlasWidth = frameWidth * frameCount;
const pixels = Buffer.alloc(atlasWidth * frameHeight * 4);

const palette = {
  navy: [17, 27, 53, 255],
  steel: [38, 62, 103, 255],
  pale: [216, 247, 255, 255],
  cyan: [67, 216, 232, 255],
  amber: [255, 180, 84, 255],
  danger: [255, 86, 120, 255],
};

function pixel(frame, x, y, colour) {
  if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) return;
  const offset = (y * atlasWidth + frame * frameWidth + x) * 4;
  pixels.set(colour, offset);
}

function rect(frame, x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) pixel(frame, px, py, colour);
  }
}

function upright(frame, options = {}) {
  const bob = options.bob ?? 0;
  const lean = options.lean ?? 0;
  const leftLeg = options.leftLeg ?? 0;
  const rightLeg = options.rightLeg ?? 0;
  const arm = options.arm ?? 0;

  rect(frame, 7 + lean, 4 + bob, 10, 7, palette.pale);
  rect(frame, 10 + lean, 6 + bob, 8, 2, palette.cyan);
  rect(frame, 6 + lean, 11 + bob, 12, 14, palette.steel);
  rect(frame, 8 + lean, 13 + bob, 8, 8, palette.navy);
  rect(frame, 5 + lean, 13 + bob + arm, 3, 10, palette.steel);
  rect(frame, 17 + lean, 13 + bob - arm, 4, 9, palette.steel);
  rect(frame, 18 + lean, 14 + bob - arm, 5, 4, palette.amber);
  rect(frame, 7 + lean + leftLeg, 24 + bob, 4, 7, palette.steel);
  rect(frame, 13 + lean + rightLeg, 24 + bob, 4, 7, palette.steel);
  rect(frame, 6 + lean + leftLeg, 30 + bob, 6, 2, palette.navy);
  rect(frame, 12 + lean + rightLeg, 30 + bob, 6, 2, palette.navy);
}

upright(0);
upright(1, { bob: 1 });
upright(2, { leftLeg: -2, rightLeg: 1, arm: -2 });
upright(3, { leftLeg: -1, rightLeg: 0, bob: 1, arm: 1 });
upright(4, { leftLeg: 1, rightLeg: -2, arm: 2 });
upright(5, { leftLeg: 0, rightLeg: -1, bob: 1, arm: -1 });
upright(6, { bob: -1, leftLeg: 1, rightLeg: -1 });
upright(7, { leftLeg: -1, rightLeg: 1 });
upright(8, { arm: -3 });
upright(9, { bob: 1, arm: -3 });
rect(8, 20, 10, 4, 3, palette.cyan);
rect(9, 20, 11, 4, 3, palette.pale);
upright(10, { arm: 2 });
upright(11, { lean: -1, arm: 1 });
upright(12, { lean: 1, arm: -1 });
rect(10, 19, 5, 2, 14, palette.cyan);
rect(11, 20, 2, 2, 17, palette.pale);
rect(12, 18, 2, 4, 15, palette.cyan);
upright(13, { lean: 2, bob: 1, leftLeg: -2, rightLeg: -2 });
rect(13, 1, 14, 8, 2, palette.cyan);
rect(13, 3, 18, 5, 1, palette.pale);
upright(14, { lean: -2, leftLeg: 1, rightLeg: 1 });
rect(14, 5, 11, 2, 9, palette.danger);
upright(15, { bob: 2 });
rect(15, 4, 7, 16, 20, palette.cyan);
rect(16, 2, 23, 20, 6, palette.steel);
rect(16, 16, 20, 7, 5, palette.pale);
rect(16, 18, 22, 5, 2, palette.cyan);
rect(17, 3, 25, 18, 4, palette.steel);
rect(17, 7, 22, 10, 3, palette.pale);
rect(18, 5, 27, 14, 2, palette.cyan);
rect(18, 9, 24, 6, 2, palette.pale);

const spriteDirectory = fileURLToPath(new URL('../public/assets/sprites/', import.meta.url));
const uiDirectory = fileURLToPath(new URL('../public/assets/ui/', import.meta.url));
await Promise.all([
  mkdir(spriteDirectory, { recursive: true }),
  mkdir(uiDirectory, { recursive: true }),
]);

await sharp(pixels, {
  raw: { width: atlasWidth, height: frameHeight, channels: 4 },
})
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(`${spriteDirectory}iya-atlas.png`);

const iconWidth = 16;
const iconCount = 5;
const iconPixels = Buffer.alloc(iconWidth * iconWidth * iconCount * 4);
function iconPixel(icon, x, y, colour) {
  if (x < 0 || y < 0 || x >= iconWidth || y >= iconWidth) return;
  const offset = (y * iconWidth * iconCount + icon * iconWidth + x) * 4;
  iconPixels.set(colour, offset);
}
function iconRect(icon, x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) iconPixel(icon, px, py, colour);
  }
}
iconRect(0, 6, 2, 4, 12, palette.pale);
iconRect(0, 2, 6, 12, 4, palette.pale);
iconRect(0, 7, 3, 2, 10, palette.danger);
iconRect(0, 3, 7, 10, 2, palette.danger);
for (let x = 2; x < 14; x += 1) {
  iconPixel(1, x, Math.round(8 - Math.abs(8 - x) / 2), palette.cyan);
}
iconRect(1, 6, 6, 7, 3, palette.pale);
iconRect(2, 3, 2, 3, 12, palette.pale);
iconRect(2, 10, 2, 3, 12, palette.pale);
iconRect(2, 6, 5, 4, 6, palette.cyan);
iconRect(3, 2, 3, 12, 10, palette.steel);
iconRect(3, 4, 5, 4, 3, palette.cyan);
iconRect(3, 9, 9, 3, 3, palette.amber);
iconRect(4, 3, 1, 10, 14, palette.steel);
iconRect(4, 5, 4, 6, 5, palette.cyan);
iconRect(4, 7, 11, 2, 2, palette.amber);

await sharp(iconPixels, {
  raw: { width: iconWidth * iconCount, height: iconWidth, channels: 4 },
})
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(`${uiDirectory}base-icons.png`);

console.log('Generated 19-frame Iya atlas and five base UI icons.');
