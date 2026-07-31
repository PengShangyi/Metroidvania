import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { InputController } from '../input/InputController';
import { Player } from '../player/Player';
import type { GameSessionState } from '../state/GameSession';
import { bindFullscreenKey } from '../ui/fullscreen';
import { RoomRepository } from '../world/RoomRepository';
import { RoomRuntime } from '../world/RoomRuntime';
import type { ExitDefinition } from '../world/types';

export class PlayScene extends Phaser.Scene {
  private session!: GameSessionState;
  private controls!: InputController;
  private player!: Player;
  private rooms!: RoomRepository;
  private roomRuntime!: RoomRuntime;
  private transitioning = false;

  public constructor() {
    super('play');
  }

  public create(): void {
    this.session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.scene.launch('hud');
    bindFullscreenKey(this);

    this.controls = new InputController(this);
    this.rooms = new RoomRepository();
    this.player = new Player(this, 0, 0);
    this.roomRuntime = new RoomRuntime(this, this.rooms, this.session);
    this.loadRoom(this.session.currentRoomId, this.session.checkpointSpawnId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.roomRuntime.destroy();
      this.scene.stop('hud');
    });
  }

  public update(_time: number, delta: number): void {
    const input = this.controls.update();
    if (!this.transitioning) {
      this.player.updateMovement(delta, input);
      this.roomRuntime.update(this.player, input, (exit) => this.transition(exit));
    }
    this.session.elapsedMs += delta;
  }

  private loadRoom(roomId: string, spawnId: string): void {
    this.session.currentRoomId = roomId;
    this.session.visitedRooms.add(roomId);
    this.roomRuntime.load(roomId, spawnId, this.player);
    this.cameras.main.setBounds(0, 0, 480, 270);
    this.physics.world.setBounds(0, 0, 480, 270);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  private transition(exit: ExitDefinition): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.cameras.main.fadeOut(140, 7, 11, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadRoom(exit.targetRoomId, exit.targetSpawnId);
      (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
      this.cameras.main.fadeIn(140, 7, 11, 24);
      this.time.delayedCall(140, () => {
        this.transitioning = false;
      });
    });
  }
}
