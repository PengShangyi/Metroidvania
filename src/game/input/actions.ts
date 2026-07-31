export const ACTION_NAMES = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'shoot',
  'melee',
  'dash',
  'interact',
  'map',
  'pause',
  'help',
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export type ActionValues = Record<ActionName, boolean>;

export interface ActionSnapshot {
  held: ActionValues;
  pressed: ActionValues;
  released: ActionValues;
  moveX: number;
  moveY: number;
  source: 'keyboard' | 'gamepad';
}

export function emptyActionValues(): ActionValues {
  return Object.fromEntries(ACTION_NAMES.map((action) => [action, false])) as ActionValues;
}

export function createActionSnapshot(
  current: ActionValues,
  previous: ActionValues,
  analogX = 0,
  analogY = 0,
  source: ActionSnapshot['source'] = 'keyboard',
): ActionSnapshot {
  const pressed = emptyActionValues();
  const released = emptyActionValues();

  for (const action of ACTION_NAMES) {
    pressed[action] = current[action] && !previous[action];
    released[action] = !current[action] && previous[action];
  }

  const digitalX = Number(current.right) - Number(current.left);
  const digitalY = Number(current.down) - Number(current.up);

  return {
    held: { ...current },
    pressed,
    released,
    moveX: digitalX === 0 ? applyDeadzone(analogX) : digitalX,
    moveY: digitalY === 0 ? applyDeadzone(analogY) : digitalY,
    source,
  };
}

function applyDeadzone(value: number): number {
  if (Math.abs(value) < 0.24) return 0;
  return Math.max(-1, Math.min(1, value));
}
