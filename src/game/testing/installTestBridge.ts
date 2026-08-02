import Phaser from 'phaser';

import type { BossSystem } from '../boss/BossSystem';
import type { CombatSystem } from '../combat/CombatSystem';
import {
  COMBAT_EVENTS,
  type PiercingHitEvent,
  type ProjectileReflectedEvent,
  type ShieldCoreHitEvent,
  type ShieldOpenedEvent,
} from '../combat/events';
import { configureProjectileMetadata } from '../combat/projectileMetadata';
import { REGISTRY_KEYS } from '../constants';
import type { EnemySprite } from '../enemies/EnemySprite';
import type { EnemySystem } from '../enemies/EnemySystem';
import { setInputDevice, type InputDevice } from '../input/device';
import type { Player } from '../player/Player';
import { activateArcadeImage } from '../render/arcadePool';
import { createNewSession, type GameSessionState } from '../state/GameSession';
import { TUTORIAL_STEPS } from '../tutorial/tutorialPlan';
import { PROSE_FONT_DESCRIPTOR, UI_FONT_DESCRIPTOR, UI_FONT_PROBE } from '../ui/fontLoader';
import { PIXEL_FONT_FAMILY, PIXEL_FONT_GRID } from '../ui/text';
import { RoomRepository } from '../world/RoomRepository';
import type { RoomRuntime } from '../world/RoomRuntime';
import type { BiomeId, EnemySpawn } from '../world/types';

interface TestProgressPatch {
  health?: number;
  phaseDash?: boolean;
  magneticGrip?: boolean;
  bossDefeated?: boolean;
  collectedPickups?: string[];
}

interface TestSnapshot {
  scene: string;
  roomId: string;
  health: number;
  maxHealth: number;
  abilities: { phaseDash: boolean; magneticGrip: boolean };
  bossDefeated: boolean;
  bossHealth: number | null;
  uiMode: string;
  typography: TypographyTestSnapshot;
  combat: CombatTestSnapshot;
}

interface TypographyTestSnapshot {
  fontReady: boolean;
  textCount: number;
  /** 屏幕上所有可见文本，用来断言「某句话确实渲染出来了」。 */
  labels: string[];
  /**
   * 按字体族分开的最小字号：像素字低于 24 就不可读，矢量字 16 仍然清楚，
   * 一个全局下限没法同时表达这两件事。
   */
  minimumFontSizeByFamily: Record<string, number>;
  fontFamilies: string[];
  clippedTexts: string[];
  overlappingTextPairs: string[];
  synthesizedStyles: string[];
  scaledTexts: string[];
  /** 所属相机 zoom ≠ 1 的文本：世界层现在跑在 zoom 2 上，文本一旦留在那边就会被放大。 */
  zoomedTexts: string[];
  /** 用像素字体但字号不是 12 的整数倍：会出现半像素笔画。 */
  offGridPixelFontSizes: string[];
}

interface ActiveText {
  text: Phaser.GameObjects.Text;
  camera: Phaser.Cameras.Scene2D.Camera;
  screen: Phaser.Geom.Rectangle;
}

export type CombatTestScenario = 'shield' | 'turretReflection' | 'bossReflection' | 'piercing';

interface CombatTestSnapshot {
  player: {
    x: number;
    y: number;
    movementState: string;
    wallJumpSerial: number;
    facing: -1 | 1;
  } | null;
  piercingArmed: boolean;
  playerProjectileCount: number;
  hostileProjectileCount: number;
  enemies: Array<{
    id: string;
    type: string;
    variant?: string;
    x: number;
    y: number;
    health: number;
    shieldState: string;
    coreSide: number;
  }>;
  events: CombatEventLog;
}

interface CombatEventLog {
  reflected: ProjectileReflectedEvent[];
  shieldOpened: ShieldOpenedEvent[];
  shieldCoreHits: ShieldCoreHitEvent[];
  piercingHits: PiercingHitEvent[];
}

