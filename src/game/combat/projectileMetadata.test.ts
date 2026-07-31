import { describe, expect, it } from 'vitest';

import {
  configureProjectileMetadata,
  getProjectileMetadata,
  markProjectileTarget,
  resetProjectileMetadata,
} from './projectileMetadata';

class FakeProjectile {
  private readonly data = new Map<string, unknown>();

  public getData(key: string): unknown {
    return this.data.get(key);
  }

  public setData(key: string, value: unknown): this {
    this.data.set(key, value);
    return this;
  }
}

describe('projectile metadata', () => {
  it('stores typed ownership, kind and lifetime data', () => {
    const projectile = new FakeProjectile();
    const metadata = configureProjectileMetadata(projectile, {
      faction: 'hostile',
      kind: 'bossVolley',
      damage: 2,
      reflectable: true,
      serial: 7,
      expiresAt: 2_400,
    });

    expect(getProjectileMetadata(projectile)).toBe(metadata);
    expect(metadata).toMatchObject({
      faction: 'hostile',
      kind: 'bossVolley',
      damage: 2,
      reflectable: true,
      reflected: false,
      serial: 7,
      expiresAt: 2_400,
    });
  });

  it('records each target once for piercing-safe hit resolution', () => {
    const projectile = new FakeProjectile();
    const metadata = configureProjectileMetadata(projectile, { kind: 'piercing' });

    expect(markProjectileTarget(metadata, 'enemy-a')).toBe(true);
    expect(markProjectileTarget(metadata, 'enemy-a')).toBe(false);
    expect(markProjectileTarget(metadata, 'enemy-b')).toBe(true);
  });

  it('resets pooled state with a fresh hit-target set', () => {
    const projectile = new FakeProjectile();
    const previous = configureProjectileMetadata(projectile, {
      faction: 'hostile',
      kind: 'shockwave',
      damage: 1,
      serial: 9,
    });
    previous.hitTargetIds.add('old-target');

    resetProjectileMetadata(projectile);
    const reset = getProjectileMetadata(projectile);

    expect(reset).toMatchObject({
      faction: 'player',
      kind: 'blaster',
      damage: 0,
      reflectable: false,
      reflected: false,
      serial: 0,
      expiresAt: 0,
    });
    expect(reset.hitTargetIds).not.toBe(previous.hitTargetIds);
    expect(reset.hitTargetIds.size).toBe(0);
  });
});
