export interface PiercingChargeState {
  lastWallJumpSerial: number;
  armed: boolean;
}

export function updatePiercingCharge(
  state: PiercingChargeState,
  wallJumpSerial: number,
  grounded: boolean,
): PiercingChargeState {
  const wallJumped = wallJumpSerial !== state.lastWallJumpSerial;
  return {
    lastWallJumpSerial: wallJumpSerial,
    armed: grounded ? false : wallJumped || state.armed,
  };
}

export function consumePiercingCharge(state: PiercingChargeState): {
  piercing: boolean;
  state: PiercingChargeState;
} {
  return {
    piercing: state.armed,
    state: { ...state, armed: false },
  };
}

export function resetPiercingCharge(wallJumpSerial: number): PiercingChargeState {
  return { lastWallJumpSerial: wallJumpSerial, armed: false };
}
