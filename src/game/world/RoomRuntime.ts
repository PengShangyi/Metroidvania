import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import type { ActionSnapshot } from '../input/actions';
import type { Player } from '../player/Player';
import type { GameSessionState } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';
import { meetsRequirement } from './progression';
import type { RoomRepository } from './RoomRepository';
import type { ExitDefinition, RoomDefinition } from './types';

type ExitHandler = (exit: ExitDefinition) => void;

export class RoomRuntime {
  private readonly scene: Phaser.Scene;
  private readonly repository: RoomRepository;
  private readonly session: GameSessionState;
  private room!: RoomDefinition;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private collider?: Phaser.Physics.Arcade.Collider;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private messageToken = 0;

  public constructor(scene: Phaser.Scene, repository: RoomRepository, session: GameSessionState) {
    this.scene = scene;
    this.repository = repository;
    this.session = session;
  }

  public load(roomId: string, spawnId: string, player: Player): void {
    this.clearRoom();
    this.room = this.repository.get(roomId);
    const spawn =
      this.room.spawns.find((candidate) => candidate.id === spawnId) ?? this.room.spawns[0];
    if (!spawn) throw new Error(`房间 ${roomId} 没有有效生成点`);

    this.drawBackground(this.room);
    this.platforms = this.scene.physics.add.staticGroup();
    for (const definition of this.room.platforms) {
      const platform = this.platforms
        .create(definition.x + definition.width / 2, definition.y + definition.height / 2, 'pixel')
        .setDisplaySize(definition.width, definition.height)
        .setTint(this.platformColor(this.room));
      platform.refreshBody();
    }
    this.collider = this.scene.physics.add.collider(player, this.platforms);
    player.setPosition(spawn.x, spawn.y).setVelocity(0, 0).setAcceleration(0, 0);

    for (const exit of this.room.exits) this.drawExit(exit);
    if (this.room.checkpoint) {
      this.roomObjects.push(
        this.scene.add
          .image(this.room.checkpoint.x, this.room.checkpoint.y, 'terminal')
          .setOrigin(0.5, 1),
      );
    }

    const title = this.scene.add
      .text(12, 244, `${this.room.name} // ${this.room.id}`, bodyTextStyle('#7184a8'))
      .setDepth(8);
    this.roomObjects.push(title);
    this.showMessage(this.room.name, 900);
  }

  public update(player: Player, input: ActionSnapshot, onExit: ExitHandler): void {
    const overlappingExit = this.room.exits.find((exit) =>
      Phaser.Geom.Rectangle.Contains(
        new Phaser.Geom.Rectangle(exit.x, exit.y, exit.width, exit.height),
        player.x,
        player.y - 12,
      ),
    );

    if (overlappingExit) {
      const unlocked = meetsRequirement(
        overlappingExit.requirement,
        this.session.abilities,
        this.session.bossDefeated,
      );
      if (input.pressed.interact) {
        if (unlocked) onExit(overlappingExit);
        else this.showMessage(this.requirementMessage(overlappingExit.requirement), 1200);
      } else if (this.registryMessageEmpty()) {
        this.showMessage(
          unlocked ? 'E：进入通道' : this.requirementMessage(overlappingExit.requirement),
          400,
        );
      }
      return;
    }

    const checkpoint = this.room.checkpoint;
    if (
      checkpoint &&
      Phaser.Math.Distance.Between(player.x, player.y, checkpoint.x, checkpoint.y) < 34
    ) {
      if (input.pressed.interact) {
        this.session.checkpointRoomId = this.room.id;
        this.session.checkpointSpawnId = checkpoint.spawnId;
        this.session.health = this.session.maxHealth;
        this.showMessage('终端同步完成 · 生命已恢复', 1500);
      } else if (this.registryMessageEmpty()) {
        this.showMessage('E：同步终端', 400);
      }
    }
  }

  public destroy(): void {
    this.clearRoom();
    this.clearMessage();
  }

  private drawBackground(room: RoomDefinition): void {
    const palette =
      room.biome === 'vestibule'
        ? { base: 0x07101d, haze: 0x163459, light: COLORS.amber }
        : room.biome === 'bioforge'
          ? { base: 0x0b1020, haze: 0x193b3f, light: 0xed63d6 }
          : { base: 0x030712, haze: 0x102c42, light: COLORS.cyan };
    this.scene.cameras.main.setBackgroundColor(palette.base);

    const graphics = this.scene.add.graphics().setDepth(-10);
    graphics.fillStyle(palette.haze, 0.55).fillRect(0, 0, room.width, room.height);
    graphics.lineStyle(2, palette.light, 0.12);
    for (let x = 24; x < room.width; x += 64) graphics.strokeRect(x, 18, 30, 208);
    graphics.fillStyle(palette.light, 0.07);
    graphics.fillCircle(240, 126, room.biome === 'reactor' ? 100 : 56);
    this.roomObjects.push(graphics);
  }

  private drawExit(exit: ExitDefinition): void {
    const unlocked = meetsRequirement(
      exit.requirement,
      this.session.abilities,
      this.session.bossDefeated,
    );
    const door = this.scene.add.rectangle(
      exit.x,
      exit.y,
      exit.width,
      exit.height,
      unlocked ? COLORS.cyan : COLORS.danger,
      0.16,
    );
    door.setOrigin(0).setStrokeStyle(1, unlocked ? COLORS.cyan : COLORS.danger, 0.85);
    this.roomObjects.push(door);
  }

  private platformColor(room: RoomDefinition): number {
    if (room.biome === 'bioforge') return 0x294a4d;
    if (room.biome === 'reactor') return 0x1e405c;
    return COLORS.steel;
  }

  private requirementMessage(requirement: ExitDefinition['requirement']): string {
    if (requirement === 'phaseDash') return '通道需要：相位冲刺';
    if (requirement === 'magneticGrip') return '通道需要：磁附跃迁';
    if (requirement === 'bossDefeated') return '核心仍处于封锁状态';
    return '';
  }

  private showMessage(message: string, duration: number): void {
    this.messageToken += 1;
    const token = this.messageToken;
    this.scene.registry.set(REGISTRY_KEYS.runtimeMessage, message);
    this.scene.time.delayedCall(duration, () => {
      if (token === this.messageToken) this.clearMessage();
    });
  }

  private registryMessageEmpty(): boolean {
    return !this.scene.registry.get(REGISTRY_KEYS.runtimeMessage);
  }

  private clearMessage(): void {
    this.scene.registry.set(REGISTRY_KEYS.runtimeMessage, '');
  }

  private clearRoom(): void {
    this.collider?.destroy();
    this.platforms?.clear(true, true);
    for (const object of this.roomObjects) object.destroy();
    this.roomObjects = [];
  }
}
