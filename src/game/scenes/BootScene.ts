import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { createProceduralTextures } from '../render/createProceduralTextures';
import { createPlayerAnimations } from '../render/playerAnimations';
import { createNewSession } from '../state/GameSession';
import { bodyTextStyle } from '../ui/text';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public preload(): void {
    this.load.image('vestibule-bg', 'assets/backgrounds/vestibule.webp');
    this.load.image('bioforge-bg', 'assets/backgrounds/bioforge.webp');
    this.load.image('reactor-bg', 'assets/backgrounds/reactor.webp');
    this.load.image('title-bg', 'assets/backgrounds/title.webp');
    this.load.image('bioforge-tile', 'assets/tiles/bioforge-tile.png');
    this.load.image('reactor-tile', 'assets/tiles/reactor-tile.png');
    this.load.image('boss', 'assets/sprites/core-guardian.png');
    this.load.image('iya-portrait', 'assets/sprites/iya-portrait.png');
    this.load.image('enemy-lineup-art', 'assets/sprites/enemy-lineup.png');
    this.load.spritesheet('iya-atlas', 'assets/sprites/iya-atlas.png', {
      frameWidth: 24,
      frameHeight: 32,
    });
    this.load.spritesheet('base-icons', 'assets/ui/base-icons.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('spore', 'assets/sprites/spore-atlas.png', {
      frameWidth: 22,
      frameHeight: 22,
    });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.registry.set(REGISTRY_KEYS.session, createNewSession());
    createProceduralTextures(this);
    createPlayerAnimations(this);
    if (!this.anims.exists('spore-pulse')) {
      this.anims.create({
        key: 'spore-pulse',
        frames: this.anims.generateFrameNumbers('spore', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }

    const status = this.add
      .text(240, 135, '正在校准星骸信标…', bodyTextStyle('#8ce7ff'))
      .setOrigin(0.5);

    this.time.delayedCall(180, () => {
      status.destroy();
      this.scene.start('title');
    });
  }
}