export interface StarEchoTestBridge {
  snapshot(): TestSnapshot;
  startNewGame(): void;
  warp(roomId: string, patch?: TestProgressPatch): Promise<void>;
  completeBoss(): void;
  showHelp(device: InputDevice): void;
  prepareCombatScenario(scenario: CombatTestScenario): Promise<void>;
  alignPiercingTargets(): void;
  damagePlayer(amount: number): void;
  tutorialPlayerX(): number | null;
  openHudOverlay(mode: HudOverlayMode): void;
  completeTutorial(): void;
  showRuntimeMessage(message: string): void;
}

export type HudOverlayMode = 'map' | 'pause' | 'settings' | 'help';

type TestWindow = Window & { __STAR_ECHO_TEST__?: StarEchoTestBridge };
type PlaySceneInternals = Phaser.Scene & {
  transitioning: boolean;
  respawning: boolean;
  pendingRespawn: boolean;
  player: Player;
  combat: CombatSystem;
  enemySystem: EnemySystem;
  bossSystem: BossSystem;
  roomRuntime: RoomRuntime;
  loadRoom(roomId: string, spawnId: string): void;
  ensureRegionAssets(biome: BiomeId, onReady: () => void): void;
  finishBoss(): void;
};

type TutorialSceneInternals = Phaser.Scene & {
  player: Player;
  stageIndex: number;
  finishTutorial(): void;
};

type HudSceneInternals = Phaser.Scene & {
  openOverlay(mode: HudOverlayMode): void;
  openHelp(): void;
};

interface EnemySystemInternals {
  enemies: Phaser.GameObjects.Group;
  hostileProjectiles: Phaser.Physics.Arcade.Group;
  previousPlayerX: number;
  contactCollider?: Phaser.Physics.Arcade.Collider;
}

interface BossSystemInternals {
  projectiles: Phaser.Physics.Arcade.Group;
}

const combatEvents: CombatEventLog = {
  reflected: [],
  shieldOpened: [],
  shieldCoreHits: [],
  piercingHits: [],
};
let eventScene: Phaser.Scene | undefined;
let testProjectileSerial = 90_000;

const recordReflected = (event: ProjectileReflectedEvent): void => {
  combatEvents.reflected.push({ ...event });
};
const recordShieldOpened = (event: ShieldOpenedEvent): void => {
  combatEvents.shieldOpened.push({ ...event });
};
const recordShieldCoreHit = (event: ShieldCoreHitEvent): void => {
  combatEvents.shieldCoreHits.push({ ...event });
};
const recordPiercingHit = (event: PiercingHitEvent): void => {
  combatEvents.piercingHits.push({ ...event });
};

export function installTestBridge(game: Phaser.Game): void {
  const testWindow = window as TestWindow;
  testWindow.__STAR_ECHO_TEST__ = {
    snapshot: () => snapshot(game),
    startNewGame: () => startNewGame(game),
    warp: (roomId, patch = {}) => warp(game, roomId, patch),
    completeBoss: () => playInternals(game).finishBoss(),
    showHelp: (device) => showHelp(game, device),
    prepareCombatScenario: (scenario) => prepareCombatScenario(game, scenario),
    alignPiercingTargets: () => alignPiercingTargets(game),
    damagePlayer: (amount) => playInternals(game).combat.damagePlayer(amount),
    tutorialPlayerX: () => tutorialPlayerX(game),
    openHudOverlay: (mode) => openHudOverlay(game, mode),
    completeTutorial: () => completeTutorial(game),
    showRuntimeMessage: (message) => showRuntimeMessage(game, message),
  };

  game.events.once('destroy', () => {
    delete testWindow.__STAR_ECHO_TEST__;
  });
}

function snapshot(game: Phaser.Game): TestSnapshot {
  const session = game.registry.get(REGISTRY_KEYS.session) as GameSessionState;
  const active = game.scene.getScenes(true).map((scene) => scene.scene.key);
  const scene =
    ['help', 'ending', 'tutorial', 'play', 'title', 'boot'].find((key) => active.includes(key)) ??
    'unknown';
  return {
    scene,
    roomId: session.currentRoomId,
    health: session.health,
    maxHealth: session.maxHealth,
    abilities: { ...session.abilities },
    bossDefeated: session.bossDefeated,
    bossHealth: (game.registry.get(REGISTRY_KEYS.bossHealth) as number | undefined) ?? null,
    uiMode: (game.registry.get(REGISTRY_KEYS.uiMode) as string | undefined) ?? 'game',
    typography: typographySnapshot(game),
    combat: combatSnapshot(game),
  };
}

