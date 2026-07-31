import { describe, expect, it } from 'vitest';

import { consumePiercingCharge, resetPiercingCharge, updatePiercingCharge } from './piercingRules';

describe('wall-jump piercing charge', () => {
  it('arms once for a new wall-jump serial and refreshes on another wall jump', () => {
    let state = resetPiercingCharge(3);
    state = updatePiercingCharge(state, 4, false);
    expect(state).toEqual({ lastWallJumpSerial: 4, armed: true });

    state = consumePiercingCharge(state).state;
    expect(updatePiercingCharge(state, 4, false).armed).toBe(false);
    expect(updatePiercingCharge(state, 5, false).armed).toBe(true);
  });

  it('consumes only the armed shot and clears the charge on landing or reset', () => {
    const armed = updatePiercingCharge(resetPiercingCharge(1), 2, false);
    expect(consumePiercingCharge(armed)).toMatchObject({ piercing: true, state: { armed: false } });
    expect(updatePiercingCharge(armed, 2, true).armed).toBe(false);
    expect(resetPiercingCharge(2)).toEqual({ lastWallJumpSerial: 2, armed: false });
    expect(consumePiercingCharge(resetPiercingCharge(2)).piercing).toBe(false);
  });
});
