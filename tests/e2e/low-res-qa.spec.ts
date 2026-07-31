import { expect, test } from '@playwright/test';

interface LowResBridge {
  snapshot(): { scene: string; uiMode: string };
  showHelp(device: 'keyboardMouse' | 'gamepad'): void;
}

type LowResWindow = Window & { __STAR_ECHO_TEST__: LowResBridge };

test.use({ viewport: { width: 480, height: 270 } });

test('keeps the tutorial and adaptive help usable at native resolution', async ({ page }) => {
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

  await page.keyboard.press('t');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().scene),
    )
    .toBe('tutorial');

  await page.keyboard.press('h');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().uiMode),
    )
    .toBe('help-keyboardMouse');

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
  await page.keyboard.press('j');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as LowResWindow).__STAR_ECHO_TEST__.snapshot().uiMode),
    )
    .toBe('help-keyboardMouse');
});
