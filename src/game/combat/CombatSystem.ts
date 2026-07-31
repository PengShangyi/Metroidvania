import Phaser from 'phaser';

import { AUDIO_EVENT } from '../audio/soundDesign';
import type { ActionSnapshot } from '../input/actions';
import type { Player } from '../player/Player';
import { activateArcadeImage, releaseArcadeGroup, releaseArcadeImage } from '../render/arcadePool';
import type { GameSessionState } from '../state/GameSession';
import { CombatFeedback } from './CombatFeedback';
import type { HitImpactKind } from './feedbackRules';
import { configureProjectileMetadata, getProjectileMetadata } from './projectileMetadata';
import { REFLECTION, reflectionWindowActive } from './reflectionRules';
import { COMBAT, cooldownReady, resolveDamage } from './rules';

export interface AttackFrame {
  projectiles: Phaser.Physics.Arcade.Group;
  meleeBounds?: Phaser.Geom.Rectangle;
  meleeSerial: number;
  meleeReflective: boolean;
}

export class CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly session: GameSessionState;
  private readonly onDeath: () => void;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private worldCollider?: Phaser.Physics.Arcade.Collider;
  private shootReadyAt = 0;
  private bladeReadyAt = 0;
  private invulnerableUntil = 0;
  private meleeBounds?: Phaser.Geom.Rectangle;
  private meleeSerial = 0;
  private meleeReflectiveUntil = 0;
  private projectileSerial = 0;
  private readonly feedback: CombatFeedback;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    session: GameSessionState,
    onDeath: () => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.session = session;
    this.onDeath = onDeath;
    this.projectiles = scene.physics.add.group({
      maxSize: 32,
      allowGravity: false,
    });
    this.feedback = new CombatFeedback(scene, session);
  }

  public update(input: ActionSnapshot): AttackFrame {
    const now = this.scene.time.now;
    if (input.pressed.shoot && cooldownReady(now, this.shootReadyAt)) this.fireBlaster(now);
    if (input.pressed.melee && cooldownReady(now, this.bladeReadyAt)) this.swingBlade(now);

    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active && getProjectileMetadata(projectile).expiresAt <= now) {
        releaseArcadeImage(projectile);
      }
      return true;
    });

    return {
      projectiles: this.projectiles,
      meleeBounds: this.meleeBounds,
      meleeSerial: this.meleeSerial,
      meleeReflective: reflectionWindowActive(now, this.meleeReflectiveUntil),
    };
  }

  public bindWorld(platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.worldCollider?.destroy();
    this.worldCollider = this.scene.physics.add.collider(
      this.projectiles,
      platforms,
      (projectile) => {
        releaseArcadeImage(projectile as Phaser.Physics.Arcade.Image);
      },
    );
  }

  public damagePlayer(amount: number, knockbackX = 0): boolean {
    if (this.player.isDashInvulnerable(this.scene.time.now)) return false;
    const result = resolveDamage(
      this.session.health,
      amount,
      this.scene.time.now,
      this.invulnerableUntil,
    );
    if (!result.applied) return false;

    this.session.health = result.health;
    this.invulnerableUntil = result.invulnerableUntil;
    this.player.setVelocity(knockbackX, -150).setTintFill(0xffffff);
    this.player.playAction(this.session.health <= 0 ? 'death' : 'hurt');
    this.scene.events.emit(AUDIO_EVENT, 'hurt');
    this.scene.time.delayedCall(80, () => this.player.clearTint());
    if (this.session.settings.screenShake) this.scene.cameras.main.shake(90, 0.004);

    if (this.session.health <= 0) this.onDeath();
    return true;
  }

  public healPlayer(amount: number): void {
    this.session.health = Math.min(
      this.session.maxHealth,
      this.session.health + Math.max(0, amount),
    );
  }

  public get projectileGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles;
  }

  public clearTransient(): void {
    if (this.projectiles.children) releaseArcadeGroup(this.projectiles);
    this.meleeBounds = undefined;
    this.meleeReflectiveUntil = 0;
    this.feedback.clear();
  }

  public destroy(): void {
    this.feedback.clear();
    this.worldCollider?.destroy();
    if (this.projectiles.children) this.projectiles.destroy(true);
  }

  public enemyHitFeedback(kind: HitImpactKind, x: number, y: number, direction: -1 | 1): void {
    this.feedback.enemyHit(kind, x, y, direction);
  }

  public clearHitStop(): void {
    this.feedback.clear();
  }

  public bossHitFeedback(kind: HitImpactKind, x: number, y: number, direction: -1 | 1): void {
    this.feedback.bossHit(kind, x, y, direction);
  }

  public shieldBlockFeedback(x: number, y: number, direction: -1 | 1): void {
    this.feedback.shieldBlock(x, y, direction);
  }

  public shieldOpenFeedback(x: number, y: number, direction: -1 | 1): void {
    this.feedback.shieldOpen(x, y, direction);
  }

  public reflectionFeedback(x: number, y: number, direction: -1 | 1): void {
    this.feedback.reflect(x, y, direction);
  }

  private fireBlaster(now: number): void {
    const direction = this.player.facingDirection;
    const projectile = this.projectiles.get(
      this.player.x + direction * 15,
      this.player.y - 17,
      'projectile',
    ) as Phaser.Physics.Arcade.Image | null;
    if (!projectile) return;
    activateArcadeImage(
      projectile,
      'projectile',
      this.player.x + direction * 15,
      this.player.y - 17,
    )
      .setFlipX(direction < 0)
      .setVelocityX(direction * COMBAT.projectileSpeed);
    this.projectileSerial += 1;
    configureProjectileMetadata(projectile, {
      faction: 'player',
      kind: 'blaster',
      damage: 1,
      serial: this.projectileSerial,
      expiresAt: now + COMBAT.projectileLifetimeMs,
    });
    this.player.playAction('shoot');
    this.scene.events.emit(AUDIO_EVENT, 'blaster');
    this.shootReadyAt = now + COMBAT.blasterCooldownMs;
  }

  private swingBlade(now: number): void {
    const direction = this.player.facingDirection;
    const x = this.player.x + direction * 21;
    const y = this.player.y - 18;
    this.meleeBounds = new Phaser.Geom.Rectangle(x - 14, y - 12, 28, 24);
    this.meleeSerial += 1;
    this.meleeReflectiveUntil = now + REFLECTION.windowMs;
    this.player.playAction('slash');
    this.scene.events.emit(AUDIO_EVENT, 'blade');
    const slash = this.scene.add
      .image(x, y, 'slash')
      .setFlipX(direction < 0)
      .setDepth(7);
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.18,
      duration: 110,
      onComplete: () => slash.destroy(),
    });
    this.scene.time.delayedCall(105, () => {
      this.meleeBounds = undefined;
    });
    this.bladeReadyAt = now + COMBAT.bladeCooldownMs;
  }
}
