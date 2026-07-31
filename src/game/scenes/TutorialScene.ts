import Phaser from 'phaser';

import type { ProceduralAudio } from '../audio/ProceduralAudio';
import { CombatSystem } from '../combat/CombatSystem';
import { COLORS, REGISTRY_KEYS } from '../constants';
import { getInputDevice, type InputDevice } from '../input/device';
import { InputController } from '../input/InputController';
import { Player } from '../player/Player';
import { releaseArcadeImage } from '../render/arcadePool';
import { queueRegionAssets } from '../render/regionAssets';
import { createNewSession, type GameSessionState } from '../state/GameSession';
import { TUTORIAL_STEPS, tutorialAbilities } from '../tutorial/tutorialPlan';
import { tutorialControlHint } from '../ui/helpContent';
import { bodyTextStyle } from '../ui/text';

export class TutorialScene extends Phaser.Scene {
  private controls!: InputController;
  private player!: Player;
  private combat!: CombatSystem;
  private session!: GameSessionState;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private playerCollider?: Phaser.Physics.Arcade.Collider;
  private progressText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private effectText!: Phaser.GameObjects.Text;
  private stageIndex = 0;
  private stageObjects: Phaser.GameObjects.GameObject[] = [];
  private shootTarget?: Phaser.GameObjects.Image;
  private meleeTarget?: Phaser.GameObjects.Image;
  private wall?: Phaser.Physics.Arcade.Image;
  private shootComplete = false;
  private meleeComplete = false;
  private advancing = false;
  private complete = false;
  private renderedDevice?: InputDevice;

  public constructor() {
    super('tutorial');
  }

  public preload(): void {
    queueRegionAssets(this, 'vestibule');
  }

