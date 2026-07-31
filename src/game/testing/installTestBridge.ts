import Phaser from 'phaser';

import { REGISTRY_KEYS } from '../constants';
import { createNewSession, type GameSessionState } from '../state/GameSession';
import { RoomRepository } from '../world/RoomRepository';
import type { BiomeId } from '../world/types';

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
}

export interface StarEchoTestBridge {
  snapshot(): TestSnapshot;
  startNewGame(): void;
  warp(roomId: string, patch?: TestProgressPatch): Promise<void>;
  completeBoss(): void;
}

type TestWindow = Window & { __STAR_ECHO_TEST__?: StarEchoTestBridge };
interface PlaySceneInternals {
  transitioning: boolean;
  loadRoom(roomId: string, spawnId: string): void;
  ensureRegionAssets(biome: BiomeId, onReady: () => void): void;
  finishBoss(): void;
}

export function installTestBridge(game: Phaser.Game): void {
  const testWindow = window as TestWindow;
  testWindow.__STAR_ECHO_TEST__ = {
    snapshot: () => snapshot(game),
    startNewGame: () => startNewGame(game),
    warp: (roomId, patch = {}) => warp(game, roomId, patch),
    completeBoss: () => playInternals(game).finishBoss(),
  };

  game.events.once('destroy', () => {
    delete testWindow.__STAR_ECHO_TEST__;
  });
}

function snapshot(game: Phaser.Game): TestSnapshot {
  const session = game.registry.get(REGISTRY_KEYS.session) as GameSessionState;
  const active = game.scene.getScenes(true).map((scene) => scene.scene.key);
  const scene =
    ['ending', 'play', 'title', 'boot'].find((key) => active.includes(key)) ?? 'unknown';
  return {
    scene,
    roomId: session.currentRoomId,
    health: session.health,
    maxHealth: session.maxHealth,
    abilities: { ...session.abilities },
    bossDefeated: session.bossDefeated,
    bossHealth: (game.registry.get(REGISTRY_KEYS.bossHealth) as number | undefined) ?? null,
    uiMode: (game.registry.get(REGISTRY_KEYS.uiMode) as string | undefined) ?? 'game',
  };
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
  const biome = new RoomRepository().get(roomId).biome;
  await new Promise<void>((resolve) => {
    play.ensureRegionAssets(biome, () => {
      play.transitioning = false;
      play.loadRoom(roomId, '');
      resolve();
    });
  });
}

function playInternals(game: Phaser.Game): PlaySceneInternals {
  return game.scene.getScene('play') as unknown as PlaySceneInternals;
}
