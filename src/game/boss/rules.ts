export const BOSS = {
  maxHealth: 30,
  phaseTwoHealth: 15,
  phaseOneCadenceMs: 1_750,
  phaseTwoCadenceMs: 1_220,
  volleyTelegraphMs: 420,
  beamTelegraphMs: 620,
  shockwaveTelegraphMs: 500,
} as const;

export type BossPhase = 1 | 2;
export type BossAttack = 'volley' | 'beam' | 'shockwave';

const PHASE_ONE_PATTERN: BossAttack[] = ['volley', 'shockwave', 'beam'];
const PHASE_TWO_PATTERN: BossAttack[] = ['beam', 'volley', 'shockwave'];

export function bossPhase(health: number): BossPhase {
  return health <= BOSS.phaseTwoHealth ? 2 : 1;
}

export function bossCadence(phase: BossPhase): number {
  return phase === 1 ? BOSS.phaseOneCadenceMs : BOSS.phaseTwoCadenceMs;
}

export function bossAttackAt(serial: number, phase: BossPhase): BossAttack {
  const pattern = phase === 1 ? PHASE_ONE_PATTERN : PHASE_TWO_PATTERN;
  return pattern[Math.abs(serial) % pattern.length] ?? 'volley';
}
