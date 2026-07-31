import Phaser from 'phaser';

import './style.css';

class BootstrapScene extends Phaser.Scene {
  public constructor() {
    super('bootstrap');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#070b18');
    this.add
      .text(240, 124, '星骸回声', {
        color: '#8ce7ff',
        fontFamily: 'monospace',
        fontSize: '24px',
      })
      .setOrigin(0.5);
    this.add
      .text(240, 154, 'STAR ECHO · ENGINE ONLINE', {
        color: '#7184a8',
        fontFamily: 'monospace',
        fontSize: '8px',
      })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 480,
  height: 270,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#070b18',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootstrapScene],
});
