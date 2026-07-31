import { describe, expect, it } from 'vitest';

import {
  bodyTextStyle,
  FONT_FAMILY,
  MIN_BODY_FONT_SIZE,
  TEXT_RESOLUTION,
  titleTextStyle,
} from './text';
import { UI_FONT_FACE } from './fontLoader';

describe('low-resolution text styles', () => {
  it('keeps body copy above the readable size and raster resolution floors', () => {
    const style = bodyTextStyle();

    expect(MIN_BODY_FONT_SIZE).toBe(12);
    expect(style.fontSize).toBe(`${MIN_BODY_FONT_SIZE}px`);
    expect(style.resolution).toBe(1);
    expect(style.fontStyle).toBe('normal');
    expect(style.shadow).toBeUndefined();
  });

  it('uses the bundled pixel face before explicit Simplified Chinese fallbacks', () => {
    expect(FONT_FAMILY).toContain(UI_FONT_FACE);
    expect(FONT_FAMILY).toContain('PingFang SC');
    expect(FONT_FAMILY).toContain('Microsoft YaHei');
    expect(FONT_FAMILY).toContain('Noto Sans CJK SC');
    expect(titleTextStyle().resolution).toBe(TEXT_RESOLUTION);
    expect(titleTextStyle().fontSize).toBe('24px');
  });
});
