/**
 * 从 Noto Sans CJK SC Regular 生成正文矢量字体子集。
 *
 * 完整的 woff2 有 4MB 以上，会变成标题画面之前的一次阻塞下载；项目实际用到的
 * 非 ASCII 字符只有几百个，子集下来通常在 300KB 上下。
 *
 * 用法：pnpm art:font
 * 需要先把上游 OTF 放到 art/source/fonts/NotoSansCJKsc-Regular.otf（Git LFS）。
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import subsetFont from 'subset-font';

import {
  SCANNED_EXTENSIONS,
  buildCharset,
  collectRequiredCharacters,
} from '../src/game/ui/fontCoverage.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceFont = join(projectRoot, 'art', 'source', 'fonts', 'NotoSansCJKsc-Regular.otf');
const outputFont = join(projectRoot, 'public', 'assets', 'fonts', 'star-echo-sans-sc-subset.woff2');
const outputCharset = join(
  projectRoot,
  'public',
  'assets',
  'fonts',
  'star-echo-sans-sc-subset.charset.txt',
);

/** 连注释里的中文也一并收进来：宁可多几百字节，也不要日后改一句文案就出豆腐块。 */
async function collectSourceTexts() {
  const texts = [await readFile(join(projectRoot, 'index.html'), 'utf8')];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (SCANNED_EXTENSIONS.has(extname(entry.name)))
        texts.push(await readFile(path, 'utf8'));
    }
  };
  await walk(join(projectRoot, 'src'));
  return texts;
}

const required = collectRequiredCharacters(await collectSourceTexts());
const charset = buildCharset(required);
const subset = await subsetFont(await readFile(sourceFont), charset, { targetFormat: 'woff2' });

await writeFile(outputFont, subset);
await writeFile(outputCharset, charset, 'utf8');

const sha256 = createHash('sha256').update(subset).digest('hex');
console.log(
  `子集完成：${required.length} 个非 ASCII 字符，共 ${charset.length} 字形，` +
    `${(subset.byteLength / 1024).toFixed(1)}KB`,
);
console.log(`${relative(projectRoot, outputFont)} sha256 = ${sha256}`);
console.log(
  `${relative(projectRoot, outputCharset)} sha256 = ` +
    createHash('sha256').update(charset, 'utf8').digest('hex'),
);
