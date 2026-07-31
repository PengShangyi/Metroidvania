import type Phaser from 'phaser';

export const FONT_FAMILY =
  '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
export const TEXT_RESOLUTION = 2;
export const MIN_BODY_FONT_SIZE = 10;

export function bodyTextStyle(color = '#d8f7ff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: FONT_FAMILY,
    fontSize: `${MIN_BODY_FONT_SIZE}px`,
    fontStyle: 'bold',
    lineSpacing: 4,
    resolution: TEXT_RESOLUTION,
    shadow: {
      offsetX: 1,
      offsetY: 1,
      color: '#03050d',
      blur: 0,
      stroke: false,
      fill: true,
    },
  };
}

export function titleTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color: '#d8f7ff',
    fontFamily: FONT_FAMILY,
    fontSize: '28px',
    fontStyle: 'bold',
    letterSpacing: 4,
    resolution: TEXT_RESOLUTION,
    stroke: '#07101d',
    strokeThickness: 2,
  };
}
