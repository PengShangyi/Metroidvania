import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { InputController } from '../input/InputController';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';
import { bindFullscreenKey } from '../ui/fullscreen';

export class PlayScene extends Phaser.Scene {
  private session!: GameSessionState;
  private controls!: InputController;

  public constructor() {
    super('play');
  }

  public create(): void {
    this.session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.scene.launch('hud');
    bindFullscreenKey(this);
    this.controls = new InputController(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.controls.destroy());

    this.add
      .text(240, 118, '坠星船坞', {
        ...bodyTextStyle('#8ce7ff'),
        fontSize: '14px',
      })
      .setOrigin(0.5);
    this.add.text(240, 145, '空间拓扑同步中', bodyTextStyle('#7184a8')).setOrigin(0.5);
  }

  public update(_time: number, delta: number): void {
    this.controls.update();
    this.session.elapsedMs += delta;
  }
}
