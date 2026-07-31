export type ContextualCombatHintId = 'reflect' | 'shield' | 'piercing';

export interface ContextualCombatHint {
  id: ContextualCombatHintId;
  roomId: string;
  message: string;
}

export const CONTEXT_HINT_DELAY_MS = 950;
export const CONTEXT_HINT_DURATION_MS = 2_200;

const HINTS_BY_ROOM: Readonly<Record<string, ContextualCombatHint>> = {
  vestibule_depot: {
    id: 'reflect',
    roomId: 'vestibule_depot',
    message: '挥刃提示：炮弹接近时挥刃，前 80ms 可反射',
  },
  vestibule_causeway: {
    id: 'shield',
    roomId: 'vestibule_causeway',
    message: '破盾提示：冲刺越过盾兵中心，再从抵达侧攻击核心',
  },
  bioforge_spire: {
    id: 'piercing',
    roomId: 'bioforge_spire',
    message: '贯穿提示：墙跳后的第一枪可连续命中敌人',
  },
};

export function contextualCombatHint(roomId: string): ContextualCombatHint | undefined {
  return HINTS_BY_ROOM[roomId];
}

export class ContextualCombatHintTracker {
  private readonly shown = new Set<ContextualCombatHintId>();

  public hasShown(hint: ContextualCombatHint): boolean {
    return this.shown.has(hint.id);
  }

  public markShown(hint: ContextualCombatHint): void {
    this.shown.add(hint.id);
  }
}
