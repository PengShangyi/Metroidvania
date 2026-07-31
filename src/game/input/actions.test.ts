import { describe, expect, it } from 'vitest';

import { createActionSnapshot, emptyActionValues } from './actions';

describe('action snapshots', () => {
  it('distinguishes held, pressed and released input', () => {
    const previous = emptyActionValues();
    previous.jump = true;
    const current = emptyActionValues();
    current.right = true;

    const snapshot = createActionSnapshot(current, previous);

    expect(snapshot.held.right).toBe(true);
    expect(snapshot.pressed.right).toBe(true);
    expect(snapshot.released.jump).toBe(true);
    expect(snapshot.moveX).toBe(1);
  });

  it('applies a deadzone while preserving meaningful analog movement', () => {
    const empty = emptyActionValues();

    expect(createActionSnapshot(empty, empty, 0.2).moveX).toBe(0);
    expect(createActionSnapshot(empty, empty, -0.65).moveX).toBe(-0.65);
  });

  it('gives digital movement priority over an analog axis', () => {
    const current = emptyActionValues();
    current.left = true;

    expect(createActionSnapshot(current, emptyActionValues(), 0.8).moveX).toBe(-1);
  });
});
