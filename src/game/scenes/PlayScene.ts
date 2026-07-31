import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { InputController } from '../input/InputController';
import { Player } from '../player/Player';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';
import { bindFullscreenKey } from '../ui/fullscreen';

export class PlayScene extends Phaser.Scene {
  private session!: GameSessionState;
  private controls!: InputController;
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

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

    this.createTestChamber();
    this.player = new Player(this, 64, 200);
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, 480, 270);
    this.physics.world.setBounds(0, 0, 480, 270);

    this.add.text(12, 242, '坠星船坞 // 移动校准', bodyTextStyle('#7184a8'));
  }

  public update(_time: number, delta: number): void {
    const input = this.controls.update();
    this.player.updateMovement(delta, input);
    this.session.elapsedMs += delta;
  }

  private createTestChamber(): void {
    this.platforms = this.physics.add.staticGroup();
    for (let x = 0; x < 30; x += 1) this.platforms.create(x * 16 + 8, 262, 'tile');
    for (let x = 8; x < 15; x += 1) this.platforms.create(x * 16 + 8, 214, 'tile');
    for (let x = 19; x < 25; x += 1) this.platforms.create(x * 16 + 8, 174, 'tile');
  }
}
