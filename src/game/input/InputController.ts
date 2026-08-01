import Phaser from 'phaser';

import {
  createActionSnapshot,
  emptyActionValues,
  type ActionName,
  type ActionSnapshot,
  type ActionValues,
} from './actions';
import { getInputDevice, resolveInputDevice, setInputDevice, type InputDevice } from './device';

type KeyMap = Record<ActionName, Phaser.Input.Keyboard.Key[]>;

export class InputController {
  private readonly scene: Phaser.Scene;
  private readonly keys: KeyMap;
  private previous = emptyActionValues();
  private snapshot = createActionSnapshot(this.previous, this.previous);
  private lastDevice: InputDevice;
  private readonly blurHandler: () => void;
  private readonly keyboardActivityHandler: () => void;
  private readonly pointerActivityHandler: () => void;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.lastDevice = getInputDevice(scene.registry);
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('键盘输入不可用');

    const key = (code: number): Phaser.Input.Keyboard.Key => keyboard.addKey(code);
    this.keys = {
      left: [key(Phaser.Input.Keyboard.KeyCodes.A), key(Phaser.Input.Keyboard.KeyCodes.LEFT)],
      right: [key(Phaser.Input.Keyboard.KeyCodes.D), key(Phaser.Input.Keyboard.KeyCodes.RIGHT)],
      up: [key(Phaser.Input.Keyboard.KeyCodes.W), key(Phaser.Input.Keyboard.KeyCodes.UP)],
      down: [key(Phaser.Input.Keyboard.KeyCodes.S), key(Phaser.Input.Keyboard.KeyCodes.DOWN)],
      jump: [key(Phaser.Input.Keyboard.KeyCodes.SPACE)],
      shoot: [key(Phaser.Input.Keyboard.KeyCodes.J)],
      melee: [key(Phaser.Input.Keyboard.KeyCodes.K)],
      dash: [key(Phaser.Input.Keyboard.KeyCodes.SHIFT)],
      interact: [key(Phaser.Input.Keyboard.KeyCodes.E)],
      map: [key(Phaser.Input.Keyboard.KeyCodes.TAB)],
      pause: [key(Phaser.Input.Keyboard.KeyCodes.ESC)],
      help: [key(Phaser.Input.Keyboard.KeyCodes.H)],
    };

    this.blurHandler = () => this.clear();
    this.keyboardActivityHandler = () => this.useDevice('keyboardMouse');
    this.pointerActivityHandler = () => this.useDevice('keyboardMouse');
    window.addEventListener('blur', this.blurHandler);
    keyboard.on('keydown', this.keyboardActivityHandler);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerActivityHandler);
  }

  public update(): ActionSnapshot {
    const keyboard = this.readKeyboard();
    const gamepad = this.readGamepad();
    const hasKeyboardActivity = Object.values(keyboard).some(Boolean);
    const hasGamepadActivity =
      Object.values(gamepad.actions).some(Boolean) || gamepad.axisX !== 0 || gamepad.axisY !== 0;
    this.lastDevice = resolveInputDevice(this.lastDevice, hasKeyboardActivity, hasGamepadActivity);
    if (hasKeyboardActivity || hasGamepadActivity) this.useDevice(this.lastDevice);
    const current = hasGamepadActivity ? gamepad.actions : keyboard;

    this.snapshot = createActionSnapshot(
      current,
      this.previous,
      gamepad.axisX,
      gamepad.axisY,
      this.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard',
    );
    this.previous = { ...current };
    return this.snapshot;
  }

  public get current(): ActionSnapshot {
    return this.snapshot;
  }

  public clear(): void {
    this.previous = emptyActionValues();
    this.snapshot = createActionSnapshot(this.previous, this.previous);
    for (const keys of Object.values(this.keys)) {
      for (const key of keys) key.reset();
    }
  }

  public destroy(): void {
    window.removeEventListener('blur', this.blurHandler);
    this.scene.input.keyboard?.off('keydown', this.keyboardActivityHandler);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.pointerActivityHandler);
    this.clear();
  }

  private readKeyboard(): ActionValues {
    const actions = emptyActionValues();
    for (const [action, keys] of Object.entries(this.keys) as [
      ActionName,
      Phaser.Input.Keyboard.Key[],
    ][]) {
      actions[action] = keys.some((key) => key.isDown);
    }
    return actions;
  }

  private readGamepad(): { actions: ActionValues; axisX: number; axisY: number } {
    const actions = emptyActionValues();
    const pad = this.scene.input.gamepad?.getPad(0);
    if (!pad) return { actions, axisX: 0, axisY: 0 };

    const axisX = pad.axes[0]?.getValue() ?? 0;
    const axisY = pad.axes[1]?.getValue() ?? 0;
    actions.left = pad.left || axisX < -0.24;
    actions.right = pad.right || axisX > 0.24;
    actions.up = pad.up || axisY < -0.24;
    actions.down = pad.down || axisY > 0.24;
    actions.jump = pad.A;
    actions.dash = pad.B;
    actions.shoot = pad.X;
    actions.melee = pad.Y;
    actions.interact = pad.buttons[5]?.pressed ?? false;
    actions.map = pad.buttons[8]?.pressed ?? false;
    actions.pause = pad.buttons[9]?.pressed ?? false;
    actions.help = pad.buttons[4]?.pressed ?? false;

    return { actions, axisX, axisY };
  }

  private useDevice(device: InputDevice): void {
    this.lastDevice = device;
    setInputDevice(this.scene.registry, device);
  }
}
