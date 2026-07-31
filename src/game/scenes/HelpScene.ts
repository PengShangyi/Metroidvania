import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { getInputDevice, setInputDevice, type InputDevice } from '../input/device';
import { bindFullscreenKey } from '../ui/fullscreen';
import { renderHelpPanel } from '../ui/renderHelpPanel';
import { bodyTextStyle } from '../ui/text';

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
    const changed = setInputDevice(this.registry, this.game.events, 'keyboardMouse');
    if (event.code === 'KeyH' || event.code === 'Escape') this.closeHelp();
    else if (changed) this.render();
  };
  private readonly pointerHandler = (): void => {
    const changed = setInputDevice(this.registry, this.game.events, 'keyboardMouse');
    if (changed) this.time.delayedCall(0, () => this.render());
  };

  public constructor() {
    super('help');
  }

  public create(data: HelpSceneData): void {
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
      const changed = setInputDevice(this.registry, this.game.events, 'gamepad');
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
    root.add(this.add.rectangle(240, 135, 480, 270, COLORS.void, 1));
    root.add(
      this.add
        .rectangle(240, 135, 468, 250, COLORS.panel, 0.98)
        .setStrokeStyle(1, COLORS.cyan, 0.85),
    );
    renderHelpPanel(this, root, device);
    const close = this.add
      .text(454, 22, '关闭 ×', {
        ...bodyTextStyle('#d8f7ff'),
        backgroundColor: '#25385c',
        padding: { x: 7, y: 4 },
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
