import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { initialTutorialHudState, type TutorialHudState } from '../tutorial/tutorialHudState';
import { BUTTON, TUTORIAL_HUD, UI } from '../ui/layout';
import { headingTextStyle, hudTextStyle, proseTextStyle } from '../ui/text';
import type { TutorialScene } from './TutorialScene';

/**
 * 训练关的 UI 层。世界层挂着 zoom 2 的相机，文本留在那边会被一起放大，
 * 所以照搬 PlayScene → HudScene 的并行场景写法把呈现拆出来。
 */
export class TutorialHudScene extends Phaser.Scene {
  private progressText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private effectText!: Phaser.GameObjects.Text;
  private panel?: Phaser.GameObjects.Container;
  // 按渲染出来的字符串做 diff（照搬 HudScene）：拿状态对象当初值的话，
  // 首个真实状态和「初始状态」在第一课上完全相等，进度行永远不会被写进去。
  private renderedProgress = '';
  private renderedTitle = '';
  private renderedObjective = '';
  private renderedEffect = '';
  private renderedComplete = false;

  public constructor() {
    super('tutorial-hud');
  }

  public create(): void {
    // Phaser 复用 Scene 实例：不清掉上一轮的面板和 diff 缓存，二进训练就会卡在完成界面。
    this.panel?.destroy(true);
    this.panel = undefined;
    this.renderedProgress = '';
    this.renderedTitle = '';
    this.renderedObjective = '';
    this.renderedEffect = '';
    this.renderedComplete = false;

    this.add
      .rectangle(
        UI.centerX,
        TUTORIAL_HUD.band.y,
        TUTORIAL_HUD.band.width,
        TUTORIAL_HUD.band.height,
        COLORS.void,
        0.88,
      )
      .setStrokeStyle(1, COLORS.cyan, 0.7);
    this.progressText = this.add.text(
      TUTORIAL_HUD.progress.x,
      TUTORIAL_HUD.progress.y,
      '',
      hudTextStyle('#ffb454'),
    );
    this.titleText = this.add
      .text(TUTORIAL_HUD.title.x, TUTORIAL_HUD.title.y, '', hudTextStyle('#d8f7ff'))
      .setOrigin(0.5, 0);
    this.objectiveText = this.add
      .text(TUTORIAL_HUD.objective.x, TUTORIAL_HUD.objective.y, '', {
        ...proseTextStyle('#d8f7ff'),
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(TUTORIAL_HUD.objective.wrap);
    this.effectText = this.add
      .text(TUTORIAL_HUD.effect.x, TUTORIAL_HUD.effect.y, '', {
        ...proseTextStyle('#8ce7ff', 'caption'),
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(TUTORIAL_HUD.effect.wrap);
    this.add
      .text(
        TUTORIAL_HUD.keyHint.x,
        TUTORIAL_HUD.keyHint.y,
        'H 帮助 · ESC 标题',
        hudTextStyle('#8da1c8'),
      )
      .setOrigin(1, 0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.panel?.destroy(true);
      this.panel = undefined;
    });
  }

  public update(): void {
    const state =
      (this.registry.get(REGISTRY_KEYS.tutorialHud) as TutorialHudState | undefined) ??
      initialTutorialHudState();
    const progress = `训练 ${state.step}/${state.stepCount}`;
    if (progress !== this.renderedProgress) {
      this.renderedProgress = progress;
      this.progressText.setText(progress);
    }
    if (state.title !== this.renderedTitle) {
      this.renderedTitle = state.title;
      this.titleText.setText(state.title);
    }
    if (state.objective !== this.renderedObjective) {
      this.renderedObjective = state.objective;
      this.objectiveText.setText(state.objective);
    }
    if (state.effect !== this.renderedEffect) {
      this.renderedEffect = state.effect;
      this.effectText.setText(state.effect);
    }
    if (state.complete && !this.renderedComplete) {
      this.renderedComplete = true;
      this.showCompletionPanel();
    }
  }

  private showCompletionPanel(): void {
    const panel = this.add.container(0, 0).setDepth(30);
    panel.add(this.add.rectangle(UI.centerX, UI.centerY, UI.width, UI.height, COLORS.void, 0.86));
    panel.add(
      this.add
        .rectangle(
          UI.centerX,
          UI.centerY,
          TUTORIAL_HUD.panel.width,
          TUTORIAL_HUD.panel.height,
          COLORS.panel,
          0.98,
        )
        .setStrokeStyle(2, COLORS.cyan, 0.9),
    );
    panel.add(
      this.add
        .text(UI.centerX, TUTORIAL_HUD.panelHeading.y, '训练完成', headingTextStyle())
        .setOrigin(0.5),
    );
    panel.add(
      this.add
        .text(
          UI.centerX,
          TUTORIAL_HUD.panelBody.y,
          '你已掌握反射、穿盾开核与墙跳贯穿。正式任务会从坠星船坞开始。',
          { ...proseTextStyle('#8ce7ff'), align: 'center' },
        )
        .setOrigin(0.5, 0)
        .setWordWrapWidth(TUTORIAL_HUD.panelBody.wrap),
    );
    panel.add(
      this.add
        .text(UI.centerX, TUTORIAL_HUD.panelButton.y, '返回标题 · ENTER / 点击', {
          ...hudTextStyle('#07101d'),
          backgroundColor: '#43d8e8',
          padding: { x: BUTTON.paddingX, y: BUTTON.paddingY },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.returnToTitle()),
    );
    this.panel = panel;
    this.input.keyboard?.once('keydown-ENTER', () => this.returnToTitle());
  }

  private returnToTitle(): void {
    (this.scene.get('tutorial') as TutorialScene).returnToTitle();
  }
}
