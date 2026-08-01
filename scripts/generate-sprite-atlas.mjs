import { access, mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

// 主角的 19 帧原先是十来条 rect() 硬拼出来的色块，每帧只有 4-6 种颜色，
// idle 的帧间差异只有 1px、run 只有 1-2px——在 3fps / 10fps 下看起来「根本不动」。
// 现在以去背原画降采样出的基准帧为底，程序化派生全部 19 帧。
// 布局仍是 456×32 / 每帧 24×32，playerAnimations.ts 的帧表不需要改。
//
// 原画是朝左的，而 docs/ART_BIBLE.md 的约定是「只绘制朝右帧，朝左由运行时镜像」
// （Player.setFlipX(facing < 0)）。基准帧必须 flop 成朝右，否则屏幕上的朝向与
// 移动方向恰好相反——下面手工放的枪口闪光、冲刺残影，以及 CombatSystem 的弹体
// 与刀光偏移，全都是按朝右写的。

const frameWidth = 24;
const frameHeight = 32;
const frameCount = 19;
const atlasWidth = frameWidth * frameCount;

/** 碰撞体是 14×28、offset (5,4)，所以人物要落在 x 5..19、y 4..32 这块区域附近。 */
const bodyMaxWidth = 20;
const bodyMaxHeight = 28;

const palette = {
  navy: [17, 27, 53, 255],
  steel: [38, 62, 103, 255],
  pale: [216, 247, 255, 255],
  cyan: [67, 216, 232, 255],
  amber: [255, 180, 84, 255],
  danger: [255, 86, 120, 255],
};

const prepared = fileURLToPath(new URL('../tmp/imagegen/', import.meta.url));
const cutout = `${prepared}iya-cutout.png`;
try {
  await access(cutout);
} catch {
  throw new Error(
    `缺少去背原画 tmp/imagegen/iya-cutout.png。透明素材须先用 ImageGen 技能的 remove_chroma_key.py 生成。`,
  );
}

// 基准帧：原画镜像成朝右后等比缩进 20×28，底部对齐、水平居中。
const scaled = await sharp(cutout)
  .ensureAlpha()
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .flop()
  .resize(bodyMaxWidth, bodyMaxHeight, {
    fit: 'inside',
    kernel: sharp.kernel.nearest,
    withoutEnlargement: false,
  })
  // 原画是深海军蓝装甲，缩到 20px 后压在同样偏暗的背景上剪影会糊掉，
  // 这里提亮并拉一点饱和度让轮廓站出来。
  .modulate({ brightness: 1.32, saturation: 1.15 })
  .raw()
  .toBuffer({ resolveWithObject: true });

const base = Buffer.alloc(frameWidth * frameHeight * 4, 0);
{
  const { width: sw, height: sh } = scaled.info;
  const offsetX = Math.round((frameWidth - sw) / 2);
  const offsetY = frameHeight - sh;
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const from = (y * sw + x) * 4;
      if (scaled.data[from + 3] < 24) continue;
      const to = ((y + offsetY) * frameWidth + x + offsetX) * 4;
      base[to] = scaled.data[from];
      base[to + 1] = scaled.data[from + 1];
      base[to + 2] = scaled.data[from + 2];
      base[to + 3] = 255;
    }
  }
}

const pixels = Buffer.alloc(atlasWidth * frameHeight * 4, 0);

function readBase(x, y) {
  if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) return null;
  const offset = (y * frameWidth + x) * 4;
  if (base[offset + 3] === 0) return null;
  return [base[offset], base[offset + 1], base[offset + 2], base[offset + 3]];
}

function writePixel(frame, x, y, colour) {
  if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) return;
  const offset = (y * atlasWidth + frame * frameWidth + x) * 4;
  pixels.set(colour, offset);
}

function rect(frame, x, y, width, height, colour) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) writePixel(frame, px, py, colour);
  }
}

/** 稳定的伪随机：溶解遮罩每次生成都必须一样，否则图集不可复现。 */
function hashUnit(x, y) {
  const mixed = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663);
  return ((mixed >>> 8) & 0xffff) / 0xffff;
}

/**
 * 把基准帧画进某一帧。
 * legShift 只挪 legTop 以下的部分，用来做出可见的跨步；
 * dissolve 按稳定遮罩抠掉像素，死亡动画靠它真正「散开」。
 */
