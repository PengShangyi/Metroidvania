import { expect, test, type Page } from '@playwright/test';

import { clickUi, clickUiUntil } from './uiPoint';

interface TestSnapshot {
  scene: string;
  roomId: string;
  health: number;
  maxHealth: number;
  abilities: { phaseDash: boolean; magneticGrip: boolean };
  bossDefeated: boolean;
  bossHealth: number | null;
  uiMode: string;
  combat: { player: { x: number; movementState: string } | null };
  typography: { labels: string[] };
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
  tutorialPlayerX(): number | null;
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

/**
 * 一直向右跑到位置不再变化为止，而不是按固定时长赌一个距离：
 * 训练关中途会切课并把玩家挪回起点，固定 5 秒有时只跑到 436。
 */
async function runRightUntilStopped(page: Page): Promise<number> {
  const readX = async (): Promise<number> =>
    (await page.evaluate(() =>
      (window as unknown as TestWindow).__STAR_ECHO_TEST__.tutorialPlayerX(),
    )) ?? 0;
  await page.keyboard.down('ArrowRight');
  let previous = -1;
  let current = await readX();
  for (let sample = 0; sample < 30 && current !== previous; sample += 1) {
    await page.waitForTimeout(400);
    previous = current;
    current = await readX();
  }
  await page.keyboard.up('ArrowRight');
  return current;
}

/**
 * 常驻 HUD 真的画出来了才算数。labels 只收录 visible 且非空串的文本，所以这一条同时
 * 拦住两种失效：整层被 setVisible(false) 藏掉，以及 diff 缓存残留导致 setText 从未调用。
 */
async function expectHudVisible(page: Page): Promise<void> {
  await expectLabel(page, '探索');
  // 血量要单独认一次。探索行本身就是「探索 n/17 · x%」，同时含「探索」和「/」，
  // 拿 '/' 当第二个片段的话血量行整个不渲染也照样绿——它才是唯一一条纯数字加斜杠的
  // 常驻文本。
  await expect
    .poll(async () =>
      (await snapshot(page)).typography.labels.some((label) => /^\d+\/\d+$/.test(label.trim())),
    )
    .toBe(true);
}

/** labels 只收录 visible 且非空串的文本，所以这一条能区分「画出来了」和「场景在但空白」。 */
async function expectLabel(page: Page, fragment: string): Promise<void> {
  await expect
    .poll(async () =>
      (await snapshot(page)).typography.labels.some((label) => label.includes(fragment)),
    )
    .toBe(true);
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

  await clickUi(page, 480, 252);
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

  await clickUiUntil(page, 480, 310, 'settings', async () => (await snapshot(page)).uiMode);
  await waitForGameFrame(page);
  await clickUi(page, 480, 238);
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('star-echo.settings.v1')))
    .not.toBeNull();
  const settings = await page.evaluate(() => localStorage.getItem('star-echo.settings.v1'));
  expect(settings).toContain('screenShake');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('pause');
  await waitForGameFrame(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('game');
  expect(errors).toEqual([]);
});

test('keeps the HUD visible after returning to the title and starting again', async ({ page }) => {
  // Phaser 复用 HudScene 实例：mode 与 rendered* 不在 create() 里复位的话，第二次进游戏
  // 常驻 HUD 会整层隐身，要先开一次覆盖层才回来。registry 的 uiMode 全程正确，
  // 所以既有的 uiMode 断言一条都发现不了。
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  await clickUi(page, 480, 252);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expectHudVisible(page);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('pause');
  await waitForGameFrame(page);
  await clickUiUntil(page, 480, 470, 'title', async () => (await snapshot(page)).scene);

  await clickUi(page, 480, 252);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expect.poll(async () => (await snapshot(page)).uiMode).toBe('game');
  await expectHudVisible(page);
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
  await clickUi(page, 480, 184);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('bioforge_intake');
  expect((await snapshot(page)).abilities.phaseDash).toBe(true);

  await page.evaluate(() => localStorage.setItem('star-echo.save.v1', '{broken'));
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  await clickUi(page, 480, 252);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('play');
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('vestibule_dock');
  expect(errors).toEqual([]);
});

test('opens the playable tutorial and safely returns to the title', async ({ page }) => {
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  await page.keyboard.press('t');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('tutorial');

  // 训练关此前不设物理边界，靠 config 的默认值兜底。画布升到 960×540 之后
  // 默认值也跟着变，玩家会一路走出房间——而且不会有任何一处报错。
  await page.locator('canvas').click({ position: { x: 60, y: 60 } });
  const tutorialX = await runRightUntilStopped(page);
  // 有边界时停在右墙（x≈473）；没有边界时会一路跑到画布边缘才停下。
  expect(tutorialX).toBeGreaterThan(400);
  expect(tutorialX).toBeLessThanOrEqual(480);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');

  // 场景实例会被复用，重进不能留下上一次的残留进度。
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
  // 通关后 finishBoss 把血补满，所以血量字符串与上一局的 diff 缓存相同：
  // 缓存不复位的话数值行永远是空的，而这条路径上 mode 还是 game，覆盖层救不回来。
  await expectHudVisible(page);

  // finishBoss() 把 transitioning 置为 true，而 Phaser 会复用同一个 Scene 实例：
  // 不在 create() 里复位的话，通关后回到游戏的角色完全无法操作。
  const restedX = (await snapshot(page)).combat.player?.x ?? 0;
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await snapshot(page)).combat.player?.x ?? restedX, { timeout: 4_000 })
    .toBeGreaterThan(restedX);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test('walks through a corridor without pressing interact and does not bounce back', async ({
  page,
}) => {
  const errors = await openGame(page);
  await expect.poll(async () => (await snapshot(page)).scene).toBe('title');
  await clickUi(page, 480, 252);
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('vestibule_dock');
  // 合成点击不会把键盘焦点交给画布，长按方向键读不到 Key.isDown。
  await page.locator('canvas').click({ position: { x: 60, y: 60 } });

  // 走进通道就换房：整个套件此前都用 warp 瞬移，没有一条真正用键盘穿过一扇门。
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await snapshot(page)).roomId, { timeout: 10_000 })
    .toBe('vestibule_gallery');
  await page.keyboard.up('ArrowRight');

  // 落点就在返回出口的判定区附近，未武装的出口不能把玩家原路弹回去。
  await waitForGameFrame(page);
  await expect.poll(async () => (await snapshot(page)).roomId).toBe('vestibule_gallery');
  expect(errors).toEqual([]);
});
