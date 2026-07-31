import Phaser from 'phaser';

import { CombatSystem } from '../combat/CombatSystem';
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
  private combat!: CombatSystem;
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
    this.combat = new CombatSystem(this, this.player, this.session, () => this.respawn());
    this.loadRoom(this.session.currentRoomId, this.session.checkpointSpawnId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.roomRuntime.destroy();
      this.combat.destroy();
      this.scene.stop('hud');
    });
  }

  public update(_time: number, delta: number): void {
    const input = this.controls.update();
    if (!this.transitioning) {
      this.player.updateMovement(delta, input);
      this.roomRuntime.update(this.player, input, (exit) => this.transition(exit));
      this.combat.update(input);
      if (this.roomRuntime.isTouchingHazard(this.player)) {
        if (this.combat.damagePlayer(1)) this.roomRuntime.returnPlayerToSafety(this.player);
      }
    }
    this.session.elapsedMs += delta;
  }

  private loadRoom(roomId: string, spawnId: string): void {
    this.session.currentRoomId = roomId;
    this.session.visitedRooms.add(roomId);
    this.roomRuntime.load(roomId, spawnId, this.player);
    this.combat.bindWorld(this.roomRuntime.collisionPlatforms);
    this.cameras.main.setBounds(0, 0, 480, 270);
    this.physics.world.setBounds(0, 0, 480, 270);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  private transition(exit: ExitDefinition): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.combat.clearTransient();
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

  private respawn(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.combat.clearTransient();
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.cameras.main.fadeOut(220, 255, 86, 120);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.session.health = this.session.maxHealth;
      this.loadRoom(this.session.checkpointRoomId, this.session.checkpointSpawnId);
      (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
      this.cameras.main.fadeIn(240, 7, 11, 24);
      this.registry.set(REGISTRY_KEYS.runtimeMessage, '外骨骼已由终端重构');
      this.time.delayedCall(280, () => {
        this.transitioning = false;
      });
    });
  }
}
