import Phaser from 'phaser';

import type { ActionSnapshot } from '../input/actions';
import type { Player } from '../player/Player';
import type { GameSessionState } from '../state/GameSession';
import { COMBAT, cooldownReady, resolveDamage } from './rules';

export interface AttackFrame {
  projectiles: Phaser.Physics.Arcade.Group;
  meleeBounds?: Phaser.Geom.Rectangle;
  meleeSerial: number;
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
  }

  public update(input: ActionSnapshot): AttackFrame {
    const now = this.scene.time.now;
    if (input.pressed.shoot && cooldownReady(now, this.shootReadyAt)) this.fireBlaster(now);
    if (input.pressed.melee && cooldownReady(now, this.bladeReadyAt)) this.swingBlade(now);

    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if ((projectile.getData('expiresAt') as number) <= now) projectile.destroy();
      return true;
    });

    return {
      projectiles: this.projectiles,
      meleeBounds: this.meleeBounds,
      meleeSerial: this.meleeSerial,
    };
  }

  public bindWorld(platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.worldCollider?.destroy();
    this.worldCollider = this.scene.physics.add.collider(
      this.projectiles,
      platforms,
      (projectile) => {
        (projectile as Phaser.GameObjects.GameObject).destroy();
      },
    );
  }

  public damagePlayer(amount: number, knockbackX = 0): boolean {
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
    this.scene.time.delayedCall(80, () => this.player.clearTint());
    if (this.session.settings.screenShake) this.scene.cameras.main.shake(90, 0.004);

    if (this.session.health <= 0) this.onDeath();
    return true;
  }

  public clearTransient(): void {
    this.projectiles.clear(true, true);
    this.meleeBounds = undefined;
  }

  public destroy(): void {
    this.worldCollider?.destroy();
    this.projectiles.destroy(true);
  }

  private fireBlaster(now: number): void {
    const direction = this.player.facingDirection;
    const projectile = this.projectiles.get(
      this.player.x + direction * 15,
      this.player.y - 17,
      'projectile',
    ) as Phaser.Physics.Arcade.Image | null;
    if (!projectile) return;
    projectile
      .setActive(true)
      .setVisible(true)
      .setFlipX(direction < 0)
      .setVelocityX(direction * COMBAT.projectileSpeed)
      .setData('damage', 1)
      .setData('expiresAt', now + COMBAT.projectileLifetimeMs);
    (projectile.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.shootReadyAt = now + COMBAT.blasterCooldownMs;
  }

  private swingBlade(now: number): void {
    const direction = this.player.facingDirection;
    const x = this.player.x + direction * 21;
    const y = this.player.y - 18;
    this.meleeBounds = new Phaser.Geom.Rectangle(x - 14, y - 12, 28, 24);
    this.meleeSerial += 1;
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