function drawBase(frame, options = {}) {
  const bob = options.bob ?? 0;
  const legShift = options.legShift ?? 0;
  const legTop = options.legTop ?? 22;
  const tint = options.tint;
  const tintMix = options.tintMix ?? 0;
  const alpha = options.alpha ?? 255;
  const dissolve = options.dissolve ?? 0;

  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const shift = y >= legTop ? legShift : 0;
      const source = readBase(x - shift, y - bob);
      if (!source) continue;
      if (dissolve > 0 && hashUnit(x, y) < dissolve) continue;
      let [r, g, b] = source;
      if (tint && tintMix > 0) {
        r = Math.round(r + (tint[0] - r) * tintMix);
        g = Math.round(g + (tint[1] - g) * tintMix);
        b = Math.round(b + (tint[2] - b) * tintMix);
      }
      writePixel(frame, x, y, [r, g, b, alpha]);
    }
  }
}

// idle 0-1：呼吸起伏放到 2px，3fps 下才看得出在动
drawBase(0);
drawBase(1, { bob: -2 });

// run 2-5：四帧跨步，下半身左右各偏 2px 并配合躯干起伏
drawBase(2, { legShift: 2, bob: 0 });
drawBase(3, { legShift: 0, bob: -2 });
drawBase(4, { legShift: -2, bob: 0 });
drawBase(5, { legShift: 0, bob: -2 });

// jump 6 / fall 7：收腿与展腿
drawBase(6, { bob: -2, legShift: 1, legTop: 24 });
drawBase(7, { bob: 1, legShift: -1, legTop: 24 });

// shoot 8-9：只点一小簇枪口闪光；弹体本身由 CombatSystem 生成，不用在帧里画
drawBase(8);
drawBase(9, { bob: -1 });
rect(8, 19, 16, 3, 2, palette.cyan);
rect(9, 19, 15, 3, 2, palette.pale);
writePixel(9, 22, 16, palette.cyan);

// slash 10-12：只做出挥砍的身体姿态。刀光是 'slash' 贴图另画的，
// 帧里再叠一道粗条只会糊成一片。
drawBase(10, { bob: -1, legShift: -1, legTop: 20 });
drawBase(11, { legShift: 1, legTop: 18 });
drawBase(12, { bob: 1, legShift: 2, legTop: 20 });

// dash 13：主体压成青色，后方拖一层低透明残影
drawBase(13, { legShift: 2, legTop: 20, tint: palette.cyan, tintMix: 0.4 });
for (let y = 4; y < frameHeight; y += 1) {
  for (let x = 0; x < frameWidth; x += 1) {
    if (!readBase(x + 5, y)) continue;
    const offset = (y * atlasWidth + 13 * frameWidth + x) * 4;
    if (pixels[offset + 3] !== 0) continue;
    writePixel(13, x, y, [palette.cyan[0], palette.cyan[1], palette.cyan[2], 80]);
  }
}

// hurt 14：整体压向警示色
drawBase(14, { bob: -1, tint: palette.danger, tintMix: 0.55 });

// death 15-18：按稳定遮罩逐级溶解，取代原先「变个色块」的假动画
drawBase(15, { bob: -1, tint: palette.pale, tintMix: 0.3 });
drawBase(16, { bob: 1, tint: palette.cyan, tintMix: 0.35, dissolve: 0.3 });
drawBase(17, { bob: 3, tint: palette.cyan, tintMix: 0.5, dissolve: 0.58, alpha: 210 });
drawBase(18, { bob: 5, tint: palette.pale, tintMix: 0.6, dissolve: 0.8, alpha: 150 });

const spriteDirectory = fileURLToPath(new URL('../public/assets/sprites/', import.meta.url));
const uiDirectory = fileURLToPath(new URL('../public/assets/ui/', import.meta.url));
await Promise.all([
  mkdir(spriteDirectory, { recursive: true }),
  mkdir(uiDirectory, { recursive: true }),
]);

await sharp(pixels, {
  raw: { width: atlasWidth, height: frameHeight, channels: 4 },
})
  .png({ palette: true, colours: 64, compressionLevel: 9 })
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

console.log(`主角图集已从去背原画派生：${frameCount} 帧 / ${atlasWidth}×${frameHeight}`);
