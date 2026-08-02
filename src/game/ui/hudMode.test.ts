import { describe, expect, it } from 'vitest';

import { overlayKeyAction, type OverlayKey, type OverlayMode } from './hudMode';

const MODES: OverlayMode[] = ['game', 'map', 'pause', 'settings', 'help'];
const KEYS: OverlayKey[] = ['map', 'pause', 'help'];

describe('覆盖层开合规则', () => {
  it('TAB 只在游戏与地图之间切换', () => {
    expect(overlayKeyAction('game', 'map')).toEqual({ kind: 'open', mode: 'map' });
    expect(overlayKeyAction('map', 'map')).toEqual({ kind: 'close' });
    expect(overlayKeyAction('pause', 'map')).toEqual({ kind: 'none' });
    expect(overlayKeyAction('help', 'map')).toEqual({ kind: 'none' });
  });

  it('ESC 在子菜单里退回暂停菜单，而不是直接回到游戏', () => {
    expect(overlayKeyAction('settings', 'pause')).toEqual({ kind: 'open', mode: 'pause' });
    expect(overlayKeyAction('map', 'pause')).toEqual({ kind: 'open', mode: 'pause' });
    expect(overlayKeyAction('pause', 'pause')).toEqual({ kind: 'close' });
    expect(overlayKeyAction('game', 'pause')).toEqual({ kind: 'open', mode: 'pause' });
  });

  it('help 只能被 ESC 或 H 关掉', () => {
    expect(overlayKeyAction('help', 'pause')).toEqual({ kind: 'closeHelp' });
    expect(overlayKeyAction('help', 'help')).toEqual({ kind: 'closeHelp' });
    expect(overlayKeyAction('settings', 'help')).toEqual({ kind: 'open', mode: 'help' });
  });

  // HudScene 用同一个 mode 控制常驻 HUD 的可见性：任何一个走不回 game 的模式，
  // 都等于玩家能把常驻 HUD 永久卡没。settings 要按两次 ESC 才出得来，所以这里
  // 查的是可达性而不是「一键退出」。
  it('每个模式都能通过按键序列回到游戏', () => {
    for (const start of MODES) {
      const seen = new Set<OverlayMode>([start]);
      const queue: OverlayMode[] = [start];
      let escaped = start === 'game';
      while (!escaped && queue.length > 0) {
        const mode = queue.shift() as OverlayMode;
        for (const key of KEYS) {
          const action = overlayKeyAction(mode, key);
          // closeHelp 回到打开 help 的那个模式；无论它是 game 还是 pause，都还能继续退出。
          if (action.kind === 'close' || action.kind === 'closeHelp') escaped = true;
          else if (action.kind === 'open' && !seen.has(action.mode)) {
            seen.add(action.mode);
            queue.push(action.mode);
          }
        }
      }
      expect(escaped, `${start} 回不到游戏`).toBe(true);
    }
  });
});
