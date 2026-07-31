import Phaser from 'phaser';

import { createGameConfig } from './game/config';
import { ensureUIFont } from './game/ui/fontLoader';
import './style.css';

let game: Phaser.Game | undefined;

async function startGame(): Promise<void> {
  await ensureUIFont(document.fonts);
  game = new Phaser.Game(createGameConfig());
  if (import.meta.env.MODE === 'test') {
    const { installTestBridge } = await import('./game/testing/installTestBridge');
    installTestBridge(game);
  }
}

void startGame().catch(() => showRuntimeError('中文界面字体加载失败，请检查资源后重新加载。'));

window.addEventListener('beforeunload', () => game?.destroy(true));

function showRuntimeError(message: string): void {
  const existing = document.querySelector<HTMLElement>('[data-runtime-error]');
  const panel = existing ?? document.createElement('section');
  panel.dataset.runtimeError = 'true';
  panel.className = 'runtime-error';
  panel.innerHTML = `<strong>信标连接中断</strong><span>${message}</span><button type="button">重新加载</button>`;
  panel.querySelector('button')?.addEventListener('click', () => window.location.reload());
  if (!existing) document.body.append(panel);
}

window.addEventListener('error', (event) => showRuntimeError(event.message || '未知运行错误'));
window.addEventListener('unhandledrejection', () => showRuntimeError('资源或系统初始化失败'));
