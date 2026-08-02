import Phaser from 'phaser';

import { AUDIO_EVENT } from '../audio/soundDesign';
import { COLORS, REGISTRY_KEYS } from '../constants';
import type { ActionSnapshot } from '../input/actions';
import type { Player } from '../player/Player';
import type { GameSessionState } from '../state/GameSession';
import { exitRequirementMessage, pickupRequirementMessage } from './gateMessages';
import { intersectsAnyHazard } from './hazardRules';
import { meetsRequirement } from './progression';
import type { RoomRepository } from './RoomRepository';
import type { ExitDefinition, PickupDefinition, RoomDefinition } from './types';

type ExitHandler = (exit: ExitDefinition) => void;

/** 能力门未满足的拾取物保持可见但压暗，提示「看得到、拿不到」。 */
const LOCKED_PICKUP_ALPHA = 0.4;

export class RoomRuntime {
  private readonly scene: Phaser.Scene;
  private readonly repository: RoomRepository;
  private readonly session: GameSessionState;
  private room!: RoomDefinition;
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private collider?: Phaser.Physics.Arcade.Collider;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private pickupObjects = new Map<string, Phaser.GameObjects.Image>();
  private exitObjects = new Map<string, Phaser.GameObjects.Rectangle>();
  private messageToken = 0;
  /**
   * 有两个生成点（中央井的 from_spire、花塔的 from_shaft）正落在返回出口的判定区里。
   * 走入即换房的话，进门那一帧就会被原路弹回去，两个房间之间无限往返。
   * 所以进房时先把玩家所在的出口「解除武装」，等他离开判定区再重新启用。
   */
  private disarmedExits = new Set<string>();
  /** 出口矩形是静态数据，在 load() 时建一次就够；update() 每帧为每个出口 new 一个纯属浪费。 */
  private exitBoxes = new Map<string, Phaser.Geom.Rectangle>();
  private safePosition = new Phaser.Math.Vector2();
  private readonly saveProgress: () => boolean;

  public constructor(
    scene: Phaser.Scene,
    repository: RoomRepository,
    session: GameSessionState,
    saveProgress: () => boolean,
  ) {
    this.scene = scene;
    this.repository = repository;
    this.session = session;
    this.saveProgress = saveProgress;
  }

  public load(roomId: string, spawnId: string, player: Player): void {
    this.clearRoom();
    this.room = this.repository.get(roomId);
    const spawn =
      this.room.spawns.find((candidate) => candidate.id === spawnId) ?? this.room.spawns[0];
    if (!spawn) throw new Error(`房间 ${roomId} 没有有效生成点`);

    this.drawBackground(this.room);
    const platforms = this.scene.physics.add.staticGroup();
    this.platforms = platforms;
    for (const definition of this.room.platforms) {
      const platform = platforms
        .create(definition.x + definition.width / 2, definition.y + definition.height / 2, 'pixel')
        .setDisplaySize(definition.width, definition.height)
        .setTint(this.platformColor(this.room));
      const tileKey =
        this.room.biome === 'bioforge'
          ? 'bioforge-tile'
          : this.room.biome === 'reactor'
            ? 'reactor-tile'
            : 'vestibule-tile';
      if (tileKey && this.scene.textures.exists(tileKey)) {
        platform.setVisible(false);
        this.roomObjects.push(
          this.scene.add
            .tileSprite(
              definition.x + definition.width / 2,
              definition.y + definition.height / 2,
              definition.width,
              definition.height,
              tileKey,
            )
            .setDepth(1),
        );
      }
      platform.refreshBody();
    }
    this.collider = this.scene.physics.add.collider(player, platforms);
    player.setPosition(spawn.x, spawn.y).setVelocity(0, 0).setAcceleration(0, 0);
    player.resetTraversalState();
    this.safePosition.set(spawn.x, spawn.y);
    this.disarmedExits.clear();
    this.exitBoxes.clear();
    for (const exit of this.room.exits) {
      const box = new Phaser.Geom.Rectangle(exit.x, exit.y, exit.width, exit.height);
      this.exitBoxes.set(exit.id, box);
      if (Phaser.Geom.Rectangle.Contains(box, spawn.x, spawn.y - 12)) {
        this.disarmedExits.add(exit.id);
      }
    }

    for (const exit of this.room.exits) this.drawExit(exit);
    for (const hazard of this.room.hazards) this.drawHazard(hazard);
    for (const pickup of this.room.pickups) this.drawPickup(pickup);
    if (this.room.checkpoint) {
      this.roomObjects.push(
        this.scene.add
          .image(this.room.checkpoint.x, this.room.checkpoint.y, 'terminal')
          .setOrigin(0.5, 1),
      );
    }

    // 房名常驻显示，不能走 showMessage：那条通道带 token 计时清除，几百毫秒后就没了。
    this.scene.registry.set(REGISTRY_KEYS.roomLabel, `${this.room.name} // ${this.room.id}`);
    this.showMessage(this.room.name, 900);
  }

