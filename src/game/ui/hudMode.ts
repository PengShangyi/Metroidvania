export type OverlayMode = 'game' | 'map' | 'pause' | 'settings' | 'help';

/** 能开合覆盖层的三个键：TAB / ESC / H，手柄的 VIEW / MENU / LB 走同一套。 */
export type OverlayKey = 'map' | 'pause' | 'help';

export type OverlayAction =
  | { kind: 'none' }
  | { kind: 'open'; mode: Exclude<OverlayMode, 'game'> }
  | { kind: 'close' }
  | { kind: 'closeHelp' };

const NONE: OverlayAction = { kind: 'none' };

/**
 * 覆盖层的开合规则。抽成纯函数是因为它决定的不只是「显示哪个面板」——
 * HudScene 用同一个 mode 控制常驻 HUD 的可见性，一旦某个键在某个模式下没有出路，
 * 玩家就会卡在「HUD 整层不见」的状态里，而这种分支只有穷举才看得出来。
 *
 * help 只能被 ESC 或 H 关掉，TAB 在 help 下无效；settings 与 map 按 ESC 退回上一级
 * 的暂停菜单，而不是直接回到游戏。
 */
export function overlayKeyAction(mode: OverlayMode, key: OverlayKey): OverlayAction {
  if (key === 'help')
    return mode === 'help' ? { kind: 'closeHelp' } : { kind: 'open', mode: 'help' };
  if (key === 'map') {
    if (mode === 'map') return { kind: 'close' };
    if (mode === 'game') return { kind: 'open', mode: 'map' };
    return NONE;
  }
  if (mode === 'help') return { kind: 'closeHelp' };
  if (mode === 'pause') return { kind: 'close' };
  return { kind: 'open', mode: 'pause' };
}
