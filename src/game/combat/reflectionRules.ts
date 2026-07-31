import type { ProjectileKind, ProjectileMetadata } from './projectileMetadata';

export type ReflectableProjectileKind = Extract<ProjectileKind, 'turret' | 'bossVolley'>;

export const REFLECTION = {
  windowMs: 80,
  speedMultiplier: 1.25,
  damage: 2,
  lifetimeMs: 1_800,
} as const;

export function isReflectableProjectile(
  metadata: ProjectileMetadata,
): metadata is ProjectileMetadata & { kind: ReflectableProjectileKind } {
  return (
    metadata.faction === 'hostile' &&
    metadata.reflectable &&
    !metadata.reflected &&
    (metadata.kind === 'turret' || metadata.kind === 'bossVolley')
  );
}

export function reflectionWindowActive(now: number, reflectiveUntil: number): boolean {
  return now < reflectiveUntil;
}

export function reflectedVelocity(x: number, y: number): { x: number; y: number } {
  return {
    x: -x * REFLECTION.speedMultiplier,
    y: -y * REFLECTION.speedMultiplier,
  };
}
