export type ContextualHintId = 'reflect' | 'shield' | 'piercing' | 'causeway-high-road';

/** 战斗提示讲怎么打，地形提示讲怎么过去。后者以前一条都没有。 */
export type ContextualHintKind = 'combat' | 'traversal';

export interface ContextualHint {
  id: ContextualHintId;
  kind: ContextualHintKind;
  roomId: string;
  message: string;
}

export const CONTEXT_HINT_DELAY_MS = 950;
export const CONTEXT_HINT_DURATION_MS = 2_200;

/** 同一个房间里靠前的先讲，讲完一条再讲下一条——提示条一次只放得下一句。 */
const HINTS_BY_ROOM: Readonly<Record<string, readonly ContextualHint[]>> = {
  vestibule_depot: [
    {
      id: 'reflect',
      kind: 'combat',
      roomId: 'vestibule_depot',
      message: '挥刃提示：炮弹接近时挥刃，前 80ms 可反射',
    },
  ],
  vestibule_causeway: [
    // 地形提示排在盾兵提示前面：过不去酸池就见不到盾兵。贴地冲过去的起跳窗口
    // 只有十几像素，从左侧高台跳下来宽松得多，但房间里没有任何东西会这么说。
    {
      id: 'causeway-high-road',
      kind: 'traversal',
      roomId: 'vestibule_causeway',
      message: '地形提示：贴地冲过酸池很吃站位，先爬上左侧高台再冲刺跳下',
    },
    {
      id: 'shield',
      kind: 'combat',
      roomId: 'vestibule_causeway',
      message: '破盾提示：冲刺越过盾兵中心，再从抵达侧攻击核心',
    },
  ],
  bioforge_spire: [
    {
      id: 'piercing',
      kind: 'combat',
      roomId: 'bioforge_spire',
      message: '贯穿提示：墙跳后的第一枪可连续命中敌人',
    },
  ],
};

export function contextualHints(roomId: string): readonly ContextualHint[] {
  return HINTS_BY_ROOM[roomId] ?? [];
}

export class ContextualHintTracker {
  private readonly shown = new Set<ContextualHintId>();

  public hasShown(hint: ContextualHint): boolean {
    return this.shown.has(hint.id);
  }

  public markShown(hint: ContextualHint): void {
    this.shown.add(hint.id);
  }
}
