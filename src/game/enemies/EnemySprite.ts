import Phaser from 'phaser';

import type { EnemySpawn, EnemyType, EnemyVariant } from '../world/types';
import type { HorizontalSide, ShieldState } from './shieldRules';

const HEALTH_BY_TYPE: Record<EnemyType, number> = {
  crawler: 2,
  sentry: 3,
  turret: 3,
  spore: 4,
};

export class EnemySprite extends Phaser.Physics.Arcade.Sprite {
  public readonly enemyId: string;
  public readonly enemyType: EnemyType;
  public readonly variant?: EnemyVariant;
  public readonly originPoint: Phaser.Math.Vector2;
  public health: number;
  public patrolDirection: -1 | 1 = 1;
  public nextActionAt = 0;
  public lastMeleeSerial = -1;
  public stunnedUntil = 0;
  public shieldState: ShieldState = 'closed';
  public shieldCoreSide: HorizontalSide = 1;
  public shieldExposedUntil = 0;

  public constructor(scene: Phaser.Scene, spawn: EnemySpawn) {
    const texture =
      spawn.variant === 'shielded'
        ? 'crawler-shielded'
        : spawn.type === 'spore' && scene.textures.exists('spore-art')
          ? 'spore-art'
          : spawn.type;
    super(scene, spawn.x, spawn.y, texture);
    this.enemyId = spawn.id;
    this.enemyType = spawn.type;
    this.variant = spawn.variant;
    this.originPoint = new Phaser.Math.Vector2(spawn.x, spawn.y);
    this.health = HEALTH_BY_TYPE[spawn.type];

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4);
    this.configureBody();
    if (this.enemyType === 'spore' && scene.anims.exists('spore-pulse')) this.play('spore-pulse');
  }

  public get isShieldedCrawler(): boolean {
    return this.enemyType === 'crawler' && this.variant === 'shielded';
  }

  private configureBody(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.enemyType === 'crawler') {
      this.setOrigin(0.5, 1);
      body.setSize(20, 12).setOffset(2, 4);
      body.setMaxVelocity(42, 320);
      body.setDragX(900);
      return;
    }
    if (this.enemyType === 'spore') {
      this.setOrigin(0.5, 1);
      body.setSize(18, 20).setOffset(2, 2);
      body.setMaxVelocity(90, 320);
      body.setDragX(900);
      return;
    }

    body.setAllowGravity(false);
    body.setImmovable(true);
    if (this.enemyType === 'turret') this.setOrigin(0.5, 1);
  }
}
