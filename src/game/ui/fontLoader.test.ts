import { describe, expect, it, vi } from 'vitest';

import {
  ensureUIFonts,
  PROSE_FONT_DESCRIPTOR,
  PROSE_FONT_FACE,
  UI_FONT_DESCRIPTOR,
  UI_FONT_FACE,
  UI_FONT_PROBE,
  type UIFontSet,
} from './fontLoader';

describe('UI font loading', () => {
  it('两套字体都就绪之后才允许启动', async () => {
    const fonts: UIFontSet = {
      load: vi.fn().mockResolvedValue([{}]),
      check: vi.fn().mockReturnValue(true),
    };

    await ensureUIFonts(fonts);

    expect(fonts.load).toHaveBeenCalledWith(UI_FONT_DESCRIPTOR, UI_FONT_PROBE);
    expect(fonts.load).toHaveBeenCalledWith(PROSE_FONT_DESCRIPTOR, UI_FONT_PROBE);
    expect(fonts.check).toHaveBeenCalledWith(UI_FONT_DESCRIPTOR, UI_FONT_PROBE);
    expect(fonts.check).toHaveBeenCalledWith(PROSE_FONT_DESCRIPTOR, UI_FONT_PROBE);
  });

  it('像素字体缺失时按像素字体报错', async () => {
    const fonts: UIFontSet = {
      load: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockReturnValue(false),
    };

    await expect(ensureUIFonts(fonts)).rejects.toThrow('简体中文像素界面字体未能完成加载');
  });

  it('只有正文字体缺失时报出正文字体，而不是笼统失败', async () => {
    const fonts: UIFontSet = {
      load: vi.fn(async (descriptor: string) => (descriptor === PROSE_FONT_DESCRIPTOR ? [] : [{}])),
      check: vi.fn((descriptor: string) => descriptor !== PROSE_FONT_DESCRIPTOR),
    };

    await expect(ensureUIFonts(fonts)).rejects.toThrow('简体中文正文字体未能完成加载');
  });

  it('正文字体不沿用上游名字，避免命中系统里的同名字体', () => {
    expect(PROSE_FONT_FACE).toBe('Star Echo Sans SC');
    expect(PROSE_FONT_FACE).not.toContain('Noto');
    expect(UI_FONT_FACE).toBe('Fusion Pixel 12');
  });
});
