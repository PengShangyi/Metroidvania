export type ShieldState = 'closed' | 'exposed';
export type HorizontalSide = -1 | 1;

export const SHIELD_CRAWLER = {
  exposureMs: 1_800,
  closingWarningMs: 350,
} as const;

export function dashCrossingSide(
  previousPlayerX: number,
  currentPlayerX: number,
  enemyX: number,
  overlapping: boolean,
): HorizontalSide | undefined {
  if (!overlapping || previousPlayerX === currentPlayerX) return undefined;
  if (previousPlayerX < enemyX && currentPlayerX >= enemyX) return 1;
  if (previousPlayerX > enemyX && currentPlayerX <= enemyX) return -1;
  return undefined;
}

export function shieldCanTakeDamage(
  state: ShieldState,
  coreSide: HorizontalSide,
  impactSide: HorizontalSide,
): boolean {
  return state === 'exposed' && coreSide === impactSide;
}

export function shieldClosingSoon(now: number, exposedUntil: number): boolean {
  return now >= exposedUntil - SHIELD_CRAWLER.closingWarningMs && now < exposedUntil;
}
