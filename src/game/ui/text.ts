import type Phaser from 'phaser';

import { UI_FONT_FACE } from './fontLoader';

export const FONT_FAMILY =
  `"${UI_FONT_FACE}", "PingFang SC", "Microsoft YaHei", ` +
  '"Noto Sans CJK SC", "Noto Sans SC", sans-serif';
export const TEXT_RESOLUTION = 1;
export const MIN_BODY_FONT_SIZE = 12;

export function bodyTextStyle(color = '#d8f7ff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: FONT_FAMILY,
    fontSize: `${MIN_BODY_FONT_SIZE}px`,
    fontStyle: 'normal',
    lineSpacing: 3,
    resolution: TEXT_RESOLUTION,
  };
}

export function titleTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color: '#d8f7ff',
    fontFamily: FONT_FAMILY,
    fontSize: '24px',
    fontStyle: 'normal',
    letterSpacing: 3,
    resolution: TEXT_RESOLUTION,
    stroke: '#07101d',
    strokeThickness: 2,
  };
}
