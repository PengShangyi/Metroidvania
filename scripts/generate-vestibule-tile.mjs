import { mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

// 前庭是开局的六个房间，却一直没有地块贴图：RoomRuntime 的 tileKey 三元
// 只覆盖生化区和反应堆，前庭退化成 1×1 白点 tint 出来的纯色矩形——
// 玩家第一眼看到的地形就是几条色块。这里补一张与前庭配色一致的 16px 无缝瓦片。

const size = 16;
const pixels = Buffer.alloc(size * size * 4);
const colours = {
  edge: [7, 16, 29, 255],
  hull: [42, 60, 92, 255],
  hullDark: [28, 42, 68, 255],
  seam: [21, 36, 69, 255],
  rivet: [141, 161, 200, 255],
  amber: [255, 180, 84, 255],
};

function rect(x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      pixels.set(colour, (py * size + px) * 4);
    }
  }
}

// 船体钢板：外圈描边保证上下左右接缝一致，内部是错开的舱板与铆钉。
rect(0, 0, 16, 16, colours.hull);
rect(0, 0, 16, 1, colours.edge);
rect(0, 15, 16, 1, colours.edge);
rect(0, 0, 1, 16, colours.edge);
rect(15, 0, 1, 16, colours.edge);
rect(1, 1, 14, 6, colours.hullDark);
rect(1, 7, 14, 1, colours.seam);
rect(7, 8, 1, 7, colours.seam);
rect(2, 2, 1, 1, colours.rivet);
rect(13, 2, 1, 1, colours.rivet);
rect(2, 12, 1, 1, colours.rivet);
rect(13, 12, 1, 1, colours.rivet);
rect(10, 4, 2, 1, colours.amber);

const tileDirectory = fileURLToPath(new URL('../public/assets/tiles/', import.meta.url));
await mkdir(tileDirectory, { recursive: true });
await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(`${tileDirectory}vestibule-tile.png`);

console.log('前庭地块已生成：tiles/vestibule-tile.png');
