import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { PIXEL_FONT_FAMILY, PROSE_FONT_FAMILY } from '../../src/game/ui/text';

interface TypographySnapshot {
  fontReady: boolean;
  textCount: number;
  minimumFontSize: number | null;
  fontFamilies: string[];
  clippedTexts: string[];
  overlappingTextPairs: string[];
  synthesizedStyles: string[];
  scaledTexts: string[];
  zoomedTexts: string[];
}

interface LowResBridge {
  snapshot(): { scene: string; uiMode: string; typography: TypographySnapshot };
  showHelp(device: 'keyboardMouse' | 'gamepad'): void;
}

type LowResWindow = Window & { __STAR_ECHO_TEST__: LowResBridge };

test('keeps the tutorial and adaptive help usable at native resolution', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as LowResWindow).__STAR_ECHO_TEST__));
  await expect(page.locator('canvas')).toBeVisible();
  // 断言背板而不是 boundingBox：后者返回 CSS 尺寸，会跟着 Scale.FIT 变，测不出真实分辨率。
  const backing = await page
    .locator('canvas')
    .evaluate((element: HTMLCanvasElement) => [element.width, element.height]);
  expect(backing).toEqual([960, 540]);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('title');
  await captureTypography(page, testInfo, 'title');
  await expectReadableTypography(page);

  await page.keyboard.press('t');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('tutorial');
  await captureTypography(page, testInfo, 'tutorial');
  await expectReadableTypography(page);

  await page.keyboard.press('h');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().uiMode),
    )
    .toBe('help-keyboardMouse');
  await captureTypography(page, testInfo, 'help-keyboard');
  await expectReadableTypography(page);

  await page.keyboard.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('tutorial');
  await page.keyboard.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('title');
  await page.evaluate(() =>
    (window as unknown as LowResWindow).__STAR_ECHO_TEST__.showHelp('gamepad'),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().uiMode),
    )
    .toBe('help-gamepad');
  await captureTypography(page, testInfo, 'help-gamepad');
  await expectReadableTypography(page);
  await page.keyboard.press('j');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().uiMode),
    )
    .toBe('help-keyboardMouse');
});

async function expectReadableTypography(page: Page): Promise<void> {
  const typography = await page.evaluate(
    () => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().typography,
  );
  expect(typography.fontReady).toBe(true);
  expect(typography.textCount).toBeGreaterThan(0);
  expect(typography.minimumFontSize).toBeGreaterThanOrEqual(12);
  expect(typography.fontFamilies.length).toBeGreaterThan(0);
  // 白名单而不是子串匹配：界面只允许这两条字体栈，别的都是漏网的临时样式。
  expect(
    typography.fontFamilies.filter(
      (family) => family !== PIXEL_FONT_FAMILY && family !== PROSE_FONT_FAMILY,
    ),
  ).toEqual([]);
  expect(typography.clippedTexts).toEqual([]);
  expect(typography.overlappingTextPairs).toEqual([]);
  expect(typography.synthesizedStyles).toEqual([]);
  expect(typography.scaledTexts).toEqual([]);
  // 世界层相机是 zoom 2：文本只要留在那边就会被放大，必须全部住在 UI 场景里。
  expect(typography.zoomedTexts).toEqual([]);
}

async function captureTypography(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  if (testInfo.project.name !== 'chromium') return;
  const directory = join(process.cwd(), 'test-results', 'typography');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${screen}-960x540.png`) });
}
