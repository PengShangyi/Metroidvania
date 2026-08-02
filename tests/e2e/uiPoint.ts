import { expect, type Page } from '@playwright/test';

/**
 * 按 UI 逻辑坐标（960×540）点击。
 *
 * 直接写屏幕坐标会同时绑死画布尺寸和视口缩放：套件此前散落着 (480, 272) 这类
 * 「逻辑坐标 ×2」的字面量，画布一改就全部指错位置，而且失败信息完全看不出原因。
 */
export async function clickUi(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('画布不可见，无法换算 UI 坐标');
  const backing = await canvas.evaluate((element: HTMLCanvasElement) => ({
    width: element.width,
    height: element.height,
  }));
  await page.mouse.click(
    box.x + (x / backing.width) * box.width,
    box.y + (y / backing.height) * box.height,
  );
}

/**
 * 点击并等到界面真的切过去为止，必要时重点一次。
 *
 * Phaser 的命中区要等一帧才注册，覆盖层刚打开时的第一次点击可能落空：
 * 单跑从不复现，五个 worker × 三个引擎并行时才偶尔冒出来。
 */
export async function clickUiUntil(
  page: Page,
  x: number,
  y: number,
  expected: string,
  readUiMode: () => Promise<string>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        if ((await readUiMode()) === expected) return expected;
        await clickUi(page, x, y);
        return readUiMode();
      },
      { intervals: [80, 120, 200, 400, 800] },
    )
    .toBe(expected);
}