  public update(player: Player, input: ActionSnapshot, onExit: ExitHandler): void {
    const playerBody = player.body as Phaser.Physics.Arcade.Body;
    if ((playerBody.blocked.down || playerBody.touching.down) && !this.isTouchingHazard(player)) {
      this.safePosition.set(player.x, player.y);
    }
    this.handlePickups(player, input);
    const overlappingExit = this.room.exits.find((exit) => {
      const box = this.exitBoxes.get(exit.id);
      return box ? Phaser.Geom.Rectangle.Contains(box, player.x, player.y - 12) : false;
    });

    for (const exit of this.room.exits) {
      if (exit !== overlappingExit) this.disarmedExits.delete(exit.id);
    }

    if (overlappingExit) {
      const unlocked = meetsRequirement(
        overlappingExit.requirement,
        this.session.abilities,
        this.session.bossDefeated,
      );
      if (!unlocked) {
        this.showMessage(exitRequirementMessage(overlappingExit.requirement), 600);
      } else if (!this.disarmedExits.has(overlappingExit.id)) {
        onExit(overlappingExit);
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
        this.scene.events.emit(AUDIO_EVENT, 'terminal');
        this.showMessage(
          this.saveProgress() ? '终端同步完成 · 生命已恢复' : '生命已恢复 · 本地存档不可用',
          1500,
        );
      } else if (this.registryMessageEmpty()) {
        this.showMessage('E：同步终端', 400);
      }
    }
  }

  public destroy(): void {
    this.clearRoom();
    this.clearMessage();
    this.scene.registry.set(REGISTRY_KEYS.roomLabel, '');
  }

