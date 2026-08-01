import type Phaser from 'phaser';

import { REGISTRY_KEYS } from '../constants';

export type InputDevice = 'keyboardMouse' | 'gamepad';

export function resolveInputDevice(
  previous: InputDevice,
  keyboardMouseActive: boolean,
  gamepadActive: boolean,
): InputDevice {
  if (gamepadActive) return 'gamepad';
  if (keyboardMouseActive) return 'keyboardMouse';
  return previous;
}

export function getInputDevice(registry: Phaser.Data.DataManager): InputDevice {
  const value = registry.get(REGISTRY_KEYS.inputDevice) as InputDevice | undefined;
  return value === 'gamepad' ? 'gamepad' : 'keyboardMouse';
}

/** 返回值表示设备是否真的换了；各场景据此决定要不要重绘按键提示。 */
export function setInputDevice(registry: Phaser.Data.DataManager, device: InputDevice): boolean {
  if (getInputDevice(registry) === device) return false;
  registry.set(REGISTRY_KEYS.inputDevice, device);
  return true;
}
