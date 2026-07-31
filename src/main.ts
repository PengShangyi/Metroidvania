import Phaser from 'phaser';

import { createGameConfig } from './game/config';
import './style.css';

const game = new Phaser.Game(createGameConfig());

window.addEventListener('beforeunload', () => game.destroy(true));

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
