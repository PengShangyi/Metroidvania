import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { createBrowserSaveService, type SaveService } from '../save/SaveService';
import type { GameSessionState } from '../state/GameSession';
import { completionPercent } from '../ui/completion';
import { bindFullscreenKey } from '../ui/fullscreen';
import { ROOM_MAP_LAYOUT } from '../ui/mapLayout';
import { bodyTextStyle } from '../ui/text';
import rawRooms from '../world/rooms.json';
import type { RoomDefinition } from '../world/types';
import type { PlayScene } from './PlayScene';

type OverlayMode = 'game' | 'map' | 'pause' | 'settings' | 'controls';

export class HudScene extends Phaser.Scene {
  private healthText!: Phaser.GameObjects.Text;
  private explorationText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private dashIcon!: Phaser.GameObjects.Image;
  private gripIcon!: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Container;
  private mode: OverlayMode = 'game';
  private session!: GameSessionState;
  private saveService!: SaveService;
  private previousGamepadMap = false;
  private previousGamepadPause = false;
  private readonly blurHandler = (): void => this.openOverlay('pause');
  private readonly mapKeyHandler = (event: KeyboardEvent): void => {
    event.preventDefault();
    if (this.mode === 'map') this.closeOverlay();
    else if (this.mode === 'game') this.openOverlay('map');
  };
  private readonly pauseKeyHandler = (): void => {
    if (this.mode === 'game') this.openOverlay('pause');
    else if (this.mode === 'pause') this.closeOverlay();
    else this.openOverlay('pause');
  };

  public constructor() {
    super('hud');
  }

