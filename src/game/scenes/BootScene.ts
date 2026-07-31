import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { createNewSession } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.registry.set(REGISTRY_KEYS.session, createNewSession());

    const status = this.add
      .text(240, 135, '正在校准星骸信标…', bodyTextStyle('#8ce7ff'))
      .setOrigin(0.5);

    this.time.delayedCall(120, () => {
      status.destroy();
      this.scene.start('title');
    });
  }
}