function typographySnapshot(game: Phaser.Game): TypographyTestSnapshot {
  const entries = activeTextObjects(game);
  const label = (entry: ActiveText): string => entry.text.text.replaceAll('\n', ' / ').slice(0, 48);
  const fontSize = (entry: ActiveText): number =>
    Number.parseFloat(String(entry.text.style.fontSize));
  const minimumFontSizeByFamily: Record<string, number> = {};
  for (const entry of entries) {
    const family = entry.text.style.fontFamily;
    const size = fontSize(entry);
    if (!Number.isFinite(size)) continue;
    minimumFontSizeByFamily[family] = Math.min(minimumFontSizeByFamily[family] ?? size, size);
  }
  const clippedTexts = entries
    .filter(
      ({ screen }) =>
        screen.left < -0.5 ||
        screen.top < -0.5 ||
        screen.right > game.scale.width + 0.5 ||
        screen.bottom > game.scale.height + 0.5,
    )
    .map(label);
  const overlappingTextPairs: string[] = [];
  for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
    const first = entries[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
      const second = entries[secondIndex]!;
      const horizontalOverlap =
        Math.min(first.screen.right, second.screen.right) -
        Math.max(first.screen.left, second.screen.left);
      if (horizontalOverlap <= 0) continue;
      const verticalOverlap =
        Math.min(first.screen.bottom, second.screen.bottom) -
        Math.max(first.screen.top, second.screen.top);
      if (horizontalOverlap > 0.5 && verticalOverlap > 0.5) {
        overlappingTextPairs.push(`${label(first)} ↔ ${label(second)}`);
      }
    }
  }
  const synthesizedStyles = entries
    .filter((entry) => entry.text.style.fontStyle !== 'normal')
    .map(label);
  const scaledTexts = entries
    .filter(({ text }) => Math.abs(text.scaleX - 1) > 0.001 || Math.abs(text.scaleY - 1) > 0.001)
    .map(label);
  const zoomedTexts = entries
    .filter(({ camera }) => camera.zoomX !== 1 || camera.zoomY !== 1)
    .map(label);
  const offGridPixelFontSizes = entries
    .filter(
      (entry) =>
        entry.text.style.fontFamily === PIXEL_FONT_FAMILY &&
        fontSize(entry) % PIXEL_FONT_GRID !== 0,
    )
    .map((entry) => `${label(entry)} @ ${String(entry.text.style.fontSize)}`);

  return {
    fontReady:
      document.fonts.check(UI_FONT_DESCRIPTOR, UI_FONT_PROBE) &&
      document.fonts.check(PROSE_FONT_DESCRIPTOR, UI_FONT_PROBE),
    textCount: entries.length,
    labels: entries.map(label),
    minimumFontSizeByFamily,
    fontFamilies: [...new Set(entries.map((entry) => entry.text.style.fontFamily))].sort(),
    clippedTexts,
    overlappingTextPairs,
    synthesizedStyles,
    scaledTexts,
    zoomedTexts,
    offGridPixelFontSizes,
  };
}

/**
 * 裁剪与重叠一律在屏幕空间判定：世界层相机 zoom 2、UI 层 zoom 1，
 * 直接比 getBounds() 会把两套坐标系混在一起。
 */
function screenBounds(
  text: Phaser.GameObjects.Text,
  camera: Phaser.Cameras.Scene2D.Camera,
): Phaser.Geom.Rectangle {
  const bounds = text.getBounds();
  const view = camera.worldView;
  return new Phaser.Geom.Rectangle(
    (bounds.x - view.x) * camera.zoomX + camera.x,
    (bounds.y - view.y) * camera.zoomY + camera.y,
    bounds.width * camera.zoomX,
    bounds.height * camera.zoomY,
  );
}

