import { describe, expect, it } from 'vitest';

import { edgePressed, seedEdge } from './buttonEdge';

describe('手柄按键边沿', () => {
  it('上一帧没按、这一帧按着才算一次按下', () => {
    expect(edgePressed(true, false)).toBe(true);
    expect(edgePressed(true, true)).toBe(false);
    expect(edgePressed(false, true)).toBe(false);
    expect(edgePressed(false, false)).toBe(false);
  });

  it('按住不放的那一刻重建场景，不该凭空多出一次按下', () => {
    // 用手柄 LB 关掉帮助 → HelpScene 走 scene.start 交还标题页 → 标题页在 LB 仍按着时重建。
    let previous = seedEdge(true);
    expect(edgePressed(true, previous)).toBe(false);

    // 一直按住也不会再触发。
    previous = true;
    expect(edgePressed(true, previous)).toBe(false);

    // 松开再按才是玩家真正的第二次意图。
    previous = false;
    expect(edgePressed(true, previous)).toBe(true);
  });

  it('基准清成 false 就会立刻误报——这正是要防的写法', () => {
    expect(edgePressed(true, false)).toBe(true);
    expect(edgePressed(true, seedEdge(true))).toBe(false);
  });
});
