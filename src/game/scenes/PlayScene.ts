import Phaser from 'phaser';

import type { ProceduralAudio } from '../audio/ProceduralAudio';
import { AUDIO_EVENT, type AudioCue } from '../audio/soundDesign';
import { BossSystem } from '../boss/BossSystem';
import { CombatSystem } from '../combat/CombatSystem';
import { COLORS, REGISTRY_KEYS } from '../constants';
import { EnemySystem } from '../enemies/EnemySystem';
import { InputController } from '../input/InputController';
import { Player } from '../player/Player';
import {
  createRegionAnimations,
  queueRegionAssets,
  regionAssetsReady,
} from '../render/regionAssets';
import { createBrowserSaveService, type SaveService } from '../save/SaveService';
import type { GameSessionState } from '../state/GameSession';
import { respawnDecision } from '../state/respawnQueue';
import { sessionEntryPoint } from '../state/resumePoint';
import { RoomRepository } from '../world/RoomRepository';
import { RoomRuntime } from '../world/RoomRuntime';
import {
  CONTEXT_HINT_DELAY_MS,
  CONTEXT_HINT_DURATION_MS,
  ContextualCombatHintTracker,
  contextualCombatHint,
} from '../world/contextualCombatHints';
import type { BiomeId, ExitDefinition } from '../world/types';

export class PlayScene extends Phaser.Scene {
  private session!: GameSessionState;
  private controls!: InputController;
  private player!: Player;
  private rooms!: RoomRepository;
  private roomRuntime!: RoomRuntime;
  private combat!: CombatSystem;
  private enemySystem!: EnemySystem;
  private bossSystem!: BossSystem;
  private saveService!: SaveService;
  private audio!: ProceduralAudio;
  private transitioning = false;
  private respawning = false;
  private pendingRespawn = false;
  private contextHintToken = 0;
  private hintSession?: GameSessionState;
  private contextHints = new ContextualCombatHintTracker();

  public constructor() {
    super('play');
  }

  public preload(): void {
    const session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    const rooms = new RoomRepository();
    const room = rooms.get(session.currentRoomId);
    queueRegionAssets(this, room.biome);
  }

