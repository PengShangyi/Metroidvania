import type Phaser from 'phaser';

import type { BiomeId } from '../world/types';

export type RegionAsset =
  | { kind: 'image'; key: string; url: string }
  | {
      kind: 'spritesheet';
      key: string;
      url: string;
      frameWidth: number;
      frameHeight: number;
    };

export const REGION_ASSETS = {
  vestibule: [
    {
      kind: 'image',
      key: 'vestibule-bg',
      url: 'assets/backgrounds/vestibule.webp',
    },
    {
      kind: 'image',
      key: 'vestibule-tile',
      url: 'assets/tiles/vestibule-tile.png',
    },
  ],
  bioforge: [
    {
      kind: 'image',
      key: 'bioforge-bg',
      url: 'assets/backgrounds/bioforge.webp',
    },
    {
      kind: 'image',
      key: 'bioforge-tile',
      url: 'assets/tiles/bioforge-tile.png',
    },
    {
      kind: 'spritesheet',
      key: 'spore-art',
      url: 'assets/sprites/spore-atlas.png',
      frameWidth: 22,
      frameHeight: 22,
    },
  ],
  reactor: [
    {
      kind: 'image',
      key: 'reactor-bg',
      url: 'assets/backgrounds/reactor.webp',
    },
    {
      kind: 'image',
      key: 'reactor-tile',
      url: 'assets/tiles/reactor-tile.png',
    },
    {
      kind: 'image',
      key: 'boss-art',
      url: 'assets/sprites/core-guardian.png',
    },
  ],
} as const satisfies Record<BiomeId, readonly RegionAsset[]>;

export function queueRegionAssets(scene: Phaser.Scene, biome: BiomeId): void {
  for (const asset of REGION_ASSETS[biome]) {
    if (scene.textures.exists(asset.key)) continue;
    if (asset.kind === 'image') scene.load.image(asset.key, asset.url);
    else {
      scene.load.spritesheet(asset.key, asset.url, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
      });
    }
  }
}

export function regionAssetsReady(scene: Phaser.Scene, biome: BiomeId): boolean {
  return REGION_ASSETS[biome].every((asset) => scene.textures.exists(asset.key));
}

export function createRegionAnimations(scene: Phaser.Scene, biome: BiomeId): void {
  if (
    biome === 'bioforge' &&
    scene.textures.exists('spore-art') &&
    !scene.anims.exists('spore-pulse')
  ) {
    scene.anims.create({
      key: 'spore-pulse',
      frames: scene.anims.generateFrameNumbers('spore-art', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
  }
}
