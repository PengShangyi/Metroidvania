import Phaser from 'phaser';

import { AUDIO_EVENT } from '../audio/soundDesign';
import type { AttackFrame, CombatSystem } from '../combat/CombatSystem';
import { COMBAT_EVENTS, type ProjectileReflectedEvent } from '../combat/events';
import { projectileImpactKind, type HitImpactKind } from '../combat/feedbackRules';
import { reflectProjectile } from '../combat/reflectProjectile';
import { COLORS, REGISTRY_KEYS } from '../constants';
import type { Player } from '../player/Player';
import { activateArcadeImage, releaseArcadeGroup, releaseArcadeImage } from '../render/arcadePool';
import type { GameSessionState } from '../state/GameSession';
import { configureProjectileMetadata, getProjectileMetadata } from '../combat/projectileMetadata';
import { BOSS, bossAttackAt, bossCadence, bossPhase, type BossAttack } from './rules';

export class BossSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly combat: CombatSystem;
  private readonly session: GameSessionState;
  private readonly onDefeated: () => void;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly effects = new Set<Phaser.GameObjects.GameObject>();
  private boss?: Phaser.Physics.Arcade.Sprite;
  private contactCollider?: Phaser.Physics.Arcade.Collider;
  private health: number = BOSS.maxHealth;
  private attackSerial = 0;
  private nextAttackAt = 0;
  private lastMeleeSerial = -1;
  private activeBeam?: { bounds: Phaser.Geom.Rectangle; expiresAt: number };
  private generation = 0;
  private projectileSerial = 0;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    combat: CombatSystem,
    session: GameSessionState,
    onDefeated: () => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.combat = combat;
    this.session = session;
    this.onDefeated = onDefeated;
    this.projectiles = scene.physics.add.group({ allowGravity: false, maxSize: 32 });
  }

  public load(roomId: string): void {
    this.clear();
    if (roomId !== 'core_guardian' || this.session.bossDefeated) return;

    this.health = BOSS.maxHealth;
    this.attackSerial = 0;
    this.lastMeleeSerial = -1;
    const texture = this.scene.textures.exists('boss-art') ? 'boss-art' : 'boss';
    this.boss = this.scene.physics.add.sprite(360, 158, texture).setDepth(5);
    this.boss.setImmovable(true);
    (this.boss.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setCircle(30, 6, 6);
    this.contactCollider = this.scene.physics.add.overlap(this.player, this.boss, () => {
      if (!this.boss) return;
      this.combat.damagePlayer(1, this.player.x < this.boss.x ? -150 : 150);
    });
    this.nextAttackAt = this.scene.time.now + 900;
    this.publishState();
  }

  public update(attack: AttackFrame): void {
    const boss = this.boss;
    if (!boss?.active) return;
    const now = this.scene.time.now;
    boss.y = 154 + Math.sin(now / 420) * 7;
    boss.rotation = Math.sin(now / 650) * 0.05;

    this.reflectProjectiles(attack, now);
    this.resolveReflectedHits(boss);
    if (!boss.active) return;

    this.scene.physics.overlap(attack.projectiles, boss, (projectile) => {
      const shot = projectile as Phaser.Physics.Arcade.Image;
      const metadata = getProjectileMetadata(shot);
      const velocityX = (shot.body as Phaser.Physics.Arcade.Body).velocity.x;
      this.damageBoss(
        metadata.damage || 1,
        projectileImpactKind(metadata.kind),
        velocityX < 0 ? -1 : 1,
      );
      releaseArcadeImage(shot);
    });
    if (!boss.active) return;
    if (
      attack.meleeBounds &&
      this.lastMeleeSerial !== attack.meleeSerial &&
      Phaser.Geom.Intersects.RectangleToRectangle(boss.getBounds(), attack.meleeBounds)
    ) {
      this.lastMeleeSerial = attack.meleeSerial;
      this.damageBoss(2, 'blade', this.player.facingDirection);
    }

    if (
      this.activeBeam &&
      now < this.activeBeam.expiresAt &&
      Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.activeBeam.bounds)
    ) {
      this.combat.damagePlayer(1, this.player.x < boss.x ? -130 : 130);
    }
    if (this.activeBeam && now >= this.activeBeam.expiresAt) this.activeBeam = undefined;

    this.resolveHostileProjectileHits();

    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active && getProjectileMetadata(projectile).expiresAt <= now) {
        releaseArcadeImage(projectile);
      }
      return true;
    });

    if (now >= this.nextAttackAt)
      this.beginAttack(bossAttackAt(this.attackSerial, bossPhase(this.health)));
  }

  public clear(): void {
    this.generation += 1;
    this.contactCollider?.destroy();
    this.contactCollider = undefined;
    this.boss?.destroy();
    this.boss = undefined;
    if (this.projectiles.children) releaseArcadeGroup(this.projectiles);
    for (const effect of this.effects) effect.destroy();
    this.effects.clear();
    this.activeBeam = undefined;
    this.scene.registry.remove(REGISTRY_KEYS.bossHealth);
    this.scene.registry.remove(REGISTRY_KEYS.bossPhase);
  }

  public destroy(): void {
    this.clear();
    if (this.projectiles.children) this.projectiles.destroy(true);
  }

  private beginAttack(attack: BossAttack): void {
    if (!this.boss) return;
    const phase = bossPhase(this.health);
    this.attackSerial += 1;
    this.nextAttackAt = this.scene.time.now + bossCadence(phase);
    if (attack === 'volley') this.telegraphVolley(phase);
    else if (attack === 'beam') this.telegraphBeam();
    else this.telegraphShockwave(phase);
  }

  private telegraphVolley(phase: 1 | 2): void {
    const boss = this.boss;
    if (!boss) return;
    const targetY = this.player.y - 14;
    const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, targetY);
    const length = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, targetY);
    const warning = this.track(
      this.scene.add
        .rectangle(
          (boss.x + this.player.x) / 2,
          (boss.y + targetY) / 2,
          length,
          3,
          COLORS.danger,
          0.34,
        )
        .setRotation(angle)
        .setDepth(7),
    );
    boss.setTint(COLORS.danger);
    const generation = this.generation;
    this.scene.time.delayedCall(BOSS.volleyTelegraphMs, () => {
      if (generation !== this.generation || !this.boss) return;
      this.destroyEffect(warning);
      this.boss.clearTint();
      const count = phase === 1 ? 3 : 5;
      for (let index = 0; index < count; index += 1) {
        const spread = (index - (count - 1) / 2) * 0.12;
        this.fireProjectile(angle + spread, phase === 1 ? 175 : 205);
      }
    });
  }

  private telegraphBeam(): void {
    const targetY = Phaser.Math.Clamp(this.player.y - 14, 48, 228);
    const warning = this.track(
      this.scene.add
        .rectangle(240, targetY, 468, 12, COLORS.danger, 0.18)
        .setStrokeStyle(1, COLORS.pale, 0.85)
        .setDepth(7),
    );
    const generation = this.generation;
    this.scene.time.delayedCall(BOSS.beamTelegraphMs, () => {
      if (generation !== this.generation || !this.boss) return;
      warning.setFillStyle(COLORS.cyan, 0.72).setStrokeStyle(2, COLORS.pale, 1);
      this.activeBeam = {
        bounds: new Phaser.Geom.Rectangle(6, targetY - 6, 468, 12),
        expiresAt: this.scene.time.now + 260,
      };
      if (this.session.settings.screenShake) this.scene.cameras.main.shake(120, 0.003);
      this.scene.time.delayedCall(260, () => {
        if (generation === this.generation) this.destroyEffect(warning);
      });
    });
  }

  private telegraphShockwave(phase: 1 | 2): void {
    const boss = this.boss;
    if (!boss) return;
    const warning = this.track(
      this.scene.add
        .rectangle(boss.x, 242, 82, 10, COLORS.amber, 0.28)
        .setStrokeStyle(1, COLORS.pale, 0.8)
        .setDepth(7),
    );
    const generation = this.generation;
    this.scene.time.delayedCall(BOSS.shockwaveTelegraphMs, () => {
      if (generation !== this.generation || !this.boss) return;
      this.destroyEffect(warning);
      this.fireWave(-1, phase);
      this.fireWave(1, phase);
    });
  }

  private fireProjectile(angle: number, speed: number): void {
    const boss = this.boss;
    if (!boss) return;
    const shot = this.projectiles.get(
      boss.x,
      boss.y,
      'projectile',
    ) as Phaser.Physics.Arcade.Image | null;
    if (!shot) return;
    activateArcadeImage(shot, 'projectile', boss.x, boss.y)
      .setTint(COLORS.danger)
      .setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.projectileSerial += 1;
    configureProjectileMetadata(shot, {
      faction: 'hostile',
      kind: 'bossVolley',
      damage: 1,
      reflectable: true,
      serial: this.projectileSerial,
      expiresAt: this.scene.time.now + 2_600,
    });
  }

  private fireWave(direction: -1 | 1, phase: 1 | 2): void {
    const boss = this.boss;
    if (!boss) return;
    const wave = this.projectiles.get(
      boss.x,
      241,
      'hazard-reactor',
    ) as Phaser.Physics.Arcade.Image | null;
    if (!wave) return;
    activateArcadeImage(wave, 'hazard-reactor', boss.x, 241)
      .setDisplaySize(24, phase === 1 ? 10 : 15)
      .setVelocityX(direction * (phase === 1 ? 150 : 205));
    this.projectileSerial += 1;
    configureProjectileMetadata(wave, {
      faction: 'hostile',
      kind: 'shockwave',
      damage: 1,
      serial: this.projectileSerial,
      expiresAt: this.scene.time.now + 2_700,
    });
    (wave.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(22, 10);
  }

  private reflectProjectiles(attack: AttackFrame, now: number): void {
    if (!attack.meleeReflective || !attack.meleeBounds) return;
    this.projectiles.children.each((child) => {
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

  private resolveReflectedHits(boss: Phaser.Physics.Arcade.Sprite): void {
    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active || !boss.active) return true;
      const metadata = getProjectileMetadata(projectile);
      if (
        metadata.faction !== 'player' ||
        metadata.kind !== 'reflected' ||
        !Phaser.Geom.Intersects.RectangleToRectangle(projectile.getBounds(), boss.getBounds())
      ) {
        return true;
      }
      const velocityX = (projectile.body as Phaser.Physics.Arcade.Body).velocity.x;
      this.damageBoss(metadata.damage, 'reflected', velocityX < 0 ? -1 : 1);
      releaseArcadeImage(projectile);
      return true;
    });
  }

  private resolveHostileProjectileHits(): void {
    this.projectiles.children.each((child) => {
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
      this.combat.damagePlayer(damage, velocityX < 0 ? -120 : 120);
      return true;
    });
  }

  private damageBoss(amount: number, impact: HitImpactKind, direction: -1 | 1): void {
    const boss = this.boss;
    if (!boss?.active) return;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.combat.bossHitFeedback(impact, boss.x, boss.y, direction);
    this.scene.events.emit(AUDIO_EVENT, this.health > 0 ? 'bossHit' : 'bossDefeat');
    boss.setTintFill(0xffffff);
    this.scene.time.delayedCall(55, () => {
      if (boss.active) boss.clearTint();
    });
    this.publishState();
    if (this.health > 0) return;

    boss.disableBody(true, true);
    this.generation += 1;
    this.boss = undefined;
    if (this.projectiles.children) releaseArcadeGroup(this.projectiles);
    for (const effect of this.effects) effect.destroy();
    this.effects.clear();
    this.activeBeam = undefined;
    this.onDefeated();
  }

  private publishState(): void {
    this.scene.registry.set(REGISTRY_KEYS.bossHealth, this.health);
    this.scene.registry.set(REGISTRY_KEYS.bossPhase, bossPhase(this.health));
  }

  private track<T extends Phaser.GameObjects.GameObject>(effect: T): T {
    this.effects.add(effect);
    return effect;
  }

  private destroyEffect(effect: Phaser.GameObjects.GameObject): void {
    this.effects.delete(effect);
    effect.destroy();
  }
}
