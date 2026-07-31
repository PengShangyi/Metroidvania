import { describe, expect, it } from 'vitest';

import {
  bodyTextStyle,
  FONT_FAMILY,
  MIN_BODY_FONT_SIZE,
  TEXT_RESOLUTION,
  titleTextStyle,
} from './text';

describe('low-resolution text styles', () => {
  it('keeps body copy above the readable size and raster resolution floors', () => {
    const style = bodyTextStyle();

    expect(MIN_BODY_FONT_SIZE).toBeGreaterThanOrEqual(10);
    expect(style.fontSize).toBe(`${MIN_BODY_FONT_SIZE}px`);
    expect(style.resolution).toBeGreaterThanOrEqual(2);
    expect(style.fontStyle).toBe('bold');
  });

  it('uses explicit Simplified Chinese fallbacks for every text tier', () => {
    expect(FONT_FAMILY).toContain('PingFang SC');
    expect(FONT_FAMILY).toContain('Microsoft YaHei');
    expect(FONT_FAMILY).toContain('Noto Sans CJK SC');
    expect(titleTextStyle().resolution).toBe(TEXT_RESOLUTION);
  });
});
