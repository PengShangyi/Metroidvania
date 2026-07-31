import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

interface TypographySnapshot {
  fontReady: boolean;
  textCount: number;
  minimumFontSize: number | null;
  fontFamilies: string[];
  clippedTexts: string[];
  crowdedTextPairs: string[];
  synthesizedStyles: string[];
  scaledTexts: string[];
}

interface LowResBridge {
  snapshot(): { scene: string; uiMode: string; typography: TypographySnapshot };
  showHelp(device: 'keyboardMouse' | 'gamepad'): void;
}

type LowResWindow = Window & { __STAR_ECHO_TEST__: LowResBridge };

test.use({ viewport: { width: 480, height: 270 } });

test('keeps the tutorial and adaptive help usable at native resolution', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as LowResWindow).__STAR_ECHO_TEST__));
  await expect(page.locator('canvas')).toBeVisible();
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas?.width).toBe(480);
  expect(canvas?.height).toBe(270);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('title');
  await expectReadableTypography(page);
  await captureTypography(page, testInfo, 'title');

  await page.keyboard.press('t');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('tutorial');
  await expectReadableTypography(page);
  await captureTypography(page, testInfo, 'tutorial');

  await page.keyboard.press('h');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().uiMode),
    )
    .toBe('help-keyboardMouse');
  await expectReadableTypography(page);
  await captureTypography(page, testInfo, 'help-keyboard');

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
  await expectReadableTypography(page);
  await captureTypography(page, testInfo, 'help-gamepad');
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
  expect(typography.fontFamilies.every((family) => family.includes('Fusion Pixel 12'))).toBe(true);
  expect(typography.clippedTexts).toEqual([]);
  expect(typography.crowdedTextPairs).toEqual([]);
  expect(typography.synthesizedStyles).toEqual([]);
  expect(typography.scaledTexts).toEqual([]);
}

async function captureTypography(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  if (testInfo.project.name !== 'chromium') return;
  const directory = join(process.cwd(), 'test-results', 'typography');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${screen}-480x270.png`) });
}