function activeTextObjects(game: Phaser.Game): ActiveText[] {
  const entries: ActiveText[] = [];
  for (const scene of game.scene.getScenes(true)) {
    const camera = scene.cameras.main;
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Text) {
        if (object.active && object.visible && object.alpha > 0 && object.text.length > 0) {
          entries.push({ text: object, camera, screen: screenBounds(object, camera) });
        }
        return;
      }
      if (object instanceof Phaser.GameObjects.Container) {
        // 容器藏起来时里面的文本并不会跟着改自己的 visible，但它确实没画在屏幕上。
        if (!object.visible || object.alpha <= 0) return;
        for (const child of object.list) visit(child);
      }
    };
    for (const object of scene.children.list) visit(object);
  }
  return entries;
}

function combatSnapshot(game: Phaser.Game): CombatTestSnapshot {
  if (!game.scene.isActive('play') && !game.scene.isPaused('play')) {
    return {
      player: null,
      piercingArmed: false,
      playerProjectileCount: 0,
      hostileProjectileCount: 0,
      enemies: [],
      events: cloneCombatEvents(),
    };
  }
  const play = playInternals(game);
  const enemies = enemyInternals(play)
    .enemies.getChildren()
    .filter((child) => child.active)
    .map((child) => {
      const enemy = child as EnemySprite;
      return {
        id: enemy.enemyId,
        type: enemy.enemyType,
        variant: enemy.variant,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        health: enemy.health,
        shieldState: enemy.shieldState,
        coreSide: enemy.shieldCoreSide,
      };
    });
  const hostileGroups = [enemyInternals(play).hostileProjectiles, bossInternals(play).projectiles];
  return {
    player: {
      x: Math.round(play.player.x),
      y: Math.round(play.player.y),
      movementState: play.player.movementState,
      wallJumpSerial: play.player.wallJumpSerial,
      facing: play.player.facingDirection,
    },
    piercingArmed: play.combat.piercingArmed,
    playerProjectileCount: activeProjectileCount(play.combat.projectileGroup),
    hostileProjectileCount: hostileGroups.reduce(
      (count, group) => count + activeProjectileCount(group),
      0,
    ),
    enemies,
    events: cloneCombatEvents(),
  };
}

/** 训练关不走 combatSnapshot（那条只覆盖 play），但它的世界边界需要单独有人盯着。 */
function tutorialPlayerX(game: Phaser.Game): number | null {
  if (!game.scene.isActive('tutorial')) return null;
  const tutorial = game.scene.getScene('tutorial') as unknown as TutorialSceneInternals;
  return Math.round(tutorial.player.x);
}

/** 覆盖层此前只能靠鼠标点开，而按钮坐标一重排就全指错位置。 */
function openHudOverlay(game: Phaser.Game, mode: HudOverlayMode): void {
  const hud = game.scene.getScene('hud') as unknown as HudSceneInternals;
  if (mode === 'help') hud.openHelp();
  else hud.openOverlay(mode);
}

/**
 * 走 RoomRuntime 自己的通道而不是直接写 registry：进房横幅带一个 900ms 的
 * token 计时清除，直接写会被它顺手擦掉——机器一慢就变成随机失败。
 */
function showRuntimeMessage(game: Phaser.Game, message: string): void {
  const runtime = playInternals(game).roomRuntime as unknown as {
    showMessage(message: string, duration: number): void;
  };
  runtime.showMessage(message, 60_000);
}

function completeTutorial(game: Phaser.Game): void {
  const tutorial = game.scene.getScene('tutorial') as unknown as TutorialSceneInternals;
  tutorial.stageIndex = TUTORIAL_STEPS.length - 1;
  tutorial.finishTutorial();
}

function showHelp(game: Phaser.Game, device: InputDevice): void {
  setInputDevice(game.registry, device);
  const returnScene = ['title', 'ending'].find((key) => game.scene.isActive(key)) ?? 'title';
  game.scene.getScene(returnScene).scene.start('help', { returnScene });
}

function startNewGame(game: Phaser.Game): void {
  game.registry.set(REGISTRY_KEYS.session, createNewSession());
  if (game.scene.isActive('play') || game.scene.isPaused('play')) {
    game.scene.resume('play');
    game.scene.getScene('play').scene.restart();
    return;
  }
  const owner = ['title', 'ending'].find((key) => game.scene.isActive(key));
  if (owner) game.scene.getScene(owner).scene.start('play');
  else game.scene.start('play');
}

