import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  MIN_PIXEL_FONT_SIZE,
  MIN_PROSE_FONT_SIZE,
  PIXEL_FONT_FAMILY,
  PROSE_FONT_FAMILY,
} from '../../src/game/ui/text';
import type { TestWindow, TypographyTestSnapshot } from './bridge';

/** rooms.json 里最长的一条 lore（29 字），代表实际会出现在提示条里的内容。 */
const LONGEST_SHIPPED_LORE = '记录 02：菌晶不是入侵者。核心把它们塑造成了自己的神经。';
/**
 * 比任何已上线文案都长的压力串：中文没有空格，Phaser 默认的按空格换行对它
 * 完全无效，会直接冲出画布两侧——wrapProse 的 advancedWordWrap 才切得开。
 */
const OVERLONG_MESSAGE =
  '回声循环不是故障，是设计。零点核心把整艘船的意识折叠进同一段信号，' +
  '再一遍遍播放给自己听，它以为那样就不算真的死去。';

test('标题、教学、帮助两态的排版可读', async ({ page }, testInfo) => {
  await openGame(page);
  await expectScene(page, 'title');
  await capture(page, testInfo, 'title');
  await expectReadableTypography(page);

  await page.keyboard.press('t');
  await expectScene(page, 'tutorial');
  // 「训练 1/9」曾经因为 diff 基准取错而整行没画出来，且没有任何断言发现。
  await expectLabel(page, '训练 1/9');
  await capture(page, testInfo, 'tutorial');
  await expectReadableTypography(page);

  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.completeTutorial(),
  );
  await expectLabel(page, '训练完成');
  await capture(page, testInfo, 'tutorial-complete');
  await expectReadableTypography(page);

  await page.keyboard.press('Escape');
  await expectScene(page, 'title');
  await page.keyboard.press('h');
  await expectUiMode(page, 'help-keyboardMouse');
  await capture(page, testInfo, 'help-keyboard');
  await expectReadableTypography(page);

  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.showHelp('gamepad'),
  );
  await expectUiMode(page, 'help-gamepad');
  await capture(page, testInfo, 'help-gamepad');
  await expectReadableTypography(page);
});

test('游戏内 HUD、四个覆盖层与结局的排版可读', async ({ page }, testInfo) => {
  await openGame(page);
  await expectScene(page, 'title');
  await page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.startNewGame());
  await expectScene(page, 'play');
  await capture(page, testInfo, 'hud-game');
  await expectReadableTypography(page);

  for (const [name, message] of [
    ['hud-toast', LONGEST_SHIPPED_LORE],
    ['hud-toast-overlong', OVERLONG_MESSAGE],
  ] as const) {
    await page.evaluate(
      (text) => (window as unknown as TestWindow).__STAR_ECHO_TEST__.showRuntimeMessage(text),
      message,
    );
    await expectLabel(page, message.slice(0, 6));
    await capture(page, testInfo, name);
    await expectReadableTypography(page);
  }
  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.showRuntimeMessage(''),
  );

  // Boss 血条是 15 格菱形，宽度最大的一条 HUD 文本。
  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.warp('core_guardian'),
  );
  await expectLabel(page, '守核者');
  await capture(page, testInfo, 'hud-boss');
  await expectReadableTypography(page);

  for (const mode of ['map', 'pause', 'settings', 'help'] as const) {
    await page.evaluate(
      (target) => (window as unknown as TestWindow).__STAR_ECHO_TEST__.openHudOverlay(target),
      mode,
    );
    await expectUiMode(page, mode === 'help' ? 'help-keyboardMouse' : mode);
    await capture(page, testInfo, `overlay-${mode}`);
    await expectReadableTypography(page);
    await closeOverlays(page);
  }

  await page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.completeBoss());
  await expect.poll(() => snapshotValue(page, 'scene'), { timeout: 6_000 }).toBe('ending');
  await capture(page, testInfo, 'ending');
  await expectReadableTypography(page);
});

async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  await expect(page.locator('canvas')).toBeVisible();
  // 断言背板而不是 boundingBox：后者返回 CSS 尺寸，会跟着 Scale.FIT 变，测不出真实分辨率。
  const backing = await page
    .locator('canvas')
    .evaluate((element: HTMLCanvasElement) => [element.width, element.height]);
  expect(backing).toEqual([960, 540]);
}

async function snapshotValue(page: Page, key: 'scene' | 'uiMode'): Promise<string> {
  return page.evaluate(
    (field) =>
      (window as unknown as TestWindow).__STAR_ECHO_TEST__.snapshot()[field as 'scene' | 'uiMode'],
    key,
  );
}

async function expectScene(page: Page, scene: string): Promise<void> {
  await expect.poll(() => snapshotValue(page, 'scene')).toBe(scene);
}

async function expectUiMode(page: Page, uiMode: string): Promise<void> {
  await expect.poll(() => snapshotValue(page, 'uiMode')).toBe(uiMode);
}

/**
 * ESC 在覆盖层之间是有层级的（地图/设置会退回暂停菜单），一次按键不一定回到游戏。
 * 必须真的退干净：play 只要还是 paused，finishBoss 的 delayedCall 就永远不会触发。
 */
async function closeOverlays(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await snapshotValue(page, 'uiMode')) === 'game') return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  await expectUiMode(page, 'game');
}

async function expectLabel(page: Page, fragment: string): Promise<void> {
  await expect
    .poll(async () => (await typography(page)).labels.some((label) => label.includes(fragment)))
    .toBe(true);
}

async function typography(page: Page): Promise<TypographyTestSnapshot> {
  return page.evaluate(
    () => (window as unknown as TestWindow).__STAR_ECHO_TEST__.snapshot().typography,
  );
}

async function expectReadableTypography(page: Page): Promise<void> {
  const snapshot = await typography(page);
  expect(snapshot.fontReady).toBe(true);
  expect(snapshot.textCount).toBeGreaterThan(0);
  // 白名单而不是子串匹配：界面只允许这两条字体栈，别的都是漏网的临时样式。
  expect(
    snapshot.fontFamilies.filter(
      (family) => family !== PIXEL_FONT_FAMILY && family !== PROSE_FONT_FAMILY,
    ),
  ).toEqual([]);
  expect(
    snapshot.minimumFontSizeByFamily[PIXEL_FONT_FAMILY] ?? MIN_PIXEL_FONT_SIZE,
  ).toBeGreaterThanOrEqual(MIN_PIXEL_FONT_SIZE);
  expect(
    snapshot.minimumFontSizeByFamily[PROSE_FONT_FAMILY] ?? MIN_PROSE_FONT_SIZE,
  ).toBeGreaterThanOrEqual(MIN_PROSE_FONT_SIZE);
  expect(snapshot.clippedTexts).toEqual([]);
  expect(snapshot.overlappingTextPairs).toEqual([]);
  expect(snapshot.synthesizedStyles).toEqual([]);
  expect(snapshot.scaledTexts).toEqual([]);
  // 世界层相机是 zoom 2：文本只要留在那边就会被放大，必须全部住在 UI 场景里。
  expect(snapshot.zoomedTexts).toEqual([]);
  expect(snapshot.offGridPixelFontSizes).toEqual([]);
}

async function capture(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  if (testInfo.project.name !== 'chromium') return;
  const directory = join(process.cwd(), 'test-results', 'typography');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${screen}-960x540.png`) });
}
