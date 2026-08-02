import { expect, test, type Page } from '@playwright/test';

import type { CombatTestScenario, TestSnapshot, TestWindow } from './bridge';

test.describe.configure({ mode: 'serial' });

async function openCombatGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as TestWindow).__STAR_ECHO_TEST__));
  await page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.startNewGame());
  await expect.poll(async () => (await combatSnapshot(page)).scene).toBe('play');
  return errors;
}

async function combatSnapshot(page: Page): Promise<TestSnapshot> {
  return page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.snapshot());
}

async function prepareScenario(page: Page, scenario: CombatTestScenario): Promise<void> {
  await page.evaluate(
    (value) => (window as unknown as TestWindow).__STAR_ECHO_TEST__.prepareCombatScenario(value),
    scenario,
  );
  await expect.poll(async () => (await combatSnapshot(page)).combat.player !== null).toBe(true);
}

async function performWallJump(page: Page): Promise<number> {
  const initialSerial = (await combatSnapshot(page)).combat.player?.wallJumpSerial ?? 0;
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.player?.movementState, {
      intervals: [20, 20, 40, 80],
    })
    .toBe('wallSlide');
  await page.keyboard.down('Space');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.player?.wallJumpSerial ?? 0)
    .toBeGreaterThan(initialSerial);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  return initialSerial;
}

test('dashes through a shield crawler and destroys its exposed rear core', async ({ page }) => {
  const errors = await openCombatGame(page);
  await prepareScenario(page, 'shield');

  await page.keyboard.down('Shift');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.events.shieldOpened.length)
    .toBe(1);
  await page.keyboard.up('Shift');

  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await combatSnapshot(page)).combat.player?.facing).toBe(-1);
  await page.keyboard.up('ArrowLeft');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.player?.movementState)
    .not.toMatch(/jump|fall|dash/);
  await page.keyboard.down('k');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.events.shieldCoreHits.length)
    .toBe(1);
  await page.keyboard.up('k');
  const coreHit = (await combatSnapshot(page)).combat.events.shieldCoreHits[0];
  expect(coreHit).toMatchObject({ enemyId: 'crawler-causeway', damage: 2, remainingHealth: 0 });
  expect(errors).toEqual([]);
});

test('reflects turret and boss-volley projectiles with real blade input', async ({ page }) => {
  const errors = await openCombatGame(page);
  await prepareScenario(page, 'turretReflection');
  await page.keyboard.down('k');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.events.reflected[0]?.kind)
    .toBe('turret');
  await page.keyboard.up('k');

  await page.waitForTimeout(420);
  await prepareScenario(page, 'bossReflection');
  expect((await combatSnapshot(page)).bossHealth).toBe(30);
  await page.keyboard.down('k');
  await expect
    .poll(async () => (await combatSnapshot(page)).combat.events.reflected[0]?.kind)
    .toBe('bossVolley');
  await page.keyboard.up('k');
  await expect.poll(async () => (await combatSnapshot(page)).bossHealth).toBe(28);
  expect(errors).toEqual([]);
});

test('wall-jump first shot pierces two formal enemy targets', async ({ page }) => {
  const errors = await openCombatGame(page);
  await prepareScenario(page, 'piercing');
  await performWallJump(page);
  await expect.poll(async () => (await combatSnapshot(page)).combat.piercingArmed).toBe(true);
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await combatSnapshot(page)).combat.player?.facing).toBe(-1);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await combatSnapshot(page)).combat.piercingArmed).toBe(true);
  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.alignPiercingTargets(),
  );
  await page.keyboard.down('j');

  await expect
    .poll(
      async () =>
        new Set((await combatSnapshot(page)).combat.events.piercingHits.map((hit) => hit.targetId))
          .size,
    )
    .toBe(2);
  await page.keyboard.up('j');
  const hits = (await combatSnapshot(page)).combat.events.piercingHits;
  expect(new Set(hits.map((hit) => hit.serial)).size).toBe(1);
  expect(new Set(hits.map((hit) => hit.targetId))).toEqual(
    new Set(['test-piercing-a', 'test-piercing-b']),
  );
  expect(errors).toEqual([]);
});

test('room changes and death clear the wall-jump charge and transient shots', async ({ page }) => {
  const errors = await openCombatGame(page);
  await prepareScenario(page, 'piercing');
  await performWallJump(page);
  await expect.poll(async () => (await combatSnapshot(page)).combat.piercingArmed).toBe(true);

  await page.evaluate(() =>
    (window as unknown as TestWindow).__STAR_ECHO_TEST__.warp('vestibule_dock'),
  );
  await expect.poll(async () => (await combatSnapshot(page)).combat.piercingArmed).toBe(false);
  expect((await combatSnapshot(page)).combat.playerProjectileCount).toBe(0);

  await prepareScenario(page, 'piercing');
  await performWallJump(page);
  await expect.poll(async () => (await combatSnapshot(page)).combat.piercingArmed).toBe(true);
  await page.evaluate(() => (window as unknown as TestWindow).__STAR_ECHO_TEST__.damagePlayer(99));
  await expect.poll(async () => (await combatSnapshot(page)).combat.piercingArmed).toBe(false);
  expect((await combatSnapshot(page)).combat.playerProjectileCount).toBe(0);
  expect(errors).toEqual([]);
});
