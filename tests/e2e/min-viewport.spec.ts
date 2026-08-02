import { expect, test } from '@playwright/test';

import type { TestWindow } from './bridge';

/**
 * 480×270 曾经是原生渲染分辨率，现在只是一个很小的窗口：画布固定 960×540，
 * 由 Scale.FIT 缩下去。这条用例只保证「缩到这么小也还能跑」，
 * 排版可读性由 960×540 下的 typography 断言负责。
 */
test.use({ viewport: { width: 480, height: 270 } });

test('在最小窗口下依然以 960×540 背板启动且无控制台报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const backing = await canvas.evaluate((element: HTMLCanvasElement) => [
    element.width,
    element.height,
  ]);
  expect(backing).toEqual([960, 540]);

  const box = await canvas.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(480);
  expect(box?.height).toBeLessThanOrEqual(270);
  // FIT 必须保住 16:9，否则像素会被拉伸。
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 2);

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('title');
  expect(errors).toEqual([]);
});
