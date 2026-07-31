import { describe, expect, it } from 'vitest';

import { createProjectileMetadata } from './projectileMetadata';
import {
  isReflectableProjectile,
  REFLECTION,
  reflectedVelocity,
  reflectionWindowActive,
} from './reflectionRules';

describe('energy blade reflection', () => {
  it('uses an exclusive 80ms reflection window', () => {
    expect(REFLECTION.windowMs).toBe(80);
    expect(reflectionWindowActive(1_079, 1_080)).toBe(true);
    expect(reflectionWindowActive(1_080, 1_080)).toBe(false);
  });

  it('only accepts hostile turret and boss-volley projectiles once', () => {
    expect(
      isReflectableProjectile(
        createProjectileMetadata({ faction: 'hostile', kind: 'turret', reflectable: true }),
      ),
    ).toBe(true);
    expect(
      isReflectableProjectile(
        createProjectileMetadata({ faction: 'hostile', kind: 'bossVolley', reflectable: true }),
      ),
    ).toBe(true);
    expect(
      isReflectableProjectile(
        createProjectileMetadata({ faction: 'hostile', kind: 'shockwave', reflectable: true }),
      ),
    ).toBe(false);
    expect(
      isReflectableProjectile(
        createProjectileMetadata({
          faction: 'player',
          kind: 'reflected',
          reflectable: false,
          reflected: true,
        }),
      ),
    ).toBe(false);
  });

  it('reverses both velocity axes at 1.25 times speed', () => {
    expect(reflectedVelocity(160, -80)).toEqual({ x: -200, y: 100 });
    expect(REFLECTION.damage).toBe(2);
    expect(REFLECTION.lifetimeMs).toBe(1_800);
  });
});
