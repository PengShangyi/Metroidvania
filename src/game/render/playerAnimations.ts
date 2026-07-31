import type Phaser from 'phaser';

interface AnimationDefinition {
  key: string;
  start: number;
  end: number;
  frameRate: number;
  repeat?: number;
}

const DEFINITIONS: AnimationDefinition[] = [
  { key: 'idle', start: 0, end: 1, frameRate: 3, repeat: -1 },
  { key: 'run', start: 2, end: 5, frameRate: 10, repeat: -1 },
  { key: 'jump', start: 6, end: 6, frameRate: 1 },
  { key: 'fall', start: 7, end: 7, frameRate: 1 },
  { key: 'shoot', start: 8, end: 9, frameRate: 14 },
  { key: 'slash', start: 10, end: 12, frameRate: 16 },
  { key: 'dash', start: 13, end: 13, frameRate: 1 },
  { key: 'hurt', start: 14, end: 14, frameRate: 1 },
  { key: 'death', start: 15, end: 18, frameRate: 9 },
];

export function createPlayerAnimations(scene: Phaser.Scene): void {
  for (const definition of DEFINITIONS) {
    const key = `iya-${definition.key}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers('iya-atlas', {
        start: definition.start,
        end: definition.end,
      }),
      frameRate: definition.frameRate,
      repeat: definition.repeat ?? 0,
    });
  }
}
