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
  totalBytes += fileStat.size;
  if (!metadata.width || !metadata.height) throw new Error(`无法读取图像尺寸：${file}`);
  if (metadata.width > 4096 || metadata.height > 4096) {
    throw new Error(`资源尺寸超过 4096px：${relative(root, file)}`);
  }
}

if (totalBytes > budgetBytes) {
  throw new Error(`资源总量 ${(totalBytes / 1024 / 1024).toFixed(2)}MB 超过 20MB 预算`);
}

// eslint-disable-next-line no-undef
console.log(`Validated ${files.length} image assets (${(totalBytes / 1024 / 1024).toFixed(2)}MB).`);
