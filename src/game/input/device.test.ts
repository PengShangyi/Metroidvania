import { describe, expect, it } from 'vitest';

import { resolveInputDevice } from './device';

describe('input device resolution', () => {
  it('keeps the most recently used device while input is idle', () => {
    expect(resolveInputDevice('gamepad', false, false)).toBe('gamepad');
    expect(resolveInputDevice('keyboardMouse', false, false)).toBe('keyboardMouse');
  });

  it('switches to the device that is actively producing input', () => {
    expect(resolveInputDevice('gamepad', true, false)).toBe('keyboardMouse');
    expect(resolveInputDevice('keyboardMouse', false, true)).toBe('gamepad');
  });

  it('prefers explicit gamepad activity when both sources fire in one frame', () => {
    expect(resolveInputDevice('keyboardMouse', true, true)).toBe('gamepad');
  });
});
