import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';

export class PlayScene extends Phaser.Scene {
  private session!: GameSessionState;

  public constructor() {
    super('play');
  }

  public create(): void {
    this.session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.scene.launch('hud');

    this.add
      .text(240, 118, '坠星船坞', {
        ...bodyTextStyle('#8ce7ff'),
        fontSize: '14px',
      })
      .setOrigin(0.5);
    this.add.text(240, 145, '空间拓扑同步中', bodyTextStyle('#7184a8')).setOrigin(0.5);
  }

  public update(_time: number, delta: number): void {
    this.session.elapsedMs += delta;
  }
}
