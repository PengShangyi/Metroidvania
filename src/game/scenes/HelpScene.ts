import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { getInputDevice, setInputDevice, type InputDevice } from '../input/device';
import { bindFullscreenKey } from '../ui/fullscreen';
import { BUTTON, OVERLAY, UI } from '../ui/layout';
import { renderHelpPanel } from '../ui/renderHelpPanel';
import { hudTextStyle } from '../ui/text';

interface HelpSceneData {
  returnScene?: string;
  resumeScene?: boolean;
}

export class HelpScene extends Phaser.Scene {
  private root?: Phaser.GameObjects.Container;
  private returnScene = 'title';
  private resumeScene = false;
  private renderedDevice?: InputDevice;
  private previousHelpPressed = false;
  private closing = false;
  private readonly keyHandler = (event: KeyboardEvent): void => {
    const changed = setInputDevice(this.registry, 'keyboardMouse');
    if (event.code === 'KeyH' || event.code === 'Escape') this.closeHelp();
    else if (changed) this.render();
  };
  private readonly pointerHandler = (): void => {
    const changed = setInputDevice(this.registry, 'keyboardMouse');
    if (changed) this.time.delayedCall(0, () => this.render());
  };

  public constructor() {
    super('help');
  }

  public create(data: HelpSceneData): void {
    // Phaser 复用 Scene 实例，而 SHUTDOWN 只 destroy 了 root、没有置空它：destroy 过的
    // Container 仍是 truthy，render() 的「设备没变就不用重画」守卫于是命中，同一设备第二次
    // 打开帮助只会得到一片空白，uiMode 也停在上一个值。训练关里两个场景已经 pause 了，
    // 玩家看到的就是画面卡住。
    this.root = undefined;
    this.renderedDevice = undefined;
    this.returnScene = data.returnScene ?? 'title';
    this.resumeScene = data.resumeScene ?? false;
    this.closing = false;
    this.previousHelpPressed = this.input.gamepad?.getPad(0)?.buttons[4]?.pressed ?? false;
    bindFullscreenKey(this);
    this.input.keyboard?.on('keydown', this.keyHandler);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerHandler);
    this.render();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.keyHandler);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.pointerHandler);
      this.root?.destroy(true);
      this.root = undefined;
    });
  }

  public update(): void {
    const pad = this.input.gamepad?.getPad(0);
    const helpPressed = pad?.buttons[4]?.pressed ?? false;
    const gamepadActive =
      Boolean(pad) &&
      ((pad?.buttons.some((button) => button.pressed) ?? false) ||
        Math.abs(pad?.axes[0]?.getValue() ?? 0) > 0.24 ||
        Math.abs(pad?.axes[1]?.getValue() ?? 0) > 0.24);
    if (gamepadActive) {
      const changed = setInputDevice(this.registry, 'gamepad');
      if (changed) this.render();
    }
    if (helpPressed && !this.previousHelpPressed) this.closeHelp();
    this.previousHelpPressed = helpPressed;
  }

  private render(): void {
    if (this.closing) return;
    const device = getInputDevice(this.registry);
    if (device === this.renderedDevice && this.root) return;
    this.renderedDevice = device;
    this.root?.destroy(true);
    const root = this.add.container(0, 0).setDepth(100);
    root.add(this.add.rectangle(UI.centerX, UI.centerY, UI.width, UI.height, COLORS.void, 1));
    root.add(
      this.add
        .rectangle(
          UI.centerX,
          UI.centerY,
          OVERLAY.panel.width,
          OVERLAY.panel.height,
          COLORS.panel,
          0.98,
        )
        .setStrokeStyle(1, COLORS.cyan, 0.85),
    );
    renderHelpPanel(this, root, device);
    const close = this.add
      .text(OVERLAY.close.x, OVERLAY.close.y, '关闭 ×', {
        ...hudTextStyle('#d8f7ff'),
        backgroundColor: '#25385c',
        padding: { x: BUTTON.paddingX, y: BUTTON.paddingY },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeHelp());
    root.add(close);
    this.root = root;
    this.registry.set(REGISTRY_KEYS.uiMode, `help-${device}`);
  }

  private closeHelp(): void {
    if (this.closing) return;
    this.closing = true;
    this.registry.set(REGISTRY_KEYS.uiMode, this.resumeScene ? 'game' : this.returnScene);
    if (this.resumeScene) {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    } else {
      this.scene.start(this.returnScene);
    }
  }
}