  public get collisionPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    if (!this.platforms) throw new Error('房间碰撞层尚未初始化');
    return this.platforms;
  }

  public get definition(): RoomDefinition {
    return this.room;
  }

  public isTouchingHazard(player: Player): boolean {
    // 按碰撞体判定：精灵是 24×32，碰撞体只有 14×28，显示矩形会多出隐形受伤范围。
    const body = player.body as Phaser.Physics.Arcade.Body;
    return intersectsAnyHazard(
      { x: body.x, y: body.y, width: body.width, height: body.height },
      this.room.hazards,
    );
  }

  public returnPlayerToSafety(player: Player): void {
    player.setPosition(this.safePosition.x, this.safePosition.y - 2).setVelocity(0, -90);
  }

  private drawBackground(room: RoomDefinition): void {
    const palette =
      room.biome === 'vestibule'
        ? { base: 0x07101d, haze: 0x163459, light: COLORS.amber }
        : room.biome === 'bioforge'
          ? { base: 0x0b1020, haze: 0x193b3f, light: 0xed63d6 }
          : { base: 0x030712, haze: 0x102c42, light: COLORS.cyan };
    this.scene.cameras.main.setBackgroundColor(palette.base);

    const backgroundKey =
      room.biome === 'vestibule'
        ? 'vestibule-bg'
        : room.biome === 'bioforge'
          ? 'bioforge-bg'
          : 'reactor-bg';
    if (backgroundKey && this.scene.textures.exists(backgroundKey)) {
      const background = this.scene.add
        .image(0, 0, backgroundKey)
        .setOrigin(0)
        .setDisplaySize(room.width, room.height)
        // 背景图 + 雾层 + 描边网格三层叠下来，精致的手绘背景被压得几乎看不见。
        // 提高背景本身的不透明度，同时把上面两层压薄。
        .setAlpha(room.biome === 'bioforge' ? 0.68 : 0.74)
        .setDepth(-12);
      this.roomObjects.push(background);
    }

    const graphics = this.scene.add.graphics().setDepth(-10);
    graphics
      .fillStyle(palette.haze, room.biome === 'reactor' ? 0.34 : 0.16)
      .fillRect(0, 0, room.width, room.height);
    graphics.lineStyle(2, palette.light, 0.06);
    for (let x = 24; x < room.width; x += 64) graphics.strokeRect(x, 18, 30, room.height - 62);
    graphics.fillStyle(palette.light, 0.05);
    graphics.fillCircle(room.width / 2, room.height / 2, room.biome === 'reactor' ? 100 : 56);
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
    this.exitObjects.set(exit.id, door);
    this.roomObjects.push(door);
  }

  private drawHazard(hazard: RoomDefinition['hazards'][number]): void {
    const warning = this.scene.add
      .tileSprite(
        hazard.x + hazard.width / 2,
        hazard.y + hazard.height / 2,
        hazard.width,
        hazard.height,
        this.room.biome === 'bioforge'
          ? 'hazard-acid'
          : this.room.biome === 'reactor'
            ? 'hazard-reactor'
            : 'hazard',
      )
      .setDepth(2);
    this.roomObjects.push(warning);
  }

  private drawPickup(pickup: RoomDefinition['pickups'][number]): void {
    if (this.session.collectedPickups.has(pickup.id)) return;
    const texture =
      pickup.type === 'phaseDash'
        ? 'ability-dash'
        : pickup.type === 'magneticGrip'
          ? 'ability-grip'
          : pickup.type === 'healthCell'
            ? 'health-cell'
            : 'terminal';
    const image = this.scene.add.image(pickup.x, pickup.y, texture).setDepth(3);
    if (pickup.type === 'lore') image.setScale(0.65).setOrigin(0.5, 1);
    image.setAlpha(this.pickupUnlocked(pickup) ? 1 : LOCKED_PICKUP_ALPHA);
    this.scene.tweens.add({
      targets: image,
      y: pickup.y - 3,
      yoyo: true,
      repeat: -1,
      duration: 780,
      ease: 'Sine.inOut',
    });
    this.pickupObjects.set(pickup.id, image);
    this.roomObjects.push(image);
  }

  private handlePickups(player: Player, input: ActionSnapshot): void {
    for (const pickup of this.room.pickups) {
      if (this.session.collectedPickups.has(pickup.id)) continue;
      if (Phaser.Math.Distance.Between(player.x, player.y - 12, pickup.x, pickup.y) > 25) continue;
      if (!this.pickupUnlocked(pickup)) {
        // 被能力门挡住时也要解释，否则玩家只会看到一个走进去毫无反应的物件。
        if (this.registryMessageEmpty()) {
          this.showMessage(pickupRequirementMessage(pickup.requirement), 600);
        }
        continue;
      }
      if (pickup.type === 'lore' && !input.pressed.interact) {
        if (this.registryMessageEmpty()) this.showMessage('E：读取残留记录', 400);
        continue;
      }
      this.collectPickup(pickup);
    }
  }

  private pickupUnlocked(pickup: PickupDefinition): boolean {
    return meetsRequirement(pickup.requirement, this.session.abilities, this.session.bossDefeated);
  }

  private collectPickup(pickup: PickupDefinition): void {
    this.session.collectedPickups.add(pickup.id);
    let message = '';
    if (pickup.type === 'phaseDash') {
      this.session.abilities.phaseDash = true;
      message = '获得相位冲刺 · SHIFT / B';
    } else if (pickup.type === 'magneticGrip') {
      this.session.abilities.magneticGrip = true;
      message = '获得磁附跃迁 · 可贴墙跳跃';
    } else if (pickup.type === 'healthCell') {
      this.session.maxHealth += 1;
      this.session.health = this.session.maxHealth;
      message = '外骨骼生命上限 +1';
    } else {
      this.session.readLore.add(pickup.id);
      message = pickup.text ?? '记录内容已经损坏';
    }

    const image = this.pickupObjects.get(pickup.id);
    if (image) {
      this.scene.tweens.killTweensOf(image);
      image.destroy();
      this.pickupObjects.delete(pickup.id);
    }
    this.refreshExitVisuals();
    this.refreshPickupVisuals();
    this.scene.events.emit(AUDIO_EVENT, pickup.type === 'lore' ? 'terminal' : 'pickup');
    const saved = this.saveProgress();
    this.showMessage(
      saved ? message : `${message} · 存档不可用`,
      pickup.type === 'lore' ? 4_500 : 2_000,
    );
  }

  private refreshExitVisuals(): void {
    for (const exit of this.room.exits) {
      const door = this.exitObjects.get(exit.id);
      if (!door) continue;
      const unlocked = meetsRequirement(
        exit.requirement,
        this.session.abilities,
        this.session.bossDefeated,
      );
      door.setFillStyle(unlocked ? COLORS.cyan : COLORS.danger, 0.16);
      door.setStrokeStyle(1, unlocked ? COLORS.cyan : COLORS.danger, 0.85);
    }
  }

  private refreshPickupVisuals(): void {
    for (const pickup of this.room.pickups) {
      const image = this.pickupObjects.get(pickup.id);
      if (!image) continue;
      image.setAlpha(this.pickupUnlocked(pickup) ? 1 : LOCKED_PICKUP_ALPHA);
    }
  }

  private platformColor(room: RoomDefinition): number {
    if (room.biome === 'bioforge') return 0x294a4d;
    if (room.biome === 'reactor') return 0x1e405c;
    return COLORS.steel;
  }

  /**
   * 提示条的唯一正规通道：带 token 计时清除。别直接写 registry——进房横幅那条 900ms 的
   * 清除只比对 token、不比对内容，会把后写进去的消息顺手擦掉。
   */
  public showMessage(message: string, duration: number): void {
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
    this.collider = undefined;
    const platforms = this.platforms;
    this.platforms = undefined;
    if (platforms?.children) {
      platforms.clear(true, true);
      platforms.destroy();
    }
    for (const object of this.roomObjects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.roomObjects = [];
    this.pickupObjects.clear();
    this.exitObjects.clear();
  }
}
