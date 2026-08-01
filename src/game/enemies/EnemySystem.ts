import Phaser from 'phaser';

import type { AttackFrame, CombatSystem } from '../combat/CombatSystem';
import {
  COMBAT_EVENTS,
  type PiercingHitEvent,
  type ProjectileReflectedEvent,
  type ShieldCoreHitEvent,
  type ShieldOpenedEvent,
} from '../combat/events';
import { hitReaction, projectileImpactKind, type HitImpactKind } from '../combat/feedbackRules';
import {
  configureProjectileMetadata,
  getProjectileMetadata,
  markProjectileTarget,
} from '../combat/projectileMetadata';
import { reflectProjectile } from '../combat/reflectProjectile';
import type { Player } from '../player/Player';
import { activateArcadeImage, releaseArcadeGroup, releaseArcadeImage } from '../render/arcadePool';
import type { EnemySpawn } from '../world/types';
import { shouldTurnAround, sporeLeapVelocity, turretCanFire } from './aiMath';
import { EnemySprite } from './EnemySprite';
import {
  dashCrossingSide,
  SHIELD_CRAWLER,
  shieldCanTakeDamage,
  shieldClosingSoon,
  type HorizontalSide,
} from './shieldRules';

export class EnemySystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly combat: CombatSystem;
  private readonly enemies: Phaser.GameObjects.Group;
  private readonly hostileProjectiles: Phaser.Physics.Arcade.Group;
  private readonly repairDrops: Phaser.Physics.Arcade.Group;
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private platformCollider?: Phaser.Physics.Arcade.Collider;
  private projectileCollider?: Phaser.Physics.Arcade.Collider;
  private contactCollider?: Phaser.Physics.Arcade.Collider;
  private dropCollider?: Phaser.Physics.Arcade.Collider;
  private projectileSerial = 0;
  private previousPlayerX: number;

  public constructor(scene: Phaser.Scene, player: Player, combat: CombatSystem) {
    this.scene = scene;
    this.player = player;
    this.combat = combat;
    this.previousPlayerX = player.x;
    this.enemies = scene.add.group();
    this.hostileProjectiles = scene.physics.add.group({ allowGravity: false, maxSize: 24 });
    this.repairDrops = scene.physics.add.group({ allowGravity: false, maxSize: 8 });
    this.contactCollider = scene.physics.add.overlap(player, this.enemies, (_player, enemy) => {
      const sprite = enemy as EnemySprite;
      const knockback = player.x < sprite.x ? -130 : 130;
      this.combat.damagePlayer(1, knockback);
    });
    this.dropCollider = scene.physics.add.overlap(player, this.repairDrops, (_player, drop) => {
      this.combat.healPlayer(1);
      releaseArcadeImage(drop as Phaser.Physics.Arcade.Image);
    });
  }

  public load(spawns: EnemySpawn[], platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.clear();
    this.platforms = platforms;
    this.previousPlayerX = this.player.x;
    for (const spawn of spawns) this.enemies.add(new EnemySprite(this.scene, spawn));
    this.platformCollider = this.scene.physics.add.collider(this.enemies, platforms);
    this.projectileCollider = this.scene.physics.add.collider(
      this.hostileProjectiles,
      platforms,
      (shot) => releaseArcadeImage(shot as Phaser.Physics.Arcade.Image),
    );
  }

  public update(delta: number, attack: AttackFrame): void {
    const now = this.scene.time.now;
    this.enemies.children.each((child) => {
      const enemy = child as EnemySprite;
      if (!enemy.active) return true;
      this.updateShieldCrawler(enemy, now);
      this.updateEnemy(enemy, now, delta);
      if (attack.meleeBounds && enemy.lastMeleeSerial !== attack.meleeSerial) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(enemy.getBounds(), attack.meleeBounds)) {
          enemy.lastMeleeSerial = attack.meleeSerial;
          this.resolveEnemyHit(
            enemy,
            2,
            'blade',
            this.player.facingDirection,
            this.sideOfEnemy(this.player.x, enemy.x),
          );
        }
      }
      return true;
    });

    this.reflectHostileProjectiles(attack, now);

    this.scene.physics.overlap(attack.projectiles, this.enemies, (first, second) => {
      const target = (first instanceof EnemySprite ? first : second) as EnemySprite;
      const shot = (first instanceof EnemySprite ? second : first) as Phaser.Physics.Arcade.Image;
      const metadata = getProjectileMetadata(shot);
      if (metadata.kind === 'piercing' && !markProjectileTarget(metadata, target.enemyId)) return;
      const velocityX = (shot.body as Phaser.Physics.Arcade.Body).velocity.x;
      const hitApplied = this.resolveEnemyHit(
        target,
        metadata.damage || 1,
        projectileImpactKind(metadata.kind),
        velocityX < 0 ? -1 : 1,
        velocityX < 0 ? 1 : -1,
      );
      if (metadata.kind === 'piercing' && hitApplied) {
        this.scene.events.emit(COMBAT_EVENTS.piercingHit, {
          serial: metadata.serial,
          targetId: target.enemyId,
        } satisfies PiercingHitEvent);
        return;
      }
      releaseArcadeImage(shot);
    });

    this.resolveReflectedProjectileHits();
    this.resolveHostileProjectileHits();

    this.hostileProjectiles.children.each((child) => {
      const shot = child as Phaser.Physics.Arcade.Image;
      if (shot.active && getProjectileMetadata(shot).expiresAt <= now) {
        releaseArcadeImage(shot);
      }
      return true;
    });

    this.repairDrops.children.each((child) => {
      const drop = child as Phaser.Physics.Arcade.Image;
      if (drop.active && (drop.getData('expiresAt') as number) <= now) {
        releaseArcadeImage(drop);
      }
      return true;
    });
    this.previousPlayerX = this.player.x;
  }

  public activeEnemyCount(): number {
    if (!this.enemies.children) return 0;
    return this.enemies.getChildren().filter((child) => child.active).length;
  }

  public clear(): void {
    this.platformCollider?.destroy();
    this.platformCollider = undefined;
    this.projectileCollider?.destroy();
    this.projectileCollider = undefined;
    if (this.enemies.children) this.enemies.clear(true, true);
    if (this.hostileProjectiles.children) releaseArcadeGroup(this.hostileProjectiles);
    if (this.repairDrops.children) releaseArcadeGroup(this.repairDrops);
  }

  public destroy(): void {
    this.clear();
    this.contactCollider?.destroy();
    this.dropCollider?.destroy();
    if (this.enemies.children) this.enemies.destroy(true);
    if (this.hostileProjectiles.children) this.hostileProjectiles.destroy(true);
    if (this.repairDrops.children) this.repairDrops.destroy(true);
  }

  private updateEnemy(enemy: EnemySprite, now: number, delta: number): void {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (enemy.isShieldedCrawler && enemy.shieldState === 'exposed') return;
    if (now < enemy.stunnedUntil) return;
    if (enemy.enemyType === 'crawler') {
      const blockedSide = enemy.patrolDirection < 0 ? body.blocked.left : body.blocked.right;
      const grounded = body.blocked.down || body.touching.down;
      if (shouldTurnAround(blockedSide, !grounded || this.hasGroundAhead(enemy))) {
        enemy.patrolDirection *= -1;
      }
      enemy.setVelocityX(enemy.patrolDirection * 34).setFlipX(enemy.patrolDirection < 0);
      return;
    }

    if (enemy.enemyType === 'sentry') {
      const targetX = Phaser.Math.Clamp(
        this.player.x,
        enemy.originPoint.x - 70,
        enemy.originPoint.x + 70,
      );
      enemy.x = Phaser.Math.Linear(enemy.x, targetX, Math.min(1, delta / 800));
      enemy.y = enemy.originPoint.y + Math.sin(now / 340) * 9;
      return;
    }

    if (enemy.enemyType === 'spore') {
      const grounded = body.blocked.down || body.touching.down;
      if (grounded && now >= enemy.nextActionAt) {
        const velocity = sporeLeapVelocity(this.player.x, enemy.x);
        enemy.setVelocity(velocity.x, velocity.y);
        enemy.setFlipX(velocity.x < 0);
        enemy.nextActionAt = now + 1_050;
      }
      enemy.setRotation(grounded ? 0 : Phaser.Math.Clamp(body.velocity.x / 500, -0.16, 0.16));
      return;
    }

    if (enemy.enemyType === 'turret' && now >= enemy.nextActionAt) {
      if (!turretCanFire(enemy.x, enemy.y, this.player.x, this.player.y)) return;
      enemy.nextActionAt = now + 1_450;
      this.fireAtPlayer(enemy);
    }
  }

  /** 沿巡逻方向探一格：脚下前方没有静态碰撞体就说明前面是悬崖。 */
  private hasGroundAhead(enemy: EnemySprite): boolean {
    if (!this.platforms) return true;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    const probeX = enemy.patrolDirection < 0 ? body.left - 4 : body.right + 4;
    const probeY = body.bottom + 4;
    return this.platforms.getChildren().some((child) => {
      const platform = child as Phaser.Physics.Arcade.Sprite;
      const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!platformBody) return false;
      return (
        probeX >= platformBody.left &&
        probeX <= platformBody.right &&
        probeY >= platformBody.top &&
        probeY <= platformBody.bottom
      );
    });
  }

  private updateShieldCrawler(enemy: EnemySprite, now: number): void {
    if (!enemy.isShieldedCrawler) return;
    if (enemy.shieldState === 'exposed') {
      enemy.setVelocityX(0);
      if (now >= enemy.shieldExposedUntil) {
        enemy.shieldState = 'closed';
        enemy.shieldExposedUntil = 0;
        enemy
          .setTexture('crawler-shielded')
          .setFlipX(enemy.patrolDirection < 0)
          .setAlpha(1);
      } else if (shieldClosingSoon(now, enemy.shieldExposedUntil)) {
        enemy.setAlpha(Math.floor(now / 70) % 2 === 0 ? 1 : 0.42);
      } else {
        enemy.setAlpha(1);
      }
      return;
    }

    if (this.player.movementState !== 'dash') return;
    const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(
      this.player.getBounds(),
      enemy.getBounds(),
    );
    const coreSide = dashCrossingSide(this.previousPlayerX, this.player.x, enemy.x, overlapping);
    if (coreSide === undefined) return;

    enemy.shieldState = 'exposed';
    enemy.shieldCoreSide = coreSide;
    enemy.shieldExposedUntil = now + SHIELD_CRAWLER.exposureMs;
    enemy.stunnedUntil = enemy.shieldExposedUntil;
    enemy
      .setVelocity(0, 0)
      .setTexture('crawler-exposed')
      .setFlipX(coreSide < 0)
      .setAlpha(1);
    this.combat.shieldOpenFeedback(enemy.x + coreSide * 8, enemy.y - 8, coreSide);
    this.scene.events.emit(COMBAT_EVENTS.shieldOpened, {
      enemyId: enemy.enemyId,
      coreSide,
      exposedUntil: enemy.shieldExposedUntil,
    } satisfies ShieldOpenedEvent);
  }

  private fireAtPlayer(enemy: EnemySprite): void {
    const direction = this.player.x < enemy.x ? -1 : 1;
    const shot = this.hostileProjectiles.get(
      enemy.x,
      enemy.y - 14,
      'projectile',
    ) as Phaser.Physics.Arcade.Image | null;
    if (!shot) return;
    activateArcadeImage(shot, 'projectile', enemy.x, enemy.y - 14)
      .setTint(0xff5678)
      .setVelocity(direction * 145, 0);
    this.projectileSerial += 1;
    configureProjectileMetadata(shot, {
      faction: 'hostile',
      kind: 'turret',
      damage: 1,
      reflectable: true,
      serial: this.projectileSerial,
      expiresAt: this.scene.time.now + 2_200,
    });
  }

  private reflectHostileProjectiles(attack: AttackFrame, now: number): void {
    if (!attack.meleeReflective || !attack.meleeBounds) return;
    this.hostileProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (
        !projectile.active ||
        !Phaser.Geom.Intersects.RectangleToRectangle(projectile.getBounds(), attack.meleeBounds!)
      ) {
        return true;
      }
      const reflection = reflectProjectile(projectile, now);
      if (!reflection) return true;
      this.combat.reflectionFeedback(projectile.x, projectile.y, reflection.direction);
      this.scene.events.emit(COMBAT_EVENTS.projectileReflected, {
        serial: reflection.serial,
        kind: reflection.originalKind,
      } satisfies ProjectileReflectedEvent);
      return true;
    });
  }

  private resolveReflectedProjectileHits(): void {
    this.hostileProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active) return true;
      const metadata = getProjectileMetadata(projectile);
      if (metadata.faction !== 'player' || metadata.kind !== 'reflected') return true;

      const body = projectile.body as Phaser.Physics.Arcade.Body;
      this.enemies.children.each((enemyChild) => {
        const enemy = enemyChild as EnemySprite;
        if (
          !projectile.active ||
          !enemy.active ||
          !Phaser.Geom.Intersects.RectangleToRectangle(projectile.getBounds(), enemy.getBounds())
        ) {
          return true;
        }
        this.resolveEnemyHit(
          enemy,
          metadata.damage,
          'reflected',
          body.velocity.x < 0 ? -1 : 1,
          body.velocity.x < 0 ? 1 : -1,
        );
        releaseArcadeImage(projectile);
        return false;
      });
      return true;
    });
  }

  private resolveHostileProjectileHits(): void {
    this.hostileProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active) return true;
      const metadata = getProjectileMetadata(projectile);
      if (
        metadata.faction !== 'hostile' ||
        !Phaser.Geom.Intersects.RectangleToRectangle(
          projectile.getBounds(),
          this.player.getBounds(),
        )
      ) {
        return true;
      }
      const velocityX = (projectile.body as Phaser.Physics.Arcade.Body).velocity.x;
      const damage = metadata.damage;
      releaseArcadeImage(projectile);
      this.combat.damagePlayer(damage, velocityX < 0 ? -110 : 110);
      return true;
    });
  }

  private resolveEnemyHit(
    enemy: EnemySprite,
    amount: number,
    impact: HitImpactKind,
    knockbackDirection: HorizontalSide,
    impactSide: HorizontalSide,
  ): boolean {
    if (!enemy.active) return false;
    if (
      enemy.isShieldedCrawler &&
      !shieldCanTakeDamage(enemy.shieldState, enemy.shieldCoreSide, impactSide)
    ) {
      this.combat.shieldBlockFeedback(enemy.x + impactSide * 8, enemy.y - 8, impactSide);
      return false;
    }
    const reaction = hitReaction(impact);
    enemy.health -= amount;
    enemy.stunnedUntil = this.scene.time.now + reaction.stunMs;
    this.applyKnockback(enemy, knockbackDirection, reaction.knockbackSpeed);
    this.combat.enemyHitFeedback(
      impact,
      enemy.x,
      enemy.y - enemy.displayHeight / 2,
      knockbackDirection,
    );
    if (enemy.isShieldedCrawler) {
      this.scene.events.emit(COMBAT_EVENTS.shieldCoreHit, {
        enemyId: enemy.enemyId,
        damage: amount,
        remainingHealth: Math.max(0, enemy.health),
      } satisfies ShieldCoreHitEvent);
    }
    enemy.setTintFill(0xffffff);
    this.scene.time.delayedCall(55, () => {
      if (enemy.active) enemy.clearTint();
    });
    if (enemy.health > 0) return true;

    const { x, y, enemyId } = enemy;
    enemy.destroy();
    if (this.dropHash(enemyId) % 3 === 0) {
      const drop = this.repairDrops.get(x, y, 'health-cell') as Phaser.Physics.Arcade.Image | null;
      if (!drop) return true;
      activateArcadeImage(drop, 'health-cell', x, y)
        .setScale(0.55)
        .setData('expiresAt', this.scene.time.now + 5_000);
    }
    return true;
  }

  private applyKnockback(enemy: EnemySprite, direction: -1 | 1, speed: number): void {
    if (enemy.isShieldedCrawler) return;
    if (enemy.enemyType === 'crawler' || enemy.enemyType === 'spore') {
      enemy.setVelocityX(direction * speed);
      return;
    }
    this.scene.tweens.killTweensOf(enemy);
    this.scene.tweens.add({
      targets: enemy,
      x: enemy.x + direction * 2,
      duration: 45,
      yoyo: true,
    });
  }

  private sideOfEnemy(valueX: number, enemyX: number): HorizontalSide {
    return valueX < enemyX ? -1 : 1;
  }

  private dropHash(value: string): number {
    return [...value].reduce((hash, character) => hash + character.charCodeAt(0), 0);
  }
}