  public create(): void {
    this.session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.saveService = createBrowserSaveService();
    this.registry.set(REGISTRY_KEYS.uiMode, 'game');
    bindFullscreenKey(this);

    this.add.image(12, 10, 'base-icons', 0).setOrigin(0).setScrollFactor(0);
    this.healthText = this.add.text(31, 12, '', bodyTextStyle('#d8f7ff')).setScrollFactor(0);
    this.dashIcon = this.add.image(14, 34, 'base-icons', 1).setScrollFactor(0);
    this.gripIcon = this.add.image(34, 34, 'base-icons', 2).setScrollFactor(0);
    this.explorationText = this.add
      .text(468, 12, '', bodyTextStyle('#8da1c8'))
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.add
      .text(468, 28, 'TAB 地图  ·  ESC 暂停', bodyTextStyle('#7184a8'))
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.messageText = this.add
      .text(240, 238, '', {
        ...bodyTextStyle('#d8f7ff'),
        backgroundColor: '#07101dcc',
        padding: { x: 8, y: 5 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.bossText = this.add
      .text(240, 16, '', {
        ...bodyTextStyle('#ffb454'),
        backgroundColor: '#07101dcc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.input.keyboard?.on('keydown-TAB', this.mapKeyHandler);
    this.input.keyboard?.on('keydown-ESC', this.pauseKeyHandler);
    window.addEventListener('blur', this.blurHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-TAB', this.mapKeyHandler);
      this.input.keyboard?.off('keydown-ESC', this.pauseKeyHandler);
      window.removeEventListener('blur', this.blurHandler);
      this.overlay?.destroy(true);
    });
  }

  public update(): void {
    this.healthText.setText(`${this.session.health}/${this.session.maxHealth}`);
    this.explorationText.setText(
      `探索 ${this.session.visitedRooms.size}/17  ·  ${completionPercent(this.session)}%`,
    );
    this.dashIcon.setAlpha(this.session.abilities.phaseDash ? 1 : 0.22);
    this.gripIcon.setAlpha(this.session.abilities.magneticGrip ? 1 : 0.22);
    this.messageText.setText((this.registry.get(REGISTRY_KEYS.runtimeMessage) as string) ?? '');
    this.messageText.setVisible(this.mode === 'game' && this.messageText.text.length > 0);
    this.updateBossBar();
    this.updateGamepadMenuInput();
  }

  private updateBossBar(): void {
    const bossHealth = this.registry.get(REGISTRY_KEYS.bossHealth) as number | undefined;
    const phase = this.registry.get(REGISTRY_KEYS.bossPhase) as number | undefined;
    if (typeof bossHealth === 'number' && bossHealth > 0 && this.mode === 'game') {
      const cells = Math.ceil(bossHealth / 2);
      this.bossText.setText(
        `守核者 Λ  ${'◆'.repeat(cells)}${'◇'.repeat(15 - cells)}  P${phase ?? 1}`,
      );
      this.bossText.setVisible(true);
    } else {
      this.bossText.setVisible(false);
    }
  }

  private updateGamepadMenuInput(): void {
    const pad = this.input.gamepad?.getPad(0);
    const mapPressed = pad?.buttons[8]?.pressed ?? false;
    const pausePressed = pad?.buttons[9]?.pressed ?? false;
    if (mapPressed && !this.previousGamepadMap) {
      if (this.mode === 'map') this.closeOverlay();
      else if (this.mode === 'game') this.openOverlay('map');
    }
    if (pausePressed && !this.previousGamepadPause) this.pauseKeyHandler();
    this.previousGamepadMap = mapPressed;
    this.previousGamepadPause = pausePressed;
  }

  private openOverlay(mode: Exclude<OverlayMode, 'game'>): void {
    if (!this.scene.isActive('play') && !this.scene.isPaused('play')) return;
    if (this.mode === 'game') this.scene.pause('play');
    this.mode = mode;
    this.registry.set(REGISTRY_KEYS.uiMode, mode);
    this.renderOverlay();
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.mode = 'game';
    this.registry.set(REGISTRY_KEYS.uiMode, 'game');
    const play = this.scene.get('play') as PlayScene;
    play.clearInput();
    this.scene.resume('play');
  }

  private renderOverlay(): void {
    this.overlay?.destroy(true);
    const container = this.add.container(0, 0).setDepth(100);
    container.add(this.add.rectangle(240, 135, 480, 270, COLORS.void, 0.8));
    container.add(
      this.add
        .rectangle(240, 135, 444, 232, COLORS.panel, 0.97)
        .setStrokeStyle(1, COLORS.cyan, 0.7),
    );
    this.overlay = container;
    if (this.mode === 'map') this.renderMap(container);
    else if (this.mode === 'pause') this.renderPause(container);
    else if (this.mode === 'settings') this.renderSettings(container);
    else this.renderControls(container);
  }

  private renderPause(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('任务暂停'));
    this.menuButton(container, 88, '继续任务', () => this.closeOverlay());
    this.menuButton(container, 116, '探索地图', () => this.openOverlay('map'));
    this.menuButton(container, 144, '设置', () => this.openOverlay('settings'));
    this.menuButton(container, 172, '控制说明', () => this.openOverlay('controls'));
    this.menuButton(container, 210, '保存于终端 · 返回标题', () => {
      const play = this.scene.get('play') as PlayScene;
      play.returnToTitle();
    });
  }

  private renderSettings(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('设置'));
    this.menuButton(
      container,
      94,
      `主音量  ${Math.round(this.session.settings.masterVolume * 100)}%  · 点击调整`,
      () => {
        const step = Math.round(this.session.settings.masterVolume * 4);
        this.session.settings.masterVolume = ((step + 1) % 5) / 4;
        this.persistSettings();
      },
    );
    this.menuButton(
      container,
      130,
      `屏幕震动  ${this.session.settings.screenShake ? '开启' : '关闭'}`,
      () => {
        this.session.settings.screenShake = !this.session.settings.screenShake;
        this.persistSettings();
      },
    );
    this.menuButton(
      container,
      166,
      `强闪光  ${this.session.settings.strongFlashes ? '开启' : '关闭'}`,
      () => {
        this.session.settings.strongFlashes = !this.session.settings.strongFlashes;
        this.persistSettings();
      },
    );
    container.add(
      this.add
        .text(240, 194, '关闭强闪光时保留轮廓预警，不使用全屏白闪。', bodyTextStyle('#8da1c8'))
        .setOrigin(0.5),
    );
    this.menuButton(container, 222, '返回暂停菜单', () => this.openOverlay('pause'));
  }

  private renderControls(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('控制说明'));
    const controls = [
      '移动        A/D 或 ←/→          左摇杆 / D-pad',
      '跳跃        SPACE               A',
      '能量枪      J                   X',
      '能量刃      K                   Y',
      '相位冲刺    SHIFT               B',
      '交互        E                   RB',
      '地图        TAB                 View',
      '暂停        ESC                 Menu',
      '全屏        F                   —',
    ];
    container.add(
      this.add
        .text(88, 80, controls.join('\n'), {
          ...bodyTextStyle('#d8f7ff'),
          lineSpacing: 7,
        })
        .setOrigin(0, 0),
    );
    container.add(
      this.add
        .text(240, 204, '鼠标仅用于菜单 · 不支持触屏与按键重绑', bodyTextStyle('#8da1c8'))
        .setOrigin(0.5),
    );
    this.menuButton(container, 228, '返回暂停菜单', () => this.openOverlay('pause'));
  }

  private renderMap(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('探索地图'));
    const graphics = this.add.graphics();
    const rooms = rawRooms as RoomDefinition[];
    const connections = new Set<string>();
    for (const room of rooms) {
      for (const exit of room.exits) {
        const key = [room.id, exit.targetRoomId].sort().join('|');
        if (connections.has(key)) continue;
        connections.add(key);
        const start = ROOM_MAP_LAYOUT[room.id];
        const end = ROOM_MAP_LAYOUT[exit.targetRoomId];
        if (!start || !end) continue;
        const explored =
          this.session.visitedRooms.has(room.id) &&
          this.session.visitedRooms.has(exit.targetRoomId);
        graphics.lineStyle(2, explored ? COLORS.cyan : COLORS.steel, explored ? 0.65 : 0.3);
        graphics.lineBetween(start.x, start.y, end.x, end.y);
      }
    }
    for (const room of rooms) {
      const point = ROOM_MAP_LAYOUT[room.id];
      if (!point) continue;
      const current = room.id === this.session.currentRoomId;
      const visited = this.session.visitedRooms.has(room.id);
      graphics.fillStyle(
        current ? COLORS.amber : visited ? COLORS.cyan : COLORS.steel,
        visited ? 1 : 0.42,
      );
      graphics.fillRect(point.x - 6, point.y - 4, 12, 8);
      if (current)
        graphics.lineStyle(1, COLORS.pale, 1).strokeRect(point.x - 8, point.y - 6, 16, 12);
    }
    container.add(graphics);
    container.add(this.add.text(48, 62, '坠星前庭', bodyTextStyle('#8ce7ff')).setOrigin(0.5));
    container.add(this.add.text(270, 62, '生化锻造区', bodyTextStyle('#82d173')).setOrigin(0.5));
    container.add(this.add.text(402, 62, '零点反应堆', bodyTextStyle('#ffb454')).setOrigin(0.5));
    const currentRoom = rooms.find((room) => room.id === this.session.currentRoomId);
    container.add(
      this.add
        .text(
          240,
          216,
          `当前位置：${currentRoom?.name ?? '未知'}  ·  探索 ${this.session.visitedRooms.size}/17  ·  TAB 返回`,
          bodyTextStyle('#d8f7ff'),
        )
        .setOrigin(0.5),
    );
    this.menuButton(container, 238, '返回游戏', () => this.closeOverlay());
  }

  private heading(label: string): Phaser.GameObjects.Text {
    return this.add
      .text(240, 48, label, {
        ...bodyTextStyle('#d8f7ff'),
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  private menuButton(
    container: Phaser.GameObjects.Container,
    y: number,
    label: string,
    action: () => void,
  ): void {
    const button = this.add
      .text(240, y, label, {
        ...bodyTextStyle('#d8f7ff'),
        backgroundColor: '#152445',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => button.setBackgroundColor('#2b5270').setColor('#ffffff'))
      .on('pointerout', () => button.setBackgroundColor('#152445').setColor('#d8f7ff'))
      .on('pointerdown', action);
    container.add(button);
  }

  private persistSettings(): void {
    this.saveService.writeSettings(this.session.settings);
    (this.scene.get('play') as PlayScene).applyAudioSettings();
    this.renderOverlay();
  }
}
