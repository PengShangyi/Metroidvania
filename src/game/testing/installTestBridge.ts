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
  combat: CombatTestSnapshot;
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
}

type TestWindow = Window & { __STAR_ECHO_TEST__?: StarEchoTestBridge };
type PlaySceneInternals = Phaser.Scene & {
  transitioning: boolean;
  player: Player;
  combat: CombatSystem;
  enemySystem: EnemySystem;
  bossSystem: BossSystem;
  roomRuntime: RoomRuntime;
  loadRoom(roomId: string, spawnId: string): void;
  ensureRegionAssets(biome: BiomeId, onReady: () => void): void;
  finishBoss(): void;
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
    combat: combatSnapshot(game),
  };
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

function showHelp(game: Phaser.Game, device: InputDevice): void {
  setInputDevice(game.registry, game.events, device);
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
