import Phaser from 'phaser';

import { createGameConfig } from './game/config';
import { ensureUIFonts } from './game/ui/fontLoader';
import './style.css';

let game: Phaser.Game | undefined;

async function startGame(): Promise<void> {
  await ensureUIFonts(document.fonts);
  game = new Phaser.Game(createGameConfig());
  if (import.meta.env.MODE === 'test') {
    const { installTestBridge } = await import('./game/testing/installTestBridge');
    await waitForTitleScene(game);
    installTestBridge(game);
  }
}

async function waitForTitleScene(activeGame: Phaser.Game): Promise<void> {
  await new Promise<void>((resolve) => {
    const check = (): void => {
      if (activeGame.scene.isActive('title')) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

void startGame().catch(() => showRuntimeError('中文界面字体加载失败，请检查资源后重新加载。'));

window.addEventListener('beforeunload', () => game?.destroy(true));

function showRuntimeError(message: string): void {
  const existing = document.querySelector<HTMLElement>('[data-runtime-error]');
  const panel = existing ?? document.createElement('section');
  panel.dataset.runtimeError = 'true';
  panel.className = 'runtime-error';
  // message 直接来自 window.onerror，拼进 innerHTML 等于把运行时字符串当 HTML 执行。
  // 纯本地游戏里利用面很窄，但用 textContent 就没有这回事。
  panel.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = '信标连接中断';
  const detail = document.createElement('span');
  detail.textContent = message;
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = '重新加载';
  reload.addEventListener('click', () => window.location.reload());
  panel.append(title, detail, reload);
  if (!existing) document.body.append(panel);
}

window.addEventListener('error', (event) => showRuntimeError(event.message || '未知运行错误'));
window.addEventListener('unhandledrejection', () => showRuntimeError('资源或系统初始化失败'));
