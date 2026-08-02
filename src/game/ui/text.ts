import type Phaser from 'phaser';

import { PROSE_FONT_FACE, UI_FONT_FACE } from './fontLoader';

export const PIXEL_FONT_FAMILY =
  `"${UI_FONT_FACE}", "PingFang SC", "Microsoft YaHei", ` +
  '"Noto Sans CJK SC", "Noto Sans SC", sans-serif';
export const PROSE_FONT_FAMILY =
  `"${PROSE_FONT_FACE}", "PingFang SC", "Microsoft YaHei", ` +
  '"Noto Sans CJK SC", "Noto Sans SC", sans-serif';

/**
 * 恒为 1，不要调高。
 *
 * antialias 关着时 Phaser 把 Text 的画布纹理硬编码成 gl.NEAREST
 * （WebGLRenderer.canvasToTexture），而 TextWebGLRenderer 又按 width / resolution
 * 画四边形——resolution: 2 得到的是 2:1 点采样降采样，比 1 更糊。而且 Text 每次
 * setText 都会重传纹理，手动 setFilter(LINEAR) 会被立刻冲掉。
 * 清晰度来自 960×540 的背板加矢量字体的真实灰度抗锯齿，不来自倍率。
 */
export const TEXT_RESOLUTION = 1;

/** 像素字体的字形网格。非整数倍字号会出现半像素笔画。 */
export const PIXEL_FONT_GRID = 12;
export const PIXEL_SIZES = { label: 24, heading: 36, title: 48 } as const;
export const PROSE_SIZES = { caption: 16, body: 20, lead: 24 } as const;
export const MIN_PIXEL_FONT_SIZE = PIXEL_SIZES.label;
export const MIN_PROSE_FONT_SIZE = PROSE_SIZES.caption;

export type ProseSize = keyof typeof PROSE_SIZES;

/** 定宽短内容：数值、按键胶囊、菜单按钮、区域名、Boss 血条的菱形格。 */
export function hudTextStyle(color = '#d8f7ff'): Phaser.Types.GameObjects.Text.TextStyle {
  return pixelStyle(color, PIXEL_SIZES.label, 6);
}

export function headingTextStyle(color = '#d8f7ff'): Phaser.Types.GameObjects.Text.TextStyle {
  return pixelStyle(color, PIXEL_SIZES.heading, 8);
}

export function titleTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    ...pixelStyle('#d8f7ff', PIXEL_SIZES.title, 0),
    letterSpacing: 6,
    stroke: '#07101d',
    strokeThickness: 4,
  };
}

/** 成段中文：帮助说明、结局、教学目标、提示 toast。 */
export function proseTextStyle(
  color = '#d8f7ff',
  size: ProseSize = 'body',
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: PROSE_FONT_FAMILY,
    fontSize: `${PROSE_SIZES[size]}px`,
    fontStyle: 'normal',
    lineSpacing: Math.round(PROSE_SIZES[size] * 0.45),
    resolution: TEXT_RESOLUTION,
  };
}

function pixelStyle(
  color: string,
  fontSize: number,
  lineSpacing: number,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: PIXEL_FONT_FAMILY,
    fontSize: `${fontSize}px`,
    fontStyle: 'normal',
    lineSpacing,
    resolution: TEXT_RESOLUTION,
  };
}
