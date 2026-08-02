import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

const root = fileURLToPath(new URL('../public/assets/', import.meta.url));
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const budgetBytes = 20 * 1024 * 1024;
const supportedExtensions = new Set(['.png', '.webp', '.jpg', '.jpeg']);
const uiFontPath = join(root, 'fonts', 'fusion-pixel-12px-proportional-zh_hans.otf.woff2');
const uiFontLicensePath = join(projectRoot, 'docs', 'licenses', 'fusion-pixel-font', 'OFL.txt');
const uiFontSha256 = '9d8d2f0bae6214568c591c72f4f3e8cbc39b2eeda461861e521e45d966ccefac';
const proseFontPath = join(root, 'fonts', 'star-echo-sans-sc-subset.woff2');
const proseCharsetPath = join(root, 'fonts', 'star-echo-sans-sc-subset.charset.txt');
const proseFontLicensePath = join(projectRoot, 'docs', 'licenses', 'noto-sans-sc', 'OFL.txt');
const proseFontMaxBytes = 512 * 1024;
// 世界层背景是 480×270、由 zoom 2 相机整数放大；标题图是 UI 层资源，原生 960×540。
// 这张表原先只在 process-art.mjs 里，而那个脚本从不在 CI 里跑，等于没人拦着两者漂移。
const BACKGROUND_SIZES = {
  'backgrounds/vestibule.webp': [480, 270],
  'backgrounds/bioforge.webp': [480, 270],
  'backgrounds/reactor.webp': [480, 270],
  'backgrounds/title.webp': [960, 540],
};
const ENEMY_SPRITE_SIZES = {
  'sprites/crawler.png': [24, 16],
  'sprites/crawler-shielded.png': [24, 16],
  'sprites/crawler-exposed.png': [24, 16],
  'sprites/sentry.png': [20, 20],
  'sprites/turret.png': [24, 24],
  'sprites/spore.png': [22, 22],
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

const runtimeFiles = await walk(root);
const imageFiles = runtimeFiles.filter((file) =>
  supportedExtensions.has(extname(file).toLowerCase()),
);
let totalBytes = 0;

for (const file of runtimeFiles) totalBytes += (await stat(file)).size;

for (const file of imageFiles) {
  const metadata = await sharp(file).metadata();
  const assetPath = relative(root, file);
  if (!metadata.width || !metadata.height) throw new Error(`无法读取图像尺寸：${file}`);
  if (metadata.width > 4096 || metadata.height > 4096) {
    throw new Error(`资源尺寸超过 4096px：${assetPath}`);
  }
  if (assetPath.startsWith('tiles/') && assetPath.endsWith('.png')) {
    if (metadata.width !== 16 || metadata.height !== 16) {
      throw new Error(`${assetPath} 必须为 16×16px`);
    }
    await assertSeamlessTile(file, assetPath);
  }
  if (
    assetPath === 'sprites/spore-atlas.png' &&
    (metadata.width !== 88 || metadata.height !== 22)
  ) {
    throw new Error('孢子跃兽图集必须为四帧 22×22px');
  }
  if (
    assetPath === 'sprites/core-guardian.png' &&
    (metadata.width !== 72 || metadata.height !== 72)
  ) {
    throw new Error('守核者运行时轮廓必须为 72×72px');
  }
  const backgroundSize = BACKGROUND_SIZES[assetPath];
  if (
    backgroundSize &&
    (metadata.width !== backgroundSize[0] || metadata.height !== backgroundSize[1])
  ) {
    throw new Error(`${assetPath} 必须为 ${backgroundSize[0]}×${backgroundSize[1]}px`);
  }
  // 敌人贴图直接顶替同名的程序化占位纹理，尺寸必须与碰撞盒的假设一致。
  const enemySize = ENEMY_SPRITE_SIZES[assetPath];
  if (enemySize && (metadata.width !== enemySize[0] || metadata.height !== enemySize[1])) {
    throw new Error(`${assetPath} 必须为 ${enemySize[0]}×${enemySize[1]}px`);
  }
}

await access(uiFontLicensePath);
const font = await readFile(uiFontPath);
if (font.subarray(0, 4).toString('ascii') !== 'wOF2') {
  throw new Error('简体中文 UI 字体不是有效的 WOFF2 文件');
}
if (font.byteLength > 1024 * 1024) throw new Error('简体中文 UI 字体超过 1MB 上限');
if (createHash('sha256').update(font).digest('hex') !== uiFontSha256) {
  throw new Error('简体中文 UI 字体校验和不匹配');
}

// 正文字体是 pnpm art:font 从 LFS 里的上游 OTF 生成的构建产物，不像像素字体那样
// 是直接下载的第三方文件，所以这里不固定校验和（否则每改一句中文都要连带更新它）。
// 内容正确性由 fontCoverage.test.ts 保证：源码里的每个非 ASCII 字符都必须在子集内。
await access(proseFontLicensePath);
const proseCharset = await readFile(proseCharsetPath, 'utf8');
if (proseCharset.length === 0) throw new Error('正文字体字符集清单为空');
const proseFont = await readFile(proseFontPath);
if (proseFont.subarray(0, 4).toString('ascii') !== 'wOF2') {
  throw new Error('简体中文正文字体不是有效的 WOFF2 文件');
}
if (proseFont.byteLength > proseFontMaxBytes) {
  throw new Error(
    `简体中文正文字体 ${(proseFont.byteLength / 1024).toFixed(1)}KB 超过 ` +
      `${proseFontMaxBytes / 1024}KB 上限，请检查子集是否收进了多余字形`,
  );
}

if (totalBytes > budgetBytes) {
  throw new Error(`资源总量 ${(totalBytes / 1024 / 1024).toFixed(2)}MB 超过 20MB 预算`);
}

console.log(
  `Validated ${imageFiles.length} image assets and 2 UI fonts ` +
    `(${(totalBytes / 1024 / 1024).toFixed(2)}MB, 正文子集 ${proseCharset.length} 字形 / ` +
    `${(proseFont.byteLength / 1024).toFixed(1)}KB).`,
);

async function assertSeamlessTile(file, assetPath) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const offset = (y * info.width + x) * info.channels;
    return data.subarray(offset, offset + info.channels);
  };
  for (let index = 0; index < 16; index += 1) {
    if (!pixel(0, index).equals(pixel(15, index))) throw new Error(`${assetPath} 左右接缝不一致`);
    if (!pixel(index, 0).equals(pixel(index, 15))) throw new Error(`${assetPath} 上下接缝不一致`);
  }
}