  public create(): void {
    // Phaser 复用同一个 Scene 实例，字段初始值不会随 scene.start 重置。
    // finishBoss() 之后 transitioning 会一直是 true，结局界面回到游戏将无法操作。
    this.transitioning = false;
    this.respawning = false;
    this.pendingRespawn = false;
    this.session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    if (this.hintSession !== this.session) {
      this.hintSession = this.session;
      this.contextHints = new ContextualCombatHintTracker();
    }
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.scene.launch('hud');

    this.controls = new InputController(this);
    this.saveService = createBrowserSaveService();
    this.audio = this.registry.get(REGISTRY_KEYS.audio) as ProceduralAudio;
    this.audio.setVolume(this.session.settings.masterVolume);
    this.audio.setPaused(false);
    this.events.on(AUDIO_EVENT, (cue: AudioCue) => this.audio.play(cue));
    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      this.audio.setPaused(true);
      this.combat?.clearHitStop();
    });
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.audio.setPaused(false));
    this.rooms = new RoomRepository();
    createRegionAnimations(this, this.rooms.get(this.session.currentRoomId).biome);
    this.player = new Player(this, 0, 0);
    this.roomRuntime = new RoomRuntime(this, this.rooms, this.session, () =>
      this.saveService.write(this.session),
    );
    this.combat = new CombatSystem(this, this.player, this.session, () => this.respawn());
    this.enemySystem = new EnemySystem(this, this.player, this.combat);
    this.bossSystem = new BossSystem(this, this.player, this.combat, this.session, () =>
      this.finishBoss(),
    );
    const entry = sessionEntryPoint(this.session);
    this.loadRoom(entry.roomId, entry.spawnId);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.roomRuntime.destroy();
      this.combat.destroy();
      this.enemySystem.destroy();
      this.bossSystem.destroy();
      this.audio.stopAmbience();
      this.scene.stop('hud');
    });
  }

  public update(_time: number, delta: number): void {
    const input = this.controls.update();
    if (!this.transitioning) {
      this.player.updateMovement(delta, input, this.session.abilities);
      this.roomRuntime.update(this.player, input, (exit) => this.transition(exit));
      const attack = this.combat.update(input);
      this.enemySystem.update(delta, attack);
      this.bossSystem.update(attack);
      if (this.roomRuntime.isTouchingHazard(this.player)) {
        if (this.combat.damagePlayer(1)) this.roomRuntime.returnPlayerToSafety(this.player);
      }
    }
    this.session.elapsedMs += delta;
  }

  public clearInput(): void {
    this.controls.clear();
  }

  public returnToTitle(): void {
    this.scene.start('title');
  }

  public applyAudioSettings(): void {
    this.audio.setVolume(this.session.settings.masterVolume);
  }

  private loadRoom(roomId: string, spawnId: string): void {
    this.session.currentRoomId = roomId;
    this.session.visitedRooms.add(roomId);
    this.roomRuntime.load(roomId, spawnId, this.player);
    this.combat.bindWorld(this.roomRuntime.collisionPlatforms);
    this.enemySystem.load(this.roomRuntime.definition.enemies, this.roomRuntime.collisionPlatforms);
    this.bossSystem.load(roomId);
    this.audio.setBiome(this.roomRuntime.definition.biome);
    this.cameras.main.setBounds(0, 0, 480, 270);
    this.physics.world.setBounds(0, 0, 480, 270);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.scheduleContextHint(roomId);
  }

  private scheduleContextHint(roomId: string): void {
    const token = ++this.contextHintToken;
    const hint = contextualCombatHint(roomId);
    if (!hint || this.contextHints.hasShown(hint)) return;
    this.time.delayedCall(CONTEXT_HINT_DELAY_MS, () => {
      if (token !== this.contextHintToken || this.session.currentRoomId !== roomId) return;
      this.contextHints.markShown(hint);
      this.registry.set(REGISTRY_KEYS.runtimeMessage, hint.message);
      this.time.delayedCall(CONTEXT_HINT_DURATION_MS, () => {
        if (
          token === this.contextHintToken &&
          this.registry.get(REGISTRY_KEYS.runtimeMessage) === hint.message
        ) {
          this.registry.set(REGISTRY_KEYS.runtimeMessage, '');
        }
      });
    });
  }

  private transition(exit: ExitDefinition): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.combat.clearTransient();
    this.enemySystem.clear();
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.cameras.main.fadeOut(140, 7, 11, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const targetBiome = this.rooms.get(exit.targetRoomId).biome;
      this.ensureRegionAssets(targetBiome, () => {
        this.loadRoom(exit.targetRoomId, exit.targetSpawnId);
        // 存档此前只在拾取、同步终端和击败 Boss 时写入，两次写入之间探索过的房间
        // 会从 visitedRooms 里丢掉，地图进度凭空退回。复活点仍由 resumeSession
        // 拉回 checkpointRoomId，所以这里写 currentRoomId 不会改变续关落点。
        this.saveService.write(this.session);
        (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
        this.cameras.main.fadeIn(140, 7, 11, 24);
        this.time.delayedCall(140, () => {
          this.transitioning = false;
          this.flushPendingRespawn();
        });
      });
    });
  }

  private flushPendingRespawn(): void {
    if (!this.pendingRespawn) return;
    this.pendingRespawn = false;
    this.respawn();
  }

  private respawn(): void {
    const decision = respawnDecision(this.respawning, this.transitioning);
    if (decision === 'ignore') return;
    if (decision === 'queue') {
      this.pendingRespawn = true;
      return;
    }
    this.respawning = true;
    this.transitioning = true;
    this.combat.clearTransient();
    this.enemySystem.clear();
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.cameras.main.fadeOut(220, 255, 86, 120);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const targetBiome = this.rooms.get(this.session.checkpointRoomId).biome;
      this.ensureRegionAssets(targetBiome, () => {
        this.session.health = this.session.maxHealth;
        this.loadRoom(this.session.checkpointRoomId, this.session.checkpointSpawnId);
        (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
        this.cameras.main.fadeIn(240, 7, 11, 24);
        this.registry.set(REGISTRY_KEYS.runtimeMessage, '外骨骼已由终端重构');
        this.time.delayedCall(280, () => {
          this.transitioning = false;
          this.respawning = false;
          this.pendingRespawn = false;
        });
      });
    });
  }

  private ensureRegionAssets(biome: BiomeId, onReady: () => void): void {
    if (regionAssetsReady(this, biome)) {
      createRegionAnimations(this, biome);
      onReady();
      return;
    }

    queueRegionAssets(this, biome);
    let failed = false;
    const onLoadError = (): void => {
      failed = true;
    };
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      createRegionAnimations(this, biome);
      if (failed) {
        this.registry.set(REGISTRY_KEYS.runtimeMessage, '区域美术未能载入 · 已切换安全渲染');
      }
      onReady();
    });
    this.load.start();
  }

  private finishBoss(): void {
    if (this.session.bossDefeated) return;
    this.session.bossDefeated = true;
    this.session.currentRoomId = 'core_guardian';
    this.session.health = this.session.maxHealth;
    this.saveService.write(this.session);
    this.transitioning = true;
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.registry.set(REGISTRY_KEYS.runtimeMessage, '守核者 Λ 已离线 · 回声链路解除');
    if (this.session.settings.strongFlashes) this.cameras.main.flash(260, 216, 247, 255);
    this.time.delayedCall(1_150, () => this.scene.start('ending'));
  }
}
