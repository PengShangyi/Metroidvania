import Phaser from 'phaser';

import type { ProceduralAudio } from '../audio/ProceduralAudio';
import { AUDIO_EVENT, type AudioCue } from '../audio/soundDesign';
import { CombatSystem } from '../combat/CombatSystem';
import {
  COMBAT_EVENTS,
  type PiercingHitEvent,
  type ProjectileReflectedEvent,
  type ShieldCoreHitEvent,
  type ShieldOpenedEvent,
} from '../combat/events';
import { COLORS, REGISTRY_KEYS } from '../constants';
import { EnemySystem } from '../enemies/EnemySystem';
import { getInputDevice, type InputDevice } from '../input/device';
import { InputController } from '../input/InputController';
import { Player } from '../player/Player';
import { releaseArcadeImage } from '../render/arcadePool';
import { queueRegionAssets } from '../render/regionAssets';
import { createNewSession, type GameSessionState } from '../state/GameSession';
import { trainingEnemiesExhausted, tutorialStageComplete } from '../tutorial/stageCompletion';
import {
  initialTutorialHudState,
  tutorialHudState,
  withComplete,
  withEffect,
  type TutorialHudState,
} from '../tutorial/tutorialHudState';
import {
  TUTORIAL_STEPS,
  tutorialAbilities,
  tutorialEnemies,
  type TutorialStepId,
} from '../tutorial/tutorialPlan';

export class TutorialScene extends Phaser.Scene {
  private controls!: InputController;
  private player!: Player;
  private combat!: CombatSystem;
  private enemySystem!: EnemySystem;
  private audio?: ProceduralAudio;
  private session!: GameSessionState;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private playerCollider?: Phaser.Physics.Arcade.Collider;
  private stageIndex = 0;
  private stageObjects: Phaser.GameObjects.GameObject[] = [];
  private shootTarget?: Phaser.GameObjects.Image;
  private meleeTarget?: Phaser.GameObjects.Image;
  private wall?: Phaser.Physics.Arcade.Image;
  private shootComplete = false;
  private meleeComplete = false;
  private piercingProjectileSerial?: number;
  private readonly piercingTargets = new Set<string>();
  private advancing = false;
  private complete = false;
  private restocking = false;
  private renderedDevice?: InputDevice;
  /**
   * HelpScene 关闭时只 resume 自己的 returnScene，够不到并行的 UI 场景，
   * 所以由本场景在自己被唤醒时把它一起带回来。
   */
  private readonly resumeHudHandler = (): void => {
    this.scene.resume('tutorial-hud');
  };

  public constructor() {
    super('tutorial');
  }

  public preload(): void {
    queueRegionAssets(this, 'vestibule');
  }

