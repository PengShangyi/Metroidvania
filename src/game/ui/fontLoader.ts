export const UI_FONT_FACE = 'Fusion Pixel 12';
/**
 * 正文用的矢量中文字体，来源是 Noto Sans CJK SC 的子集。
 *
 * 故意不沿用上游名字：`document.fonts.check('20px "Noto Sans SC"')` 对系统里装了
 * 同名字体的机器会返回 true，自带子集加载失败时守卫就会静默放行——最后只在 CI
 * 截图里表现为豆腐块。@font-face 的 family 本来就是任意标签，用项目独占的名字
 * 才能让这条检查真的只认我们加载的那份文件。
 */
export const PROSE_FONT_FACE = 'Star Echo Sans SC';
export const UI_FONT_DESCRIPTOR = `24px "${UI_FONT_FACE}"`;
export const PROSE_FONT_DESCRIPTOR = `20px "${PROSE_FONT_FACE}"`;
export const UI_FONT_PROBE = '星骸回声帮助控制训练冲刺反射贯穿守核者地图设置';

export interface UIFontSet {
  load(font: string, text?: string): Promise<readonly unknown[]>;
  check(font: string, text?: string): boolean;
}

export async function ensureUIFonts(fonts: UIFontSet): Promise<void> {
  await ensureFace(fonts, UI_FONT_DESCRIPTOR, '简体中文像素界面字体未能完成加载');
  await ensureFace(fonts, PROSE_FONT_DESCRIPTOR, '简体中文正文字体未能完成加载');
}

async function ensureFace(fonts: UIFontSet, descriptor: string, message: string): Promise<void> {
  const loaded = await fonts.load(descriptor, UI_FONT_PROBE);
  if (loaded.length === 0 || !fonts.check(descriptor, UI_FONT_PROBE)) {
    throw new Error(message);
  }
}
