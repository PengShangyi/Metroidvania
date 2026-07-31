import { describe, expect, it, vi } from 'vitest';

import { ensureUIFont, UI_FONT_DESCRIPTOR, UI_FONT_PROBE, type UIFontSet } from './fontLoader';

describe('UI font loading', () => {
  it('waits for the bundled Simplified Chinese face before booting', async () => {
    const fonts: UIFontSet = {
      load: vi.fn().mockResolvedValue([{}]),
      check: vi.fn().mockReturnValue(true),
    };

    await ensureUIFont(fonts);

    expect(fonts.load).toHaveBeenCalledWith(UI_FONT_DESCRIPTOR, UI_FONT_PROBE);
    expect(fonts.check).toHaveBeenCalledWith(UI_FONT_DESCRIPTOR, UI_FONT_PROBE);
  });

  it('rejects an unavailable face instead of drawing permanent fallback glyphs', async () => {
    const fonts: UIFontSet = {
      load: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockReturnValue(false),
    };

    await expect(ensureUIFont(fonts)).rejects.toThrow('简体中文 UI 字体未能完成加载');
  });
});
