import Phaser from 'phaser';

import { ProceduralAudio } from '../audio/ProceduralAudio';
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
    this.load.image('title-bg', 'assets/backgrounds/title.webp');
    this.load.spritesheet('iya-atlas', 'assets/sprites/iya-atlas.png', {
      frameWidth: 24,
      frameHeight: 32,
    });
    this.load.spritesheet('base-icons', 'assets/ui/base-icons.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.registry.set(REGISTRY_KEYS.session, createNewSession());
    const audio = new ProceduralAudio();
    audio.arm();
    this.registry.set(REGISTRY_KEYS.audio, audio);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => audio.destroy());
    createProceduralTextures(this);
    createPlayerAnimations(this);

    const status = this.add
      .text(240, 135, '正在校准星骸信标…', bodyTextStyle('#8ce7ff'))
      .setOrigin(0.5);

    this.time.delayedCall(180, () => {
      status.destroy();
      this.scene.start('title');
    });
  }
}
