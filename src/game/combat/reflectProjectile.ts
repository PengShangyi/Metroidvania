import type Phaser from 'phaser';

import { COLORS } from '../constants';
import { configureProjectileMetadata, getProjectileMetadata } from './projectileMetadata';
import {
  isReflectableProjectile,
  REFLECTION,
  reflectedVelocity,
  type ReflectableProjectileKind,
} from './reflectionRules';

export interface ProjectileReflection {
  serial: number;
  originalKind: ReflectableProjectileKind;
  direction: -1 | 1;
}

export function reflectProjectile(
  projectile: Phaser.Physics.Arcade.Image,
  now: number,
): ProjectileReflection | undefined {
  const metadata = getProjectileMetadata(projectile);
  if (!isReflectableProjectile(metadata)) return undefined;
  const body = projectile.body as Phaser.Physics.Arcade.Body;
  const velocity = reflectedVelocity(body.velocity.x, body.velocity.y);
  const direction: -1 | 1 = velocity.x < 0 ? -1 : 1;
  const reflection: ProjectileReflection = {
    serial: metadata.serial,
    originalKind: metadata.kind,
    direction,
  };

  projectile
    .setVelocity(velocity.x, velocity.y)
    .setFlipX(direction < 0)
    .setTint(COLORS.cyan)
    .setScale(1.12);
  configureProjectileMetadata(projectile, {
    faction: 'player',
    kind: 'reflected',
    damage: REFLECTION.damage,
    reflected: true,
    serial: metadata.serial,
    expiresAt: now + REFLECTION.lifetimeMs,
  });
  return reflection;
}