  public create(): void {
    // 同一个 Scene 实例会被复用：不复位的话，通关一次后再进训练只会看到空白界面。
    this.stageIndex = 0;
    this.complete = false;
    this.advancing = false;
    this.restocking = false;
    this.shootComplete = false;
    this.meleeComplete = false;
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.drawBackground();
    this.session = createNewSession();
    const activeSession = this.registry.get(REGISTRY_KEYS.session) as GameSessionState | undefined;
    if (activeSession) this.session.settings = { ...activeSession.settings };
    this.controls = new InputController(this);
    this.platforms = this.physics.add.staticGroup();
    this.createPlatform(0, 248, 480, 22, COLORS.steel);
    this.createPlatform(122, 210, 62, 10, 0x334b76);

    this.player = new Player(this, 36, 248);
    this.playerCollider = this.physics.add.collider(this.player, this.platforms);
    this.combat = new CombatSystem(this, this.player, this.session, () => this.resetStage());
    this.combat.bindWorld(this.platforms);
    this.enemySystem = new EnemySystem(this, this.player, this.combat);

    this.registry.set(REGISTRY_KEYS.tutorialHud, initialTutorialHudState());
    this.scene.launch('tutorial-hud');
    this.events.on(Phaser.Scenes.Events.RESUME, this.resumeHudHandler);

    this.input.keyboard?.on('keydown-H', this.openHelp, this);
    this.input.keyboard?.on('keydown-ESC', this.returnToTitle, this);
    this.audio = this.registry.get(REGISTRY_KEYS.audio) as ProceduralAudio | undefined;
    this.audio?.setBiome('vestibule');
    this.events.on(AUDIO_EVENT, this.playAudio, this);
    this.events.on(COMBAT_EVENTS.projectileReflected, this.onProjectileReflected, this);
    this.events.on(COMBAT_EVENTS.shieldOpened, this.onShieldOpened, this);
    this.events.on(COMBAT_EVENTS.shieldCoreHit, this.onShieldCoreHit, this);
    this.events.on(COMBAT_EVENTS.piercingHit, this.onPiercingHit, this);
    this.enterStage();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-H', this.openHelp, this);
      this.input.keyboard?.off('keydown-ESC', this.returnToTitle, this);
      this.events.off(Phaser.Scenes.Events.RESUME, this.resumeHudHandler);
      this.controls.destroy();
      this.combat.destroy();
      this.enemySystem.destroy();
      this.playerCollider?.destroy();
      if (this.platforms.children) this.platforms.destroy(true);
      this.scene.stop('tutorial-hud');
    });
  }

  public update(_time: number, delta: number): void {
    if (this.complete || this.advancing) return;
    const input = this.controls.update();
    if (input.pressed.help) {
      this.openHelp();
      return;
    }
    const device = getInputDevice(this.registry);
    if (device !== this.renderedDevice) this.publishHudState(device);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const wallJumpSerialBefore = this.player.wallJumpSerial;
    this.player.updateMovement(delta, input, this.session.abilities);
    const attack = this.combat.update(input);
    this.enemySystem.update(delta, attack);
    const step = TUTORIAL_STEPS[this.stageIndex];
    if (!step) return;
    if (step.id === 'weapons') this.updateWeaponLesson(attack);
    if (trainingEnemiesExhausted(step.id, this.enemySystem.activeEnemyCount())) {
      this.restockTrainingEnemies(step.id);
      return;
    }

    const complete = tutorialStageComplete(step.id, {
      playerX: this.player.x,
      playerY: this.player.y,
      grounded: body.blocked.down || body.touching.down,
      movementState: this.player.movementState,
      wallJumpSerialBefore,
      wallJumpSerialAfter: this.player.wallJumpSerial,
      interactPressed: input.pressed.interact,
      shootTargetDown: this.shootComplete,
      meleeTargetDown: this.meleeComplete,
    });
    if (!complete) return;
    if (step.id === 'interact') this.finishTutorial();
    else this.advanceStage();
  }

  private enterStage(): void {
    this.enemySystem.clear();
    this.clearStageObjects();
    this.advancing = false;
    const step = TUTORIAL_STEPS[this.stageIndex];
    if (!step) return;
    this.session.health = this.session.maxHealth;
    this.session.abilities = tutorialAbilities(step.id);
    this.renderedDevice = undefined;
    this.publishHudState(getInputDevice(this.registry));
    this.combat.clearTransient();
    this.player.resetTraversalState();
    this.piercingProjectileSerial = undefined;
    this.piercingTargets.clear();

    if (step.id === 'move') {
      this.player.setPosition(36, 248);
      this.stageObjects.push(this.createBeacon(86, 230, COLORS.cyan));
    } else if (step.id === 'jump') {
      this.player.setPosition(92, 248);
      this.stageObjects.push(this.createBeacon(154, 196, COLORS.amber));
    } else if (step.id === 'weapons') {
      this.player.setPosition(194, 248);
      this.shootComplete = false;
      this.meleeComplete = false;
      this.shootTarget = this.add.image(246, 218, 'sentry').setDepth(4);
      this.meleeTarget = this.add.image(288, 244, 'crawler').setOrigin(0.5, 1).setDepth(4);
      this.stageObjects.push(this.shootTarget, this.meleeTarget);
    } else if (step.id === 'reflect') {
      this.player.setPosition(224, 248);
      this.stageObjects.push(this.createBeacon(286, 230, COLORS.amber));
    } else if (step.id === 'dash') {
      this.player.setPosition(278, 248);
      const gate = this.add
        .rectangle(322, 203, 12, 74, COLORS.cyan, 0.2)
        .setStrokeStyle(2, COLORS.cyan, 0.95)
        .setDepth(3);
      this.stageObjects.push(gate, this.createBeacon(336, 230, COLORS.cyan));
    } else if (step.id === 'shield') {
      this.player.setPosition(180, 248);
      this.stageObjects.push(this.createBeacon(310, 230, COLORS.amber));
    } else if (step.id === 'wallJump') {
      this.player.setPosition(350, 248);
      this.wall = this.createPlatform(392, 148, 14, 100, 0x334b76);
      this.stageObjects.push(this.createBeacon(378, 152, 0xed63d6));
    } else if (step.id === 'piercing') {
      this.player.setPosition(152, 205);
      this.wall = this.createPlatform(112, 110, 14, 138, 0x334b76);
      this.stageObjects.push(
        this.createPlatform(126, 205, 58, 8, 0x334b76),
        this.createBeacon(238, 148, COLORS.amber),
        this.createBeacon(304, 148, COLORS.amber),
      );
    } else {
      this.wall?.destroy();
      this.wall = undefined;
      this.player.setPosition(416, 248);
      const terminal = this.add.image(448, 248, 'terminal').setOrigin(0.5, 1).setDepth(4);
      this.stageObjects.push(terminal);
    }
    this.player.setVelocity(0, 0).setAcceleration(0, 0);
    this.enemySystem.load(tutorialEnemies(step.id), this.platforms);
  }

  private updateWeaponLesson(attack: ReturnType<CombatSystem['update']>): void {
    if (this.shootTarget?.active) {
      attack.projectiles.children.each((child) => {
        const shot = child as Phaser.Physics.Arcade.Image;
        if (
          shot.active &&
          Phaser.Geom.Intersects.RectangleToRectangle(
            shot.getBounds(),
            this.shootTarget!.getBounds(),
          )
        ) {
          releaseArcadeImage(shot);
          this.shootTarget?.setTintFill(0xffffff).setAlpha(0.25);
          this.shootComplete = true;
        }
        return true;
      });
    }
    if (
      this.meleeTarget?.active &&
      attack.meleeBounds &&
      Phaser.Geom.Intersects.RectangleToRectangle(this.meleeTarget.getBounds(), attack.meleeBounds)
    ) {
      this.meleeTarget.setTintFill(0xffffff).setAlpha(0.25);
      this.meleeComplete = true;
    }
  }

  private advanceStage(): void {
    if (this.advancing) return;
    this.advancing = true;
    this.cameras.main.flash(100, 67, 216, 232);
    this.time.delayedCall(260, () => {
      this.stageIndex += 1;
      this.enterStage();
    });
  }

  private resetStage(): void {
    if (this.advancing || this.complete) return;
    this.advancing = true;
    this.session.health = this.session.maxHealth;
    this.time.delayedCall(0, () => this.enterStage());
  }

  /**
   * 反射课和贯穿课的完成信号来自 COMBAT_EVENTS，靶子被打死就再也触发不了；
   * 而敌人死光后玩家也不会再受伤，resetStage 那条死亡回退路径同样走不到。
   * 所以这里必须自己把训练体补回来，否则这两课只能按 ESC 放弃。
   */
  private restockTrainingEnemies(step: TutorialStepId): void {
    if (this.restocking || this.advancing || this.complete) return;
    this.restocking = true;
    this.piercingProjectileSerial = undefined;
    this.piercingTargets.clear();
    this.publishEffect('训练体已耗尽 · 正在重构');
    this.time.delayedCall(800, () => {
      this.restocking = false;
      if (this.complete || this.advancing) return;
      if (TUTORIAL_STEPS[this.stageIndex]?.id !== step) return;
      this.enemySystem.load(tutorialEnemies(step), this.platforms);
      this.publishEffect(TUTORIAL_STEPS[this.stageIndex]?.effect ?? '');
    });
  }

  private finishTutorial(): void {
    this.complete = true;
    this.combat.clearTransient();
    this.player.setVelocity(0, 0).setAcceleration(0, 0).play('iya-idle', true);
    const current = this.registry.get(REGISTRY_KEYS.tutorialHud) as TutorialHudState | undefined;
    if (current) this.registry.set(REGISTRY_KEYS.tutorialHud, withComplete(current));
  }

  private clearStageObjects(): void {
    for (const object of this.stageObjects) {
      if (object.active) object.destroy();
    }
    this.stageObjects = [];
    this.shootTarget = undefined;
    this.meleeTarget = undefined;
    if (this.wall?.active) this.wall.destroy();
    this.wall = undefined;
  }

  private createPlatform(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ): Phaser.Physics.Arcade.Image {
    const platform = this.platforms
      .create(x + width / 2, y + height / 2, 'pixel')
      .setDisplaySize(width, height)
      .setTint(color) as Phaser.Physics.Arcade.Image;
    platform.refreshBody();
    return platform;
  }

  private createBeacon(x: number, y: number, color: number): Phaser.GameObjects.Arc {
    return this.add.circle(x, y, 6, color, 0.35).setStrokeStyle(2, color, 0.95).setDepth(4);
  }

  private drawBackground(): void {
    if (this.textures.exists('vestibule-bg')) {
      this.add.image(0, 0, 'vestibule-bg').setOrigin(0).setDisplaySize(480, 270).setAlpha(0.34);
    }
    const graphics = this.add.graphics().setDepth(-5);
    graphics.fillStyle(COLORS.void, 0.42).fillRect(0, 0, 480, 270);
    graphics.lineStyle(1, COLORS.cyan, 0.15);
    for (let x = 24; x < 480; x += 48) graphics.strokeRect(x, 78, 28, 164);
  }

  private publishHudState(device: InputDevice): void {
    this.renderedDevice = device;
    this.registry.set(REGISTRY_KEYS.tutorialHud, tutorialHudState(this.stageIndex, device));
  }

  private publishEffect(effect: string): void {
    const current = this.registry.get(REGISTRY_KEYS.tutorialHud) as TutorialHudState | undefined;
    if (!current) return;
    this.registry.set(REGISTRY_KEYS.tutorialHud, withEffect(current, effect));
  }

  private openHelp(): void {
    this.controls.clear();
    this.combat.clearHitStop();
    this.scene.launch('help', { returnScene: 'tutorial', resumeScene: true });
    this.scene.pause('tutorial-hud');
    this.scene.pause();
  }

  public returnToTitle(): void {
    this.scene.start('title');
  }

  private playAudio(cue: AudioCue): void {
    this.audio?.play(cue);
  }

  private onProjectileReflected(_event: ProjectileReflectedEvent): void {
    if (TUTORIAL_STEPS[this.stageIndex]?.id === 'reflect') this.advanceStage();
  }

  private onShieldOpened(_event: ShieldOpenedEvent): void {
    if (TUTORIAL_STEPS[this.stageIndex]?.id !== 'shield') return;
    this.publishEffect('核心已开放：留在抵达侧，用能量刃或能量枪攻击。');
  }

  private onShieldCoreHit(_event: ShieldCoreHitEvent): void {
    if (TUTORIAL_STEPS[this.stageIndex]?.id === 'shield') this.advanceStage();
  }

  private onPiercingHit(event: PiercingHitEvent): void {
    if (TUTORIAL_STEPS[this.stageIndex]?.id !== 'piercing') return;
    if (this.piercingProjectileSerial !== event.serial) {
      this.piercingProjectileSerial = event.serial;
      this.piercingTargets.clear();
    }
    this.piercingTargets.add(event.targetId);
    this.publishEffect(`贯穿命中 ${this.piercingTargets.size}/2：保持移动，继续穿透目标。`);
    if (this.piercingTargets.size >= 2) this.advanceStage();
  }
}
