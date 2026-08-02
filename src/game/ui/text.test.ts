import { describe, expect, it } from 'vitest';

import { PROSE_FONT_FACE, UI_FONT_FACE } from './fontLoader';
import {
  headingTextStyle,
  hudTextStyle,
  MIN_PIXEL_FONT_SIZE,
  MIN_PROSE_FONT_SIZE,
  PIXEL_FONT_FAMILY,
  PIXEL_FONT_GRID,
  PIXEL_SIZES,
  PROSE_FONT_FAMILY,
  PROSE_SIZES,
  proseTextStyle,
  TEXT_RESOLUTION,
  titleTextStyle,
} from './text';

const ALL_STYLES = [hudTextStyle(), headingTextStyle(), titleTextStyle(), proseTextStyle()];

describe('双字体类型阶梯', () => {
  it('像素字体只用 12 的整数倍字号', () => {
    for (const size of Object.values(PIXEL_SIZES)) {
      expect(size % PIXEL_FONT_GRID).toBe(0);
    }
    expect(hudTextStyle().fontSize).toBe(`${PIXEL_SIZES.label}px`);
    expect(headingTextStyle().fontSize).toBe(`${PIXEL_SIZES.heading}px`);
    expect(titleTextStyle().fontSize).toBe(`${PIXEL_SIZES.title}px`);
  });

  it('两族各自的可读下限', () => {
    // 960×540 下 24px 像素字与旧版 480×270 下的 12px 观感等大；矢量字有真实抗锯齿，
    // 所以能压到 16px 而不牺牲辨识度。
    expect(MIN_PIXEL_FONT_SIZE).toBe(24);
    expect(MIN_PROSE_FONT_SIZE).toBe(16);
    expect(Math.min(...Object.values(PIXEL_SIZES))).toBe(MIN_PIXEL_FONT_SIZE);
    expect(Math.min(...Object.values(PROSE_SIZES))).toBe(MIN_PROSE_FONT_SIZE);
  });

  it('所有样式都不缩放、不合成粗体、不加阴影', () => {
    for (const style of ALL_STYLES) {
      expect(style.resolution).toBe(TEXT_RESOLUTION);
      expect(style.fontStyle).toBe('normal');
      expect(style.shadow).toBeUndefined();
    }
    expect(TEXT_RESOLUTION).toBe(1);
  });

  it('每族都把自己的字面排在简体中文回退之前', () => {
    expect(PIXEL_FONT_FAMILY.startsWith(`"${UI_FONT_FACE}"`)).toBe(true);
    expect(PROSE_FONT_FAMILY.startsWith(`"${PROSE_FONT_FACE}"`)).toBe(true);
    for (const family of [PIXEL_FONT_FAMILY, PROSE_FONT_FAMILY]) {
      expect(family).toContain('PingFang SC');
      expect(family).toContain('Microsoft YaHei');
      expect(family).toContain('Noto Sans CJK SC');
    }
    expect(hudTextStyle().fontFamily).toBe(PIXEL_FONT_FAMILY);
    expect(headingTextStyle().fontFamily).toBe(PIXEL_FONT_FAMILY);
    expect(titleTextStyle().fontFamily).toBe(PIXEL_FONT_FAMILY);
    expect(proseTextStyle().fontFamily).toBe(PROSE_FONT_FAMILY);
  });

  it('正文字号可选，默认走 body', () => {
    expect(proseTextStyle().fontSize).toBe(`${PROSE_SIZES.body}px`);
    expect(proseTextStyle('#fff', 'caption').fontSize).toBe(`${PROSE_SIZES.caption}px`);
    expect(proseTextStyle('#fff', 'lead').fontSize).toBe(`${PROSE_SIZES.lead}px`);
    expect(proseTextStyle('#8ce7ff').color).toBe('#8ce7ff');
  });
});
