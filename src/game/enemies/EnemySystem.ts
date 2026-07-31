import Phaser from 'phaser';

import type { AttackFrame, CombatSystem } from '../combat/CombatSystem';
import type { Player } from '../player/Player';
import { activateArcadeImage, releaseArcadeGroup, releaseArcadeImage } from '../render/arcadePool';
import type { EnemySpawn } from '../world/types';
import { sporeLeapVelocity } from './aiMath';
import { EnemySprite } from './EnemySprite';

export class EnemySystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly combat: CombatSystem;
  private readonly enemies: Phaser.GameObjects.Group;
  private readonly hostileProjectiles: Phaser.Physics.Arcade.Group;
  private readonly repairDrops: Phaser.Physics.Arcade.Group;
  private platformCollider?: Phaser.Physics.Arcade.Collider;
  private projectileCollider?: Phaser.Physics.Arcade.Collider;
  private hostileCollider?: Phaser.Physics.Arcade.Collider;
  private contactCollider?: Phaser.Physics.Arcade.Collider;
  private dropCollider?: Phaser.Physics.Arcade.Collider;

  public constructor(scene: Phaser.Scene, player: Player, combat: CombatSystem) {
    this.scene = scene;
    this.player = player;
    this.combat = combat;
    this.enemies = scene.add.group();
    this.hostileProjectiles = scene.physics.add.group({ allowGravity: false, maxSize: 24 });
    this.repairDrops = scene.physics.add.group({ allowGravity: false, maxSize: 8 });
    this.contactCollider = scene.physics.add.overlap(player, this.enemies, (_player, enemy) => {
      const sprite = enemy as EnemySprite;
      const knockback = player.x < sprite.x ? -130 : 130;
      this.combat.damagePlayer(1, knockback);
    });
    this.hostileCollider = scene.physics.add.overlap(
      player,
      this.hostileProjectiles,
      (_player, shot) => {
        const projectile = shot as Phaser.Physics.Arcade.Image;
        const velocity = (projectile.body as Phaser.Physics.Arcade.Body).velocity.x;
        releaseArcadeImage(projectile);
        this.combat.damagePlayer(1, velocity < 0 ? -110 : 110);
      },
    );
    this.dropCollider = scene.physics.add.overlap(player, this.repairDrops, (_player, drop) => {
      this.combat.healPlayer(1);
      releaseArcadeImage(drop as Phaser.Physics.Arcade.Image);
    });
  }

  public load(spawns: EnemySpawn[], platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.clear();
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
      this.updateEnemy(enemy, now, delta);
      if (attack.meleeBounds && enemy.lastMeleeSerial !== attack.meleeSerial) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(enemy.getBounds(), attack.meleeBounds)) {
          enemy.lastMeleeSerial = attack.meleeSerial;
          this.damageEnemy(enemy, 2);
        }
      }
      return true;
    });

    this.scene.physics.overlap(attack.projectiles, this.enemies, (projectile, enemy) => {
      const shot = projectile as Phaser.Physics.Arcade.Image;
      const target = enemy as EnemySprite;
      this.damageEnemy(target, (shot.getData('damage') as number) || 1);
      releaseArcadeImage(shot);
    });

    this.hostileProjectiles.children.each((child) => {
      const shot = child as Phaser.Physics.Arcade.Image;
      if (shot.active && (shot.getData('expiresAt') as number) <= now) {
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
  }

  public clear(): void {
    this.platformCollider?.destroy();
    this.projectileCollider?.destroy();
    if (this.enemies.children) this.enemies.clear(true, true);
    if (this.hostileProjectiles.children) releaseArcadeGroup(this.hostileProjectiles);
    if (this.repairDrops.children) releaseArcadeGroup(this.repairDrops);
  }

  public destroy(): void {
    this.clear();
    this.contactCollider?.destroy();
    this.hostileCollider?.destroy();
    this.dropCollider?.destroy();
    if (this.enemies.children) this.enemies.destroy(true);
    if (this.hostileProjectiles.children) this.hostileProjectiles.destroy(true);
    if (this.repairDrops.children) this.repairDrops.destroy(true);
  }

  private updateEnemy(enemy: EnemySprite, now: number, delta: number): void {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (enemy.enemyType === 'crawler') {
      if (body.blocked.left || body.blocked.right) enemy.patrolDirection *= -1;
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
      enemy.nextActionAt = now + 1_450;
      this.fireAtPlayer(enemy);
    }
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
      .setVelocity(direction * 145, 0)
      .setData('expiresAt', this.scene.time.now + 2_200);
  }

  private damageEnemy(enemy: EnemySprite, amount: number): void {
    if (!enemy.active) return;
    enemy.health -= amount;
    enemy.setTintFill(0xffffff);
    this.scene.time.delayedCall(55, () => {
      if (enemy.active) enemy.clearTint();
    });
    if (enemy.health > 0) return;

    const { x, y, enemyId } = enemy;
    enemy.destroy();
    if (this.dropHash(enemyId) % 3 === 0) {
      const drop = this.repairDrops.get(x, y, 'health-cell') as Phaser.Physics.Arcade.Image | null;
      if (!drop) return;
      activateArcadeImage(drop, 'health-cell', x, y)
        .setScale(0.55)
        .setData('expiresAt', this.scene.time.now + 5_000);
    }
  }

  private dropHash(value: string): number {
    return [...value].reduce((hash, character) => hash + character.charCodeAt(0), 0);
  }
}
