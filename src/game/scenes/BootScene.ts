import Phaser from 'phaser';

import { ProceduralAudio } from '../audio/ProceduralAudio';
import { COLORS, REGISTRY_KEYS } from '../constants';
import type { InputDevice } from '../input/device';
import { createProceduralTextures } from '../render/createProceduralTextures';
import { createPlayerAnimations } from '../render/playerAnimations';
import { createNewSession } from '../state/GameSession';
import { BOOT } from '../ui/layout';
import { proseTextStyle } from '../ui/text';

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
    this.load.image('iya-portrait', 'assets/sprites/iya-portrait.png');
    // 四只敌人的真贴图用的就是程序化占位图的 key：createProceduralTextures 里的
    // createTexture 有 textures.exists 守卫，真图先到就自动让位，加载失败仍会回退。
    for (const key of ['crawler', 'crawler-shielded', 'crawler-exposed', 'sentry', 'turret']) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.registry.set(REGISTRY_KEYS.session, createNewSession());
    this.registry.set(REGISTRY_KEYS.inputDevice, 'keyboardMouse' satisfies InputDevice);
    const audio = new ProceduralAudio();
    audio.arm();
    this.registry.set(REGISTRY_KEYS.audio, audio);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => audio.destroy());
    createProceduralTextures(this);
    createPlayerAnimations(this);

    const status = this.add
      .text(BOOT.loading.x, BOOT.loading.y, '正在校准星骸信标…', proseTextStyle('#8ce7ff'))
      .setOrigin(0.5);

    this.time.delayedCall(180, () => {
      status.destroy();
      this.scene.start('title');
    });
  }
}
