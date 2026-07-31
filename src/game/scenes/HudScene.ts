import Phaser from 'phaser';

import { REGISTRY_KEYS } from '../constants';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';

export class HudScene extends Phaser.Scene {
  private healthText!: Phaser.GameObjects.Text;

  public constructor() {
    super('hud');
  }

  public create(): void {
    this.healthText = this.add.text(12, 10, '', bodyTextStyle('#d8f7ff')).setScrollFactor(0);
    this.add
      .text(468, 10, 'TAB 地图  ·  ESC 暂停', bodyTextStyle('#7184a8'))
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }

  public update(): void {
    const session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.healthText.setText(`生命 ${session.health}/${session.maxHealth}`);
  }
}
