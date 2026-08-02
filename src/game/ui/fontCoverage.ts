/**
 * 正文矢量字体是按项目实际用到的字符做的子集，所以「源码里出现了一个新汉字」
 * 等价于「运行时会渲染出豆腐块」。这里把判定抽成纯函数，
 * 由 fontCoverage.test.ts（进 pnpm check）和 scripts/generate-ui-font-subset.mjs 共用。
 */

/** 会出现玩家可见文案的源文件类型。生成脚本与覆盖率测试必须扫同一批，否则会漏字。 */
export const SCANNED_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.json']);

/** 子集必须收录的字符：ASCII 之外的一切。ASCII 可打印区由脚本无条件补齐。 */
export function collectRequiredCharacters(sources: readonly string[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    for (const character of source) {
      const code = character.codePointAt(0) ?? 0;
      if (code <= 0x7f) continue;
      found.add(character);
    }
  }
  return [...found].sort();
}

export function missingCharacters(required: readonly string[], charset: string): string[] {
  const available = new Set([...charset]);
  return required.filter((character) => !available.has(character));
}

/** ASCII 可打印区：数值、按键名与标点都靠它，任何字体都有，直接无条件收进子集。 */
export function asciiPrintable(): string {
  let text = '';
  for (let code = 0x20; code <= 0x7e; code += 1) text += String.fromCodePoint(code);
  return text;
}

export function buildCharset(required: readonly string[]): string {
  return [...new Set([...asciiPrintable(), ...required])].sort().join('');
}
