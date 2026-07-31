import type Phaser from 'phaser';

export const FONT_FAMILY = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

export function bodyTextStyle(color = '#d8f7ff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: FONT_FAMILY,
    fontSize: '8px',
    lineSpacing: 3,
  };
}

export function titleTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color: '#d8f7ff',
    fontFamily: FONT_FAMILY,
    fontSize: '28px',
    fontStyle: 'bold',
    letterSpacing: 4,
  };
}
