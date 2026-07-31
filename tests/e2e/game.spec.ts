import { expect, test, type Page } from '@playwright/test';

interface TestSnapshot {
  scene: string;
  roomId: string;
  health: number;
  maxHealth: number;
  abilities: { phaseDash: boolean; magneticGrip: boolean };
  bossDefeated: boolean;
  bossHealth: number | null;
  uiMode: string;
}

interface BrowserTestBridge {
  snapshot(): TestSnapshot;
  startNewGame(): void;
  warp(
    roomId: string,
    patch?: {
      health?: number;
      phaseDash?: boolean;
      magneticGrip?: boolean;
      bossDefeated?: boolean;
      collectedPickups?: string[];
    },
  ): Promise<void>;
  completeBoss(): void;
  showHelp(device: 'keyboardMouse' | 'gamepad'): void;
}

type TestWindow = Window & { __STAR_ECHO_TEST__: BrowserTestBridge };

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  await expect(page.locator('canvas')).toBeVisible();
  return errors;
}

async function snapshot(page: Page): Promise<TestSnapshot> {
  return page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.snapshot());
}

async function waitForGameFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test('starts a new game and opens map, pause, settings and controls', async ({ page }) => {
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  await page.mouse.click(480, 272);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('vestibule_dock');
  await page.keyboard.press('h');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('help-keyboardMouse');
  await page.keyboard.press('h');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('game');
  await waitForGameFrame(page);
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('map');
  await waitForGameFrame(page);
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('game');
  await waitForGameFrame(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('pause');
  await waitForGameFrame(page);

  await page.mouse.click(480, 288);
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('settings');
  await waitForGameFrame(page);
  await page.mouse.click(480, 260);
  const settings = await page.evaluate(() => localStorage.getItem('star-echo.settings.v1'));
  expect(settings).toContain('screenShake');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('pause');
  await waitForGameFrame(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('game');
  expect(errors).toEqual([]);
});

test('restores a valid save and safely replaces a corrupt save', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    localStorage.setItem(
      'star-echo.save.v1',
      JSON.stringify({
        version: 1,
        currentRoomId: 'bioforge_intake',
        checkpointRoomId: 'bioforge_intake',
        checkpointSpawnId: 'from_causeway',
        health: 5,
        maxHealth: 6,
        abilities: { phaseDash: true, magneticGrip: false },
        visitedRooms: ['vestibule_dock', 'bioforge_intake'],
        collectedPickups: ['ability-phase-dash'],
        readLore: [],
        bossDefeated: false,
        elapsedMs: 12_000,
      }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  await page.mouse.click(480, 208);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('bioforge_intake');
  expect((await snapshot(page)).abilities.phaseDash).toBe(true);

  await page.evaluate(() => localStorage.setItem('star-echo.save.v1', '{broken'));
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  await page.mouse.click(480, 272);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('vestibule_dock');
  expect(errors).toEqual([]);
});

test('opens the playable tutorial and safely returns to the title', async ({ page }) => {
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  await page.keyboard.press('t');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('tutorial');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  expect(errors).toEqual([]);
});

test('opens help anywhere and follows the most recent input device', async ({ page }) => {
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  await page.keyboard.press('h');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('help');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('help-keyboardMouse');
  await page.keyboard.press('h');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.showHelp('gamepad'),
  );
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('help-gamepad');
  await page.keyboard.press('j');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('help-keyboardMouse');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  expect(errors).toEqual([]);
});

test('completes the two-ability route, ending and post-game exploration', async ({ page }) => {
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  await page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.startNewGame());
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');

  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.warp('vestibule_vault', {
      phaseDash: true,
      collectedPickups: ['ability-phase-dash'],
    }),
  );
  expect((await snapshot(page)).abilities.phaseDash).toBe(true);
  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.warp('bioforge_cradle', {
      magneticGrip: true,
      collectedPickups: ['ability-magnetic-grip'],
    }),
  );
  expect((await snapshot(page)).abilities.magneticGrip).toBe(true);
  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.warp('core_guardian'),
  );
  await expect.poll(async () => (await snapshot(page)).bossHealth).toBe(30);
  await page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.completeBoss());
  await expect.poll(async () => (await snapshot(page)).scene, { timeout: 4_000 }).toBe('ending');
  expect((await snapshot(page)).bossDefeated).toBe(true);

  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.showHelp('gamepad'),
  );
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('help-gamepad');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('ending');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  expect((await snapshot(page)).roomId).toBe('core_guardian');
  expect((await snapshot(page)).bossHealth).toBeNull();
  expect(errors).toEqual([]);
});
