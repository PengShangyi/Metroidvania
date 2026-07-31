import type { HorizontalSide } from '../enemies/shieldRules';

export const COMBAT_EVENTS = {
  shieldOpened: 'star-echo:shield-opened',
  shieldCoreHit: 'star-echo:shield-core-hit',
  projectileReflected: 'star-echo:projectile-reflected',
  piercingHit: 'star-echo:piercing-hit',
} as const;

export interface ShieldOpenedEvent {
  enemyId: string;
  coreSide: HorizontalSide;
  exposedUntil: number;
}

export interface ShieldCoreHitEvent {
  enemyId: string;
  damage: number;
  remainingHealth: number;
}

export interface ProjectileReflectedEvent {
  serial: number;
  kind: 'turret' | 'bossVolley';
}

export interface PiercingHitEvent {
  serial: number;
  targetId: string;
}
