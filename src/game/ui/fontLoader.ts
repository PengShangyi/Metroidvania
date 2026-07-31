export const UI_FONT_FACE = 'Fusion Pixel 12';
export const UI_FONT_DESCRIPTOR = `12px "${UI_FONT_FACE}"`;
export const UI_FONT_PROBE = '星骸回声帮助控制训练冲刺反射贯穿守核者地图设置';

export interface UIFontSet {
  load(font: string, text?: string): Promise<readonly unknown[]>;
  check(font: string, text?: string): boolean;
}

export async function ensureUIFont(fonts: UIFontSet): Promise<void> {
  const loaded = await fonts.load(UI_FONT_DESCRIPTOR, UI_FONT_PROBE);
  if (loaded.length === 0 || !fonts.check(UI_FONT_DESCRIPTOR, UI_FONT_PROBE)) {
    throw new Error('简体中文 UI 字体未能完成加载');
  }
}
