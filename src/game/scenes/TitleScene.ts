import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { createNewSession } from '../state/GameSession';
import { bodyTextStyle, titleTextStyle } from '../ui/text';
import { bindFullscreenKey } from '../ui/fullscreen';

export class TitleScene extends Phaser.Scene {
  public constructor() {
    super('title');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.drawBackdrop();
    bindFullscreenKey(this);

    this.add.text(240, 62, '星骸回声', titleTextStyle()).setOrigin(0.5);
    this.add.text(240, 90, 'STAR ECHO // v0.1.0', bodyTextStyle('#7184a8')).setOrigin(0.5);

    const start = this.add
      .text(240, 145, '开始回收任务', {
        ...bodyTextStyle('#07101d'),
        backgroundColor: '#43d8e8',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const launch = (): void => {
      this.registry.set(REGISTRY_KEYS.session, createNewSession());
      this.scene.start('play');
    };

    start.on('pointerdown', launch);
    this.input.keyboard?.once('keydown-ENTER', launch);
    this.input.keyboard?.once('keydown-SPACE', launch);

    this.add
      .text(240, 194, 'A/D 移动  ·  SPACE 跳跃  ·  J 射击  ·  K 近战', bodyTextStyle('#8da1c8'))
      .setOrigin(0.5);
    this.add.text(240, 214, 'ENTER / SPACE 开始', bodyTextStyle('#ffb454')).setOrigin(0.5);
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.steel, 0.22);
    for (let x = 24; x < 480; x += 48) graphics.fillRect(x, 0, 2, 270);
    graphics.lineStyle(1, COLORS.cyan, 0.2);
    graphics.strokeCircle(240, 134, 94);
    graphics.strokeCircle(240, 134, 118);
    graphics.fillStyle(COLORS.cyan, 0.08);
    graphics.fillCircle(240, 134, 72);
  }
}
