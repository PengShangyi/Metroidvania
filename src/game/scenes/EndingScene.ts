import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { setInputDevice, type InputDevice } from '../input/device';
import type { GameSessionState } from '../state/GameSession';
import { ENDING, UI } from '../ui/layout';
import { hudTextStyle, proseTextStyle, titleTextStyle } from '../ui/text';
import { COMPLETION_TOTAL, completionPercent } from '../ui/completion';

export class EndingScene extends Phaser.Scene {
  private previousGamepadHelp = false;

  public constructor() {
    super('ending');
  }

  public create(): void {
    const session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.cameras.main.setBackgroundColor(COLORS.void);
    if (this.textures.exists('reactor-bg')) {
      // 世界层资源用在 UI 场景里：整数 2× 最近邻放大，和世界相机做的事完全一样。
      this.add
        .image(0, 0, 'reactor-bg')
        .setOrigin(0)
        .setDisplaySize(UI.width, UI.height)
        .setAlpha(0.22);
    }
    this.add.text(UI.centerX, ENDING.heading.y, '信号归于寂静', titleTextStyle()).setOrigin(0.5);
    // 叙事段落和数值原本挤在同一个 align:'center' 的 Text 里，数值列因此对不齐。
    this.add
      .text(
        UI.centerX,
        ENDING.prose.y,
        '伊娅切断了零点核心的回声循环。沉睡的星骸第一次拥有真正的寂静。',
        { ...proseTextStyle('#8ce7ff'), align: 'center' },
      )
      .setOrigin(0.5, 0)
      .setWordWrapWidth(ENDING.prose.wrap);
    this.add
      .text(
        UI.centerX,
        ENDING.stats.y,
        [
          `任务用时  ${this.formatTime(session.elapsedMs)}`,
          `探索房间  ${session.visitedRooms.size}/${COMPLETION_TOTAL.rooms}`,
          `残留记录  ${session.readLore.size}/${COMPLETION_TOTAL.lore}`,
          `综合完成度  ${completionPercent(session)}%`,
        ],
        { ...hudTextStyle('#8ce7ff'), align: 'center' },
      )
      .setOrigin(0.5, 0);
    this.add
      .text(
        UI.centerX,
        ENDING.keyHint.y,
        'ENTER 继续探索 · ESC 标题 · H 帮助',
        hudTextStyle('#ffb454'),
      )
      .setOrigin(0.5);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('play'));
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('title'));
    this.input.keyboard?.once('keydown-H', () => this.openHelp('keyboardMouse'));
    this.previousGamepadHelp = this.input.gamepad?.getPad(0)?.buttons[4]?.pressed ?? false;
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

  private openHelp(device: InputDevice): void {
    setInputDevice(this.registry, device);
    this.scene.start('help', { returnScene: 'ending' });
  }

  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
