export type HitImpactKind = 'blaster' | 'blade' | 'piercing' | 'reflected';

export interface HitReaction {
  hitStopMs: number;
  stunMs: number;
  knockbackSpeed: number;
  color: number;
  shakesCamera: boolean;
}

const REACTIONS: Record<HitImpactKind, HitReaction> = {
  blaster: {
    hitStopMs: 24,
    stunMs: 100,
    knockbackSpeed: 45,
    color: 0x8ce7ff,
    shakesCamera: false,
  },
  blade: {
    hitStopMs: 38,
    stunMs: 160,
    knockbackSpeed: 90,
    color: 0xd8f7ff,
    shakesCamera: true,
  },
  piercing: {
    hitStopMs: 38,
    stunMs: 160,
    knockbackSpeed: 90,
    color: 0xffb454,
    shakesCamera: true,
  },
  reflected: {
    hitStopMs: 38,
    stunMs: 160,
    knockbackSpeed: 90,
    color: 0x43d8e8,
    shakesCamera: true,
  },
};

export function hitReaction(kind: HitImpactKind): HitReaction {
  return REACTIONS[kind];
}

export function projectileImpactKind(kind: ProjectileKind): HitImpactKind {
  if (kind === 'piercing') return 'piercing';
  if (kind === 'reflected') return 'reflected';
  return 'blaster';
}
import type { ProjectileKind } from './projectileMetadata';
