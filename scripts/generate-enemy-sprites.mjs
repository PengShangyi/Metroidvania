import { access } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

// 敌人立绘早就画好了（public/assets/sprites/enemy-lineup.png），但游戏一直在用
// createProceduralTextures 里的三角形和矩形占位图。这个脚本把立绘按 alpha 投影
// 自动切成四只，降采样到运行时尺寸，并派生出护盾/开核两个变体。
// 切图坐标不手抄：立绘一旦重出，分割线会跟着走。

const root = fileURLToPath(new URL('../', import.meta.url));
const publicAssets = fileURLToPath(new URL('../public/assets/', import.meta.url));
const lineupPath = `${publicAssets}sprites/enemy-lineup.png`;

/** 与 createProceduralTextures 里的占位尺寸保持一致，碰撞盒才不用跟着改。 */
const RUNTIME_SIZES = [
  { key: 'crawler', width: 24, height: 16 },
  { key: 'sentry', width: 20, height: 20 },
  { key: 'turret', width: 24, height: 24 },
  { key: 'spore', width: 22, height: 22 },
];

const PALETTE = {
  shieldPlate: { r: 0x4a, g: 0x5f, b: 0x8c },
  shieldEdge: { r: 0x8d, g: 0xa1, b: 0xc8 },
  shieldGlow: { r: 0x8c, g: 0xe7, b: 0xff },
  core: { r: 0xff, g: 0xb4, b: 0x54 },
  coreHot: { r: 0xff, g: 0xf4, b: 0xd8 },
};

try {
  await access(lineupPath);
} catch {
  throw new Error(`缺少敌人立绘 ${lineupPath.replace(root, '')}，请先运行 pnpm art:process。`);
}

const lineup = sharp(lineupPath).ensureAlpha();
const { width, height } = await lineup.metadata();
const { data } = await lineup.raw().toBuffer({ resolveWithObject: true });

/** 按列统计 alpha：谷底就是四只之间的空隙。 */
function columnCoverage() {
  const coverage = new Array(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 24) coverage[x] += 1;
    }
  }
  return coverage;
}

function splitColumns() {
  const coverage = columnCoverage();
  const spans = [];
  let start = -1;
  for (let x = 0; x < width; x += 1) {
    const filled = coverage[x] > 0;
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      spans.push({ left: start, right: x - 1 });
      start = -1;
    }
  }
  if (start >= 0) spans.push({ left: start, right: width - 1 });
  // 忽略降采样产生的孤立碎片（例如触须末端的几个像素）。
  return spans.filter((span) => span.right - span.left >= 16);
}

function rowSpan(left, right) {
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        break;
      }
    }
  }
  return { top, bottom };
}

const spans = splitColumns();
if (spans.length !== RUNTIME_SIZES.length) {
  throw new Error(
    `敌人立绘应当能切出 ${RUNTIME_SIZES.length} 只，实际切出 ${spans.length} 段（列投影分割失败）。`,
  );
}

/** 取出一只敌人并等比缩放进目标画布，保持像素硬边。 */
async function extractEnemy(span, size) {
  const { top, bottom } = rowSpan(span.left, span.right);
  return sharp(lineupPath)
    .ensureAlpha()
    .extract({
      left: span.left,
      top,
      width: span.right - span.left + 1,
      height: bottom - top + 1,
    })
    .resize(size.width, size.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.nearest,
    })
    .png({ palette: true, colours: 64, compressionLevel: 9 })
    .toBuffer();
}

function solidLayer(width, height, colour, alpha = 255) {
  return {
    create: {
      width,
      height,
      channels: 4,
      background: { ...colour, alpha },
    },
  };
}

