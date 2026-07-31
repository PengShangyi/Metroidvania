import Phaser from 'phaser';

import type { ProceduralAudio } from '../audio/ProceduralAudio';
import { COLORS, REGISTRY_KEYS } from '../constants';
import {
  createBrowserSaveService,
  type SaveReadResult,
  type SaveService,
} from '../save/SaveService';
import { createNewSession } from '../state/GameSession';
import { bindFullscreenKey } from '../ui/fullscreen';
import { bodyTextStyle, titleTextStyle } from '../ui/text';

export class TitleScene extends Phaser.Scene {
  private saveService!: SaveService;
  private readResult!: SaveReadResult;
  private confirmNewGame = false;

  public constructor() {
    super('title');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.void);
    (this.registry.get(REGISTRY_KEYS.audio) as ProceduralAudio | undefined)?.stopAmbience();
    this.drawBackdrop();
    bindFullscreenKey(this);
    this.saveService = createBrowserSaveService();
    this.readResult = this.saveService.read();

    this.add.text(240, 52, '星骸回声', titleTextStyle()).setOrigin(0.5);
    this.add.text(240, 78, 'STAR ECHO // v0.1.0', bodyTextStyle('#7184a8')).setOrigin(0.5);

    const hasSave = this.readResult.status === 'valid';
    const continueButton = this.createMenuButton(128, '继续任务', hasSave, () =>
      this.continueGame(),
    );
    const newButton = this.createMenuButton(160, '新建任务', true, () =>
      this.startNewGame(newButton),
    );

    if (hasSave) {
      this.input.keyboard?.once('keydown-ENTER', () => this.continueGame());
      continueButton.setBackgroundColor('#43d8e8').setColor('#07101d');
    } else {
      newButton.setBackgroundColor('#43d8e8').setColor('#07101d');
      this.input.keyboard?.once('keydown-ENTER', () => this.startNewGame(newButton));
    }

    this.add
      .text(240, 205, this.saveStatusText(), bodyTextStyle(this.saveStatusColor()))
      .setOrigin(0.5);
    this.add
      .text(240, 224, '鼠标选择 · ENTER 快速开始 · F 全屏', bodyTextStyle('#7184a8'))
      .setOrigin(0.5);
  }

  private createMenuButton(
    y: number,
    label: string,
    enabled: boolean,
    action: () => void,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(240, y, label, {
        ...bodyTextStyle(enabled ? '#d8f7ff' : '#4f5d78'),
        backgroundColor: '#152445',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5);
    if (enabled) button.setInteractive({ useHandCursor: true }).on('pointerdown', action);
    return button;
  }

  private continueGame(): void {
    if (this.readResult.status !== 'valid') return;
    this.registry.set(REGISTRY_KEYS.session, this.readResult.session);
    this.scene.start('play');
  }

  private startNewGame(button: Phaser.GameObjects.Text): void {
    if (this.readResult.status === 'valid' && !this.confirmNewGame) {
      this.confirmNewGame = true;
      button.setText('再次选择以覆盖记录').setBackgroundColor('#ff5678').setColor('#07101d');
      this.time.delayedCall(3_000, () => {
        this.confirmNewGame = false;
        button.setText('新建任务').setBackgroundColor('#152445').setColor('#d8f7ff');
      });
      return;
    }
    const session = createNewSession();
    session.settings = this.saveService.readSettings();
    this.saveService.erase();
    this.registry.set(REGISTRY_KEYS.session, session);
    this.scene.start('play');
  }

  private saveStatusText(): string {
    if (this.readResult.status === 'valid') return '检测到终端同步记录';
    if (this.readResult.status === 'corrupt') return '存档损坏：已安全隔离，可新建任务';
    if (this.readResult.status === 'unsupported') return '存档版本不兼容，可新建任务';
    return '未检测到同步记录';
  }

  private saveStatusColor(): string {
    return this.readResult.status === 'corrupt' || this.readResult.status === 'unsupported'
      ? '#ff5678'
      : '#8da1c8';
  }

  private drawBackdrop(): void {
    if (this.textures.exists('title-bg')) {
      this.add.image(0, 0, 'title-bg').setOrigin(0).setDisplaySize(480, 270).setAlpha(0.72);
      this.add.rectangle(240, 52, 480, 104, COLORS.void, 0.48);
    } else if (this.textures.exists('iya-portrait')) {
      this.add
        .image(410, 262, 'iya-portrait')
        .setOrigin(0.5, 1)
        .setDisplaySize(121, 250)
        .setAlpha(0.24);
    }
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.steel, this.textures.exists('title-bg') ? 0.08 : 0.22);
    for (let x = 24; x < 480; x += 48) graphics.fillRect(x, 0, 2, 270);
    graphics.lineStyle(1, COLORS.cyan, 0.2);
    graphics.strokeCircle(240, 134, 94);
    graphics.strokeCircle(240, 134, 118);
    graphics.fillStyle(COLORS.cyan, 0.08);
    graphics.fillCircle(240, 134, 72);
  }
}
