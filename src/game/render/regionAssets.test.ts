import { describe, expect, it } from 'vitest';

import { REGION_ASSETS } from './regionAssets';

describe('region asset catalogue', () => {
  it('partitions assets across all three playable biomes', () => {
    expect(Object.keys(REGION_ASSETS)).toEqual(['vestibule', 'bioforge', 'reactor']);
    expect(REGION_ASSETS.vestibule.map((asset) => asset.key)).toEqual([
      'vestibule-bg',
      'vestibule-tile',
    ]);
    expect(REGION_ASSETS.bioforge.map((asset) => asset.key)).toEqual([
      'bioforge-bg',
      'bioforge-tile',
      'spore-art',
    ]);
    expect(REGION_ASSETS.reactor.map((asset) => asset.key)).toEqual([
      'reactor-bg',
      'reactor-tile',
      'boss-art',
    ]);
  });

  it('uses unique keys and public-relative asset URLs', () => {
    const assets = Object.values(REGION_ASSETS).flat();
    expect(new Set(assets.map((asset) => asset.key)).size).toBe(assets.length);
    for (const asset of assets) expect(asset.url).toMatch(/^assets\/.+\.(png|webp)$/);
  });
});
