import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { initialTutorialHudState, type TutorialHudState } from '../tutorial/tutorialHudState';
import { bodyTextStyle } from '../ui/text';
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
  private rendered: TutorialHudState = initialTutorialHudState();

  public constructor() {
    super('tutorial-hud');
  }

  public create(): void {
    // Phaser 复用 Scene 实例：不清掉上一轮的面板和 diff 缓存，二进训练就会卡在完成界面。
    this.panel?.destroy(true);
    this.panel = undefined;
    this.rendered = initialTutorialHudState();

    this.add.rectangle(240, 41, 468, 72, COLORS.void, 0.88).setStrokeStyle(1, COLORS.cyan, 0.7);
    this.progressText = this.add.text(14, 10, '', bodyTextStyle('#ffb454'));
    this.titleText = this.add.text(240, 9, '', bodyTextStyle('#d8f7ff')).setOrigin(0.5, 0);
    this.objectiveText = this.add
      .text(240, 31, '', { ...bodyTextStyle('#d8f7ff'), align: 'center' })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(450);
    this.effectText = this.add
      .text(240, 50, '', { ...bodyTextStyle('#8ce7ff'), align: 'center' })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(450);
    this.add.text(468, 10, 'H 帮助 · ESC 标题', bodyTextStyle('#8da1c8')).setOrigin(1, 0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.panel?.destroy(true);
      this.panel = undefined;
    });
  }

  public update(): void {
    const state =
      (this.registry.get(REGISTRY_KEYS.tutorialHud) as TutorialHudState | undefined) ??
      initialTutorialHudState();
    if (state.step !== this.rendered.step || state.stepCount !== this.rendered.stepCount) {
      this.progressText.setText(`训练 ${state.step}/${state.stepCount}`);
    }
    if (state.title !== this.rendered.title) this.titleText.setText(state.title);
    if (state.objective !== this.rendered.objective) this.objectiveText.setText(state.objective);
    if (state.effect !== this.rendered.effect) this.effectText.setText(state.effect);
    if (state.complete && !this.panel) this.showCompletionPanel();
    this.rendered = state;
  }

  private showCompletionPanel(): void {
    const panel = this.add.container(0, 0).setDepth(30);
    panel.add(this.add.rectangle(240, 135, 480, 270, COLORS.void, 0.86));
    panel.add(
      this.add
        .rectangle(240, 135, 360, 152, COLORS.panel, 0.98)
        .setStrokeStyle(2, COLORS.cyan, 0.9),
    );
    panel.add(
      this.add
        .text(240, 90, '训练完成', { ...bodyTextStyle('#d8f7ff'), fontSize: '24px' })
        .setOrigin(0.5),
    );
    panel.add(
      this.add
        .text(240, 124, '你已掌握反射、穿盾开核与墙跳贯穿。\n正式任务会从坠星船坞开始。', {
          ...bodyTextStyle('#8ce7ff'),
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );
    panel.add(
      this.add
        .text(240, 181, '返回标题 · ENTER / 点击', {
          ...bodyTextStyle('#07101d'),
          backgroundColor: '#43d8e8',
          padding: { x: 14, y: 7 },
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
