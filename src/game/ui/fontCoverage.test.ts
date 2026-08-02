import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SCANNED_EXTENSIONS,
  asciiPrintable,
  buildCharset,
  collectRequiredCharacters,
  missingCharacters,
} from './fontCoverage';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const charsetPath = join(
  projectRoot,
  'public',
  'assets',
  'fonts',
  'star-echo-sans-sc-subset.charset.txt',
);

describe('正文字体子集覆盖率', () => {
  it('源码里的每个非 ASCII 字符都在子集里', async () => {
    const required = collectRequiredCharacters(await readSourceTexts());
    const charset = await readFile(charsetPath, 'utf8');
    const missing = missingCharacters(required, charset);

    expect(
      missing,
      `以下字符不在正文字体子集里，运行时会渲染成豆腐块：${missing.join('')}\n` +
        '改完文案后请执行 pnpm art:font 重新生成，并同步 validate-assets.mjs 里的校验和。',
    ).toEqual([]);
  });

  it('子集不会无限膨胀', async () => {
    // 只卡上限、不要求精确相等：删掉一句中文注释就让二进制字体重新生成，
    // 会给无关改动带来没必要的 diff。少量残留字形不影响正确性。
    const required = collectRequiredCharacters(await readSourceTexts());
    const charset = await readFile(charsetPath, 'utf8');
    const unused = [...charset].filter(
      (character) => (character.codePointAt(0) ?? 0) > 0x7f && !required.includes(character),
    );

    expect(
      unused.length,
      `子集里有 ${unused.length} 个已无人使用的字形：${unused.join('')}`,
    ).toBeLessThanOrEqual(64);
  });
});

describe('覆盖率判定本身', () => {
  it('只挑出非 ASCII 字符', () => {
    expect(collectRequiredCharacters(['abc 123 ~!', '星骸'])).toEqual(['星', '骸']);
  });

  it('缺字时逐个报出来', () => {
    expect(missingCharacters(['星', '骸'], '星回声')).toEqual(['骸']);
    expect(missingCharacters(['星'], '星回声')).toEqual([]);
  });

  it('字符集总是包含 ASCII 可打印区并去重排序', () => {
    const charset = buildCharset(['骸', '星', '星']);
    expect(charset).toContain(asciiPrintable());
    expect(charset.endsWith('星骸')).toBe(true);
    expect(new Set([...charset]).size).toBe(charset.length);
  });
});

async function readSourceTexts(): Promise<string[]> {
  const texts = [await readFile(join(projectRoot, 'index.html'), 'utf8')];
  const walk = async (directory: string): Promise<void> => {
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