/** 用字符画铺一层 RGBA 像素，比拼纯色矩形更像手绘的装甲和核心。 */
async function pixelLayer(rows, legend) {
  const layerHeight = rows.length;
  const layerWidth = rows[0].length;
  const buffer = Buffer.alloc(layerWidth * layerHeight * 4, 0);
  for (let y = 0; y < layerHeight; y += 1) {
    if (rows[y].length !== layerWidth) throw new Error('字符画各行长度必须一致');
    for (let x = 0; x < layerWidth; x += 1) {
      const colour = legend[rows[y][x]];
      if (!colour) continue;
      const offset = (y * layerWidth + x) * 4;
      buffer[offset] = colour.r;
      buffer[offset + 1] = colour.g;
      buffer[offset + 2] = colour.b;
      buffer[offset + 3] = colour.alpha ?? 255;
    }
  }
  return sharp(buffer, { raw: { width: layerWidth, height: layerHeight, channels: 4 } })
    .png()
    .toBuffer();
}

const outputs = [];
const frames = new Map();

for (const [index, size] of RUNTIME_SIZES.entries()) {
  const buffer = await extractEnemy(spans[index], size);
  frames.set(size.key, buffer);
  outputs.push([`sprites/${size.key}.png`, buffer]);
}

// 护盾与开核变体：以爬行体为底叠程序化像素层。运行时靠 setTexture 切换，
// 所以三张图必须同尺寸，且核心要偏在一侧（shieldRules 判定的就是「从哪侧穿过」）。
const crawler = RUNTIME_SIZES[0];
const shieldPlate = await pixelLayer(
  [
    '..PPPP..',
    '.PPPPPPH',
    'PPGGGPPH',
    'PPGGGPPH',
    'PPGGGPPH',
    'PPGGGPPH',
    'PPPPPPPH',
    '.PPPPPPH',
    '..PPPP..',
  ],
  {
    P: { ...PALETTE.shieldPlate, alpha: 240 },
    H: { ...PALETTE.shieldEdge, alpha: 255 },
    G: { ...PALETTE.shieldGlow, alpha: 255 },
  },
);
const shielded = await sharp(frames.get('crawler'))
  .composite([{ input: shieldPlate, left: crawler.width - 9, top: 3 }])
  .png({ palette: true, colours: 64, compressionLevel: 9 })
  .toBuffer();
outputs.push(['sprites/crawler-shielded.png', shielded]);

const coreEye = await pixelLayer(
  ['..CCCC..', '.CCCCCC.', 'CCCWWCCC', 'CCWWWWCC', 'CCWWWWCC', 'CCCWWCCC', '.CCCCCC.', '..CCCC..'],
  {
    C: { ...PALETTE.core, alpha: 250 },
    W: { ...PALETTE.coreHot, alpha: 255 },
  },
);
const exposed = await sharp(frames.get('crawler'))
  .composite([{ input: coreEye, left: crawler.width - 9, top: 4 }])
  .png({ palette: true, colours: 64, compressionLevel: 9 })
  .toBuffer();
outputs.push(['sprites/crawler-exposed.png', exposed]);

// 孢子的四帧脉动图集：帧尺寸必须保持 22×22（validate-assets 断言 88×22）。
const sporeFrames = await Promise.all(
  [1, 0.92, 0.84, 0.92].map(async (scale, index) => {
    const inner = Math.max(8, Math.round(22 * scale));
    const resized = await sharp(frames.get('spore'))
      .resize(inner, inner, { kernel: sharp.kernel.nearest })
      .modulate({ brightness: 1 + (index === 2 ? 0.16 : index === 0 ? 0 : 0.08) })
      .png()
      .toBuffer();
    const offset = Math.floor((22 - inner) / 2);
    return { input: resized, left: index * 22 + offset, top: offset };
  }),
);
const sporeAtlas = await sharp(solidLayer(88, 22, { r: 0, g: 0, b: 0 }, 0))
  .composite(sporeFrames)
  .png({ palette: true, colours: 64, compressionLevel: 9 })
  .toBuffer();
outputs.push(['sprites/spore-atlas.png', sporeAtlas]);

await Promise.all(
  outputs.map(([relativePath, buffer]) => sharp(buffer).toFile(`${publicAssets}${relativePath}`)),
);

const summary = outputs
  .map(([relativePath]) => relativePath.replace('sprites/', ''))
  .sort()
  .join(', ');
console.log(`敌人贴图已从立绘切出：${summary}`);