  public create(): void {
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

    this.add.rectangle(240, 41, 468, 72, COLORS.void, 0.88).setStrokeStyle(1, COLORS.cyan, 0.7);
    this.progressText = this.add.text(14, 10, '', bodyTextStyle('#ffb454'));
    this.titleText = this.add
      .text(240, 9, '', { ...bodyTextStyle('#d8f7ff'), fontSize: '14px' })
      .setOrigin(0.5, 0);
    this.objectiveText = this.add
      .text(240, 31, '', { ...bodyTextStyle('#d8f7ff'), align: 'center' })
      .setOrigin(0.5, 0);
    this.effectText = this.add
      .text(240, 50, '', { ...bodyTextStyle('#8ce7ff'), align: 'center' })
      .setOrigin(0.5, 0);
    this.add.text(468, 10, 'H 帮助 · ESC 标题', bodyTextStyle('#8da1c8')).setOrigin(1, 0);

    this.input.keyboard?.on('keydown-H', this.openHelp, this);
    this.input.keyboard?.on('keydown-ESC', this.returnToTitle, this);
    (this.registry.get(REGISTRY_KEYS.audio) as ProceduralAudio | undefined)?.setBiome('vestibule');
    this.enterStage();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-H', this.openHelp, this);
      this.input.keyboard?.off('keydown-ESC', this.returnToTitle, this);
      this.controls.destroy();
      this.combat.destroy();
      this.playerCollider?.destroy();
      if (this.platforms.children) this.platforms.destroy(true);
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
    if (device !== this.renderedDevice) this.renderStageInstruction(device);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const touchingWallBeforeUpdate =
      body.blocked.left || body.blocked.right || body.touching.left || body.touching.right;
    this.player.updateMovement(delta, input, this.session.abilities);
    const attack = this.combat.update(input);
    const step = TUTORIAL_STEPS[this.stageIndex];
    if (!step) return;

    if (step.id === 'move' && this.player.x >= 82) this.advanceStage();
    else if (
      step.id === 'jump' &&
      this.player.x >= 122 &&
      this.player.x <= 184 &&
      this.player.y <= 212 &&
      (body.blocked.down || body.touching.down)
    ) {
      this.advanceStage();
    } else if (step.id === 'weapons') {
      this.updateWeaponLesson(attack);
    } else if (step.id === 'dash' && this.player.movementState === 'dash' && this.player.x >= 312) {
      this.advanceStage();
    } else if (
      step.id === 'wallJump' &&
      input.pressed.jump &&
      touchingWallBeforeUpdate &&
      body.velocity.y < 0
    ) {
      this.advanceStage();
    } else if (
      step.id === 'interact' &&
      input.pressed.interact &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, 448, 232) < 42
    ) {
      this.finishTutorial();
    }
  }

  private enterStage(): void {
    this.clearStageObjects();
    this.advancing = false;
    const step = TUTORIAL_STEPS[this.stageIndex];
    if (!step) return;
    this.session.abilities = tutorialAbilities(step.id);
    this.progressText.setText(`训练 ${this.stageIndex + 1}/${TUTORIAL_STEPS.length}`);
    this.titleText.setText(step.title);
    this.renderedDevice = undefined;
    this.renderStageInstruction(getInputDevice(this.registry));
    this.effectText.setText(step.effect);
    this.combat.clearTransient();
    this.player.resetTraversalState();

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
    } else if (step.id === 'dash') {
      this.player.setPosition(278, 248);
      const gate = this.add
        .rectangle(322, 203, 12, 74, COLORS.cyan, 0.2)
        .setStrokeStyle(2, COLORS.cyan, 0.95)
        .setDepth(3);
      this.stageObjects.push(gate, this.createBeacon(336, 230, COLORS.cyan));
    } else if (step.id === 'wallJump') {
      this.player.setPosition(350, 248);
      this.wall = this.createPlatform(392, 148, 14, 100, 0x334b76);
      this.stageObjects.push(this.createBeacon(378, 152, 0xed63d6));
    } else {
      this.wall?.destroy();
      this.wall = undefined;
      this.player.setPosition(416, 248);
      const terminal = this.add.image(448, 248, 'terminal').setOrigin(0.5, 1).setDepth(4);
      this.stageObjects.push(terminal);
    }
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
    if (this.shootComplete && this.meleeComplete) this.advanceStage();
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
    this.session.health = this.session.maxHealth;
    this.enterStage();
  }

  private finishTutorial(): void {
    this.complete = true;
    this.combat.clearTransient();
    this.player.setVelocity(0, 0).setAcceleration(0, 0).play('iya-idle', true);
    const panel = this.add.container(0, 0).setDepth(30);
    panel.add(this.add.rectangle(240, 135, 480, 270, COLORS.void, 0.86));
    panel.add(
      this.add
        .rectangle(240, 135, 360, 152, COLORS.panel, 0.98)
        .setStrokeStyle(2, COLORS.cyan, 0.9),
    );
    panel.add(
      this.add
        .text(240, 90, '训练完成', { ...bodyTextStyle('#d8f7ff'), fontSize: '22px' })
        .setOrigin(0.5),
    );
    panel.add(
      this.add
        .text(240, 124, '你已掌握移动、战斗、相位冲刺与磁附跃迁。\n正式任务会从坠星船坞开始。', {
          ...bodyTextStyle('#8ce7ff'),
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );
    const button = this.add
      .text(240, 181, '返回标题 · ENTER / 点击', {
        ...bodyTextStyle('#07101d'),
        backgroundColor: '#43d8e8',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.returnToTitle, this);
    panel.add(button);
    this.input.keyboard?.once('keydown-ENTER', this.returnToTitle, this);
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

  private renderStageInstruction(device: InputDevice): void {
    const step = TUTORIAL_STEPS[this.stageIndex];
    if (!step) return;
    this.renderedDevice = device;
    this.objectiveText.setText(`${tutorialControlHint(step.id, device)}：${step.objective}`);
  }

  private openHelp(): void {
    this.controls.clear();
    this.scene.launch('help', { returnScene: 'tutorial', resumeScene: true });
    this.scene.pause();
  }

  private returnToTitle(): void {
    this.scene.start('title');
  }
}
