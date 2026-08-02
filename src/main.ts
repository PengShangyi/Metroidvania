import Phaser from 'phaser';

import { createGameConfig } from './game/config';
import { ensureUIFonts } from './game/ui/fontLoader';
import './style.css';

let game: Phaser.Game | undefined;
let booted = false;

async function startGame(): Promise<void> {
  await ensureUIFonts(document.fonts);
  game = new Phaser.Game(createGameConfig());
  booted = true;
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

/**
 * 这块面板写的是「资源或系统初始化失败」，它也只该管初始化。游戏跑起来之后仍会有
 * 够不到的 Promise 拒绝——最典型的是全屏：Phaser 的 ScaleManager 调用
 * requestFullscreen() 后直接丢掉返回的 Promise，浏览器一拒绝（转场未落定时连按两次
 * F、或页面根本不被允许全屏）就成了未捕获拒绝。游戏本身毫发无损，却被盖上一个
 * 「信标连接中断」的红框。启动完成之后改记到控制台，e2e 的控制台断言照样拦得住真问题。
 */
window.addEventListener('unhandledrejection', (event) => {
  if (booted) {
    console.error('未处理的 Promise 拒绝：', event.reason);
    return;
  }
  showRuntimeError('资源或系统初始化失败');
});