async function warp(game: Phaser.Game, roomId: string, patch: TestProgressPatch): Promise<void> {
  const session = game.registry.get(REGISTRY_KEYS.session) as GameSessionState;
  if (patch.health !== undefined)
    session.health = Phaser.Math.Clamp(patch.health, 1, session.maxHealth);
  if (patch.phaseDash !== undefined) session.abilities.phaseDash = patch.phaseDash;
  if (patch.magneticGrip !== undefined) session.abilities.magneticGrip = patch.magneticGrip;
  if (patch.bossDefeated !== undefined) session.bossDefeated = patch.bossDefeated;
  for (const pickup of patch.collectedPickups ?? []) session.collectedPickups.add(pickup);
  session.currentRoomId = roomId;
  session.visitedRooms.add(roomId);
  if (game.scene.isPaused('play')) game.scene.resume('play');
  const play = playInternals(game);
  play.combat.clearTransient();
  play.enemySystem.clear();
  const biome = new RoomRepository().get(roomId).biome;
  await new Promise<void>((resolve) => {
    play.ensureRegionAssets(biome, () => {
      play.transitioning = false;
      play.respawning = false;
      play.pendingRespawn = false;
      play.loadRoom(roomId, '');
      resolve();
    });
  });
}

async function prepareCombatScenario(
  game: Phaser.Game,
  scenario: CombatTestScenario,
): Promise<void> {
  const roomId =
    scenario === 'shield'
      ? 'vestibule_causeway'
      : scenario === 'turretReflection'
        ? 'vestibule_depot'
        : scenario === 'bossReflection'
          ? 'core_guardian'
          : 'bioforge_spire';
  await warp(game, roomId, {
    phaseDash: scenario === 'shield',
    magneticGrip: scenario === 'piercing',
  });
  const play = playInternals(game);
  bindCombatEvents(play);
  play.combat.clearTransient();

  if (scenario === 'shield') {
    positionPlayer(play, 386, 238);
    const enemySystem = enemyInternals(play);
    if (enemySystem.contactCollider) enemySystem.contactCollider.active = false;
    const crawler = findEnemy(enemySystem, 'crawler-causeway');
    positionEnemy(crawler, 388, 236);
    crawler.health = 2;
    crawler.shieldState = 'closed';
    crawler.shieldExposedUntil = 0;
    crawler.stunnedUntil = play.time.now + 10_000;
    enemySystem.previousPlayerX = play.player.x;
    return;
  }

  if (scenario === 'turretReflection') {
    positionPlayer(play, 250, 238);
    const enemySystem = enemyInternals(play);
    const turret = findEnemy(enemySystem, 'turret-depot');
    turret.nextActionAt = play.time.now + 10_000;
    spawnHostileProjectile(
      enemySystem.hostileProjectiles,
      play.player.x + 30,
      play.player.y - 18,
      -80,
      0,
      'turret',
      play.time.now,
    );
    return;
  }

  if (scenario === 'bossReflection') {
    positionPlayer(play, 260, 172);
    spawnHostileProjectile(
      bossInternals(play).projectiles,
      play.player.x + 30,
      154,
      -80,
      0,
      'bossVolley',
      play.time.now,
    );
    return;
  }

  positionPlayer(play, 240, 174);
  const body = play.player.body as Phaser.Physics.Arcade.Body;
  body.setVelocity(24, 32);
  const targets: EnemySpawn[] = [
    { id: 'test-piercing-a', type: 'turret', x: 205, y: 169 },
    { id: 'test-piercing-b', type: 'turret', x: 180, y: 169 },
  ];
  play.enemySystem.load(targets, play.roomRuntime.collisionPlatforms);
  for (const target of enemyInternals(play).enemies.getChildren()) {
    (target as EnemySprite).nextActionAt = play.time.now + 10_000;
  }
  enemyInternals(play).previousPlayerX = play.player.x;
}

