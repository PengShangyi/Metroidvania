import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

const root = fileURLToPath(new URL('../public/assets/', import.meta.url));
const budgetBytes = 20 * 1024 * 1024;
const supportedExtensions = new Set(['.png', '.webp', '.jpg', '.jpeg']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (supportedExtensions.has(extname(entry.name).toLowerCase())) files.push(path);
  }
  return files;
}

const files = await walk(root);
let totalBytes = 0;

for (const file of files) {
  const fileStat = await stat(file);
  const metadata = await sharp(file).metadata();
  const assetPath = relative(root, file);
  totalBytes += fileStat.size;
  if (!metadata.width || !metadata.height) throw new Error(`无法读取图像尺寸：${file}`);
  if (metadata.width > 4096 || metadata.height > 4096) {
    throw new Error(`资源尺寸超过 4096px：${assetPath}`);
  }
  if (assetPath === 'tiles/bioforge-tile.png' || assetPath === 'tiles/reactor-tile.png') {
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
}

if (totalBytes > budgetBytes) {
  throw new Error(`资源总量 ${(totalBytes / 1024 / 1024).toFixed(2)}MB 超过 20MB 预算`);
}

console.log(`Validated ${files.length} image assets (${(totalBytes / 1024 / 1024).toFixed(2)}MB).`);

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
