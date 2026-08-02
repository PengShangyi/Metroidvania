import Phaser from 'phaser';

import type { ProceduralAudio } from '../audio/ProceduralAudio';
import { COLORS, REGISTRY_KEYS } from '../constants';
import { setInputDevice, type InputDevice } from '../input/device';
import {
  createBrowserSaveService,
  type SaveReadResult,
  type SaveService,
} from '../save/SaveService';
import { createNewSession } from '../state/GameSession';
import { resumeSession } from '../state/resumePoint';
import { bindFullscreenKey } from '../ui/fullscreen';
import { BUTTON, TITLE, UI } from '../ui/layout';
import { hudTextStyle, proseTextStyle, titleTextStyle } from '../ui/text';

export class TitleScene extends Phaser.Scene {
  private saveService!: SaveService;
  private readResult!: SaveReadResult;
  private confirmNewGame = false;
  private previousGamepadHelp = false;

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

    this.add.text(UI.centerX, TITLE.heading.y, '星骸回声', titleTextStyle()).setOrigin(0.5);
    this.add
      .text(UI.centerX, TITLE.version.y, 'STAR ECHO // v0.2.0', hudTextStyle('#8da1c8'))
      .setOrigin(0.5);

    const [continueY, newY, tutorialY, helpY] = TITLE.menuRows;
    const hasSave = this.readResult.status === 'valid';
    const continueButton = this.createMenuButton(continueY, '继续任务', hasSave, () =>
      this.continueGame(),
    );
    const newButton = this.createMenuButton(newY, '新建任务', true, () =>
      this.startNewGame(newButton),
    );
    this.createMenuButton(tutorialY, '新手训练', true, () => this.scene.start('tutorial'));
    this.createMenuButton(helpY, '帮助与控制', true, () => this.openHelp('keyboardMouse'));

    if (hasSave) {
      this.input.keyboard?.once('keydown-ENTER', () => this.continueGame());
      continueButton.setBackgroundColor('#43d8e8').setColor('#07101d');
    } else {
      newButton.setBackgroundColor('#43d8e8').setColor('#07101d');
      this.input.keyboard?.once('keydown-ENTER', () => this.startNewGame(newButton));
    }

    this.add
      .text(
        UI.centerX,
        TITLE.saveStatus.y,
        this.saveStatusText(),
        proseTextStyle(this.saveStatusColor()),
      )
      .setOrigin(0.5);
    this.add
      .text(
        UI.centerX,
        TITLE.keyHint.y,
        'ENTER 开始 · T 训练 · H 帮助 · F 全屏',
        hudTextStyle('#8da1c8'),
      )
      .setOrigin(0.5);
    this.input.keyboard?.once('keydown-T', () => this.scene.start('tutorial'));
    this.input.keyboard?.once('keydown-H', () => this.openHelp('keyboardMouse'));
  }

  public update(): void {
    const pad = this.input.gamepad?.getPad(0);
    const helpPressed = pad?.buttons[4]?.pressed ?? false;
    const active =
      Boolean(pad) &&
      ((pad?.buttons.some((button) => button.pressed) ?? false) ||
        Math.abs(pad?.axes[0]?.getValue() ?? 0) > 0.24 ||
        Math.abs(pad?.axes[1]?.getValue() ?? 0) > 0.24);
    if (active) setInputDevice(this.registry, 'gamepad');
    if (helpPressed && !this.previousGamepadHelp) this.openHelp('gamepad');
    this.previousGamepadHelp = helpPressed;
  }

  private createMenuButton(
    y: number,
    label: string,
    enabled: boolean,
    action: () => void,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(UI.centerX, y, label, {
        ...hudTextStyle(enabled ? '#d8f7ff' : '#4f5d78'),
        backgroundColor: '#152445',
        padding: { x: BUTTON.paddingX, y: BUTTON.paddingY },
      })
      .setOrigin(0.5);
    if (enabled) {
      button.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        setInputDevice(this.registry, 'keyboardMouse');
        action();
      });
    }
    return button;
  }

  private continueGame(): void {
    if (this.readResult.status !== 'valid') return;
    this.registry.set(REGISTRY_KEYS.session, resumeSession(this.readResult.session));
    this.scene.start('play');
  }

  private openHelp(device: InputDevice): void {
    setInputDevice(this.registry, device);
    this.scene.start('help', { returnScene: 'title' });
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
      this.add
        .image(0, 0, 'title-bg')
        .setOrigin(0)
        .setDisplaySize(UI.width, UI.height)
        .setAlpha(0.72);
      this.add.rectangle(UI.centerX, TITLE.band.y, UI.width, TITLE.band.height, COLORS.void, 0.48);
    }
    // 立绘原先只在「没有标题图」时才画，而标题图一直存在，所以这张图从未露过面。
    // 现在按 186×384 原生尺寸绘制：原先的 setDisplaySize(111,229) 是 0.597 倍分数重采样。
    if (this.textures.exists('iya-portrait')) {
      this.add
        .image(TITLE.portrait.x, TITLE.portrait.y, 'iya-portrait')
        .setOrigin(0.5, 1)
        .setAlpha(0.5);
    }
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.steel, this.textures.exists('title-bg') ? 0.08 : 0.22);
    for (let x = TITLE.grid.firstX; x < UI.width; x += TITLE.grid.step) {
      graphics.fillRect(x, 0, TITLE.grid.width, UI.height);
    }
    graphics.lineStyle(1, COLORS.cyan, 0.2);
    for (const radius of TITLE.rings.radii) {
      graphics.strokeCircle(TITLE.rings.x, TITLE.rings.y, radius);
    }
    graphics.fillStyle(COLORS.cyan, 0.08);
    graphics.fillCircle(TITLE.rings.x, TITLE.rings.y, TITLE.rings.fillRadius);
  }
}
