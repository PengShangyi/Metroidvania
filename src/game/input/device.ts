import type Phaser from 'phaser';

import { REGISTRY_KEYS } from '../constants';

export type InputDevice = 'keyboardMouse' | 'gamepad';

export const INPUT_DEVICE_CHANGED = 'star-echo-input-device-changed';

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

export function setInputDevice(
  registry: Phaser.Data.DataManager,
  events: Phaser.Events.EventEmitter,
  device: InputDevice,
): boolean {
  if (getInputDevice(registry) === device) return false;
  registry.set(REGISTRY_KEYS.inputDevice, device);
  events.emit(INPUT_DEVICE_CHANGED, device);
  return true;
}
