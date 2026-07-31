import Phaser from 'phaser';

import { REGISTRY_KEYS } from '../constants';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';

export class HudScene extends Phaser.Scene {
  private healthText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;

  public constructor() {
    super('hud');
  }

  public create(): void {
    this.healthText = this.add.text(12, 10, '', bodyTextStyle('#d8f7ff')).setScrollFactor(0);
    this.add
      .text(468, 10, 'TAB 地图  ·  ESC 暂停', bodyTextStyle('#7184a8'))
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.messageText = this.add
      .text(240, 238, '', {
        ...bodyTextStyle('#d8f7ff'),
        backgroundColor: '#07101dcc',
        padding: { x: 8, y: 5 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.bossText = this.add
      .text(240, 16, '', {
        ...bodyTextStyle('#ffb454'),
        backgroundColor: '#07101dcc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
  }

  public update(): void {
    const session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.healthText.setText(`生命 ${session.health}/${session.maxHealth}`);
    this.messageText.setText((this.registry.get(REGISTRY_KEYS.runtimeMessage) as string) ?? '');
    this.messageText.setVisible(this.messageText.text.length > 0);
    const bossHealth = this.registry.get(REGISTRY_KEYS.bossHealth) as number | undefined;
    const bossPhase = this.registry.get(REGISTRY_KEYS.bossPhase) as number | undefined;
    if (typeof bossHealth === 'number' && bossHealth > 0) {
      const cells = Math.ceil(bossHealth / 2);
      this.bossText.setText(
        `守核者 Λ  ${'◆'.repeat(cells)}${'◇'.repeat(15 - cells)}  P${bossPhase ?? 1}`,
      );
      this.bossText.setVisible(true);
    } else {
      this.bossText.setVisible(false);
    }
  }
}
