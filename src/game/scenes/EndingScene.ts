import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle, titleTextStyle } from '../ui/text';

export class EndingScene extends Phaser.Scene {
  public constructor() {
    super('ending');
  }

  public create(): void {
    const session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.add.text(240, 82, '信号归于寂静', titleTextStyle()).setOrigin(0.5);
    this.add
      .text(240, 132, `任务用时 ${this.formatTime(session.elapsedMs)}`, bodyTextStyle('#8ce7ff'))
      .setOrigin(0.5);
    this.add.text(240, 164, '按 ENTER 返回标题', bodyTextStyle('#ffb454')).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('title'));
  }

  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
