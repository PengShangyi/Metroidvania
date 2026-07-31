import { access, mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = fileURLToPath(new URL('../art/source/', import.meta.url));
const prepared = fileURLToPath(new URL('../tmp/imagegen/', import.meta.url));
const publicAssets = fileURLToPath(new URL('../public/assets/', import.meta.url));

const required = [
  `${source}vestibule-background.png`,
  `${prepared}iya-cutout.png`,
  `${prepared}enemy-cutout.png`,
];

for (const file of required) {
  try {
    await access(file);
  } catch {
    throw new Error(
      `缺少处理输入 ${file.replace(root, '')}。透明素材须先使用 ImageGen 技能的 remove_chroma_key.py 生成去背图。`,
    );
  }
}

await Promise.all([
  mkdir(`${publicAssets}backgrounds`, { recursive: true }),
  mkdir(`${publicAssets}sprites`, { recursive: true }),
]);

await Promise.all([
  sharp(`${source}vestibule-background.png`)
    .resize(480, 270, { fit: 'cover', position: 'centre', kernel: sharp.kernel.nearest })
    .webp({ quality: 84, smartSubsample: false, effort: 6 })
    .toFile(`${publicAssets}backgrounds/vestibule.webp`),
  sharp(`${prepared}iya-cutout.png`)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ height: 384, kernel: sharp.kernel.nearest, withoutEnlargement: true })
    .png({ palette: true, colours: 128, compressionLevel: 9 })
    .toFile(`${publicAssets}sprites/iya-portrait.png`),
  sharp(`${prepared}enemy-cutout.png`)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 768, kernel: sharp.kernel.nearest, withoutEnlargement: true })
    .png({ palette: true, colours: 128, compressionLevel: 9 })
    .toFile(`${publicAssets}sprites/enemy-lineup.png`),
]);

const expectations = new Map([
  [`${publicAssets}backgrounds/vestibule.webp`, [480, 270]],
  [`${publicAssets}sprites/iya-portrait.png`, [undefined, 384]],
  [`${publicAssets}sprites/enemy-lineup.png`, [768, undefined]],
]);

for (const [file, [expectedWidth, expectedHeight]] of expectations) {
  const metadata = await sharp(file).metadata();
  if (
    (expectedWidth !== undefined && metadata.width !== expectedWidth) ||
    (expectedHeight !== undefined && metadata.height !== expectedHeight)
  ) {
    throw new Error(`资源尺寸校验失败：${file.replace(root, '')}`);
  }
}

console.log('Processed ImageGen sources into three optimized runtime assets.');