function alignPiercingTargets(game: Phaser.Game): void {
  const play = playInternals(game);
  const system = enemyInternals(play);
  const direction = play.player.facingDirection;
  const projectileY = play.player.y - 17;
  const first = findEnemy(system, 'test-piercing-a');
  const second = findEnemy(system, 'test-piercing-b');
  positionEnemy(first, play.player.x + direction * 32, projectileY + 12);
  positionEnemy(second, play.player.x + direction * 58, projectileY + 12);
  first.nextActionAt = play.time.now + 10_000;
  second.nextActionAt = play.time.now + 10_000;
}

function bindCombatEvents(play: Phaser.Scene): void {
  if (eventScene) {
    eventScene.events.off(COMBAT_EVENTS.projectileReflected, recordReflected);
    eventScene.events.off(COMBAT_EVENTS.shieldOpened, recordShieldOpened);
    eventScene.events.off(COMBAT_EVENTS.shieldCoreHit, recordShieldCoreHit);
    eventScene.events.off(COMBAT_EVENTS.piercingHit, recordPiercingHit);
  }
  eventScene = play;
  combatEvents.reflected = [];
  combatEvents.shieldOpened = [];
  combatEvents.shieldCoreHits = [];
  combatEvents.piercingHits = [];
  play.events.on(COMBAT_EVENTS.projectileReflected, recordReflected);
  play.events.on(COMBAT_EVENTS.shieldOpened, recordShieldOpened);
  play.events.on(COMBAT_EVENTS.shieldCoreHit, recordShieldCoreHit);
  play.events.on(COMBAT_EVENTS.piercingHit, recordPiercingHit);
}

function positionPlayer(play: PlaySceneInternals, x: number, y: number): void {
  play.player.resetTraversalState();
  play.player.setPosition(x, y).setVelocity(0, 0).setAcceleration(0, 0);
  (play.player.body as Phaser.Physics.Arcade.Body).reset(x, y);
}

function positionEnemy(enemy: EnemySprite, x: number, y: number): void {
  enemy.setPosition(x, y).setVelocity(0, 0).setAcceleration(0, 0);
  (enemy.body as Phaser.Physics.Arcade.Body).reset(x, y);
}

function spawnHostileProjectile(
  group: Phaser.Physics.Arcade.Group,
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  kind: 'turret' | 'bossVolley',
  now: number,
): void {
  const projectile = group.get(x, y, 'projectile') as Phaser.Physics.Arcade.Image | null;
  if (!projectile) throw new Error('测试弹体池已满');
  activateArcadeImage(projectile, 'projectile', x, y)
    .setTint(0xff5678)
    .setVelocity(velocityX, velocityY);
  testProjectileSerial += 1;
  configureProjectileMetadata(projectile, {
    faction: 'hostile',
    kind,
    damage: 1,
    reflectable: true,
    serial: testProjectileSerial,
    expiresAt: now + 2_600,
  });
}

function findEnemy(system: EnemySystemInternals, id: string): EnemySprite {
  const enemy = system.enemies
    .getChildren()
    .find((child) => (child as EnemySprite).enemyId === id) as EnemySprite | undefined;
  if (!enemy) throw new Error(`测试敌人不存在：${id}`);
  return enemy;
}

function activeProjectileCount(group: Phaser.Physics.Arcade.Group): number {
  return group.getChildren().filter((child) => child.active).length;
}

function cloneCombatEvents(): CombatEventLog {
  return {
    reflected: combatEvents.reflected.map((event) => ({ ...event })),
    shieldOpened: combatEvents.shieldOpened.map((event) => ({ ...event })),
    shieldCoreHits: combatEvents.shieldCoreHits.map((event) => ({ ...event })),
    piercingHits: combatEvents.piercingHits.map((event) => ({ ...event })),
  };
}

function enemyInternals(play: PlaySceneInternals): EnemySystemInternals {
  return play.enemySystem as unknown as EnemySystemInternals;
}

function bossInternals(play: PlaySceneInternals): BossSystemInternals {
  return play.bossSystem as unknown as BossSystemInternals;
}

function playInternals(game: Phaser.Game): PlaySceneInternals {
  return game.scene.getScene('play') as unknown as PlaySceneInternals;
}
