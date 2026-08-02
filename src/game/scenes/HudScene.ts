import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { getInputDevice, setInputDevice, type InputDevice } from '../input/device';
import { createBrowserSaveService, type SaveService } from '../save/SaveService';
import type { GameSessionState } from '../state/GameSession';
import { COMPLETION_TOTAL, completionPercent } from '../ui/completion';
import { bindFullscreenKey } from '../ui/fullscreen';
import { ROOM_MAP_LAYOUT } from '../ui/mapLayout';
import {
  buildAdjacency,
  connectionVisible,
  roomVisibility,
  visibleMarkers,
} from '../ui/mapVisibility';
import { renderHelpPanel } from '../ui/renderHelpPanel';
import { bodyTextStyle } from '../ui/text';
import rawRooms from '../world/rooms.json';
import type { RoomDefinition } from '../world/types';
import type { PlayScene } from './PlayScene';

type OverlayMode = 'game' | 'map' | 'pause' | 'settings' | 'help';

export class HudScene extends Phaser.Scene {
  private healthText!: Phaser.GameObjects.Text;
  private explorationText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private roomLabelText!: Phaser.GameObjects.Text;
  private dashIcon!: Phaser.GameObjects.Image;
  private gripIcon!: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Container;
  private mode: OverlayMode = 'game';
  private session!: GameSessionState;
  private saveService!: SaveService;
  private previousGamepadMap = false;
  private previousGamepadPause = false;
  private previousGamepadHelp = false;
  private helpReturnMode: Exclude<OverlayMode, 'help'> = 'game';
  private renderedHelpDevice?: InputDevice;
  private renderedHealth = '';
  private renderedExploration = '';
  private renderedMessage = '';
  private renderedBoss = '';
  private renderedRoomLabel = '';
  private renderedDash?: boolean;
  private renderedGrip?: boolean;
  private readonly blurHandler = (): void => {
    if (this.mode === 'game') this.openOverlay('pause');
  };
  private readonly mapKeyHandler = (event: KeyboardEvent): void => {
    event.preventDefault();
    if (this.mode === 'map') this.closeOverlay();
    else if (this.mode === 'game') this.openOverlay('map');
  };
  private readonly pauseKeyHandler = (): void => {
    if (this.mode === 'help') this.closeHelp();
    else if (this.mode === 'game') this.openOverlay('pause');
    else if (this.mode === 'pause') this.closeOverlay();
    else this.openOverlay('pause');
  };
  private readonly helpKeyHandler = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyH' || event.repeat) return;
    event.preventDefault();
    if (this.mode === 'help') this.closeHelp();
    else this.openHelp();
  };
  private readonly keyboardDeviceHandler = (): void => this.useInputDevice('keyboardMouse');
  private readonly pointerDeviceHandler = (): void => this.useInputDevice('keyboardMouse');

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
      .text(468, 28, 'TAB 地图 · H 帮助 · ESC 暂停', bodyTextStyle('#8da1c8'))
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
      .setWordWrapWidth(440)
      .setScrollFactor(0);
    this.bossText = this.add
      .text(240, 16, '', {
        ...bodyTextStyle('#ffb454'),
        backgroundColor: '#07101dcc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.roomLabelText = this.add.text(12, 244, '', bodyTextStyle('#7184a8')).setScrollFactor(0);

    this.input.keyboard?.on('keydown-TAB', this.mapKeyHandler);
    this.input.keyboard?.on('keydown-ESC', this.pauseKeyHandler);
    this.input.keyboard?.on('keydown', this.keyboardDeviceHandler);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerDeviceHandler);
    window.addEventListener('blur', this.blurHandler);
    window.addEventListener('keydown', this.helpKeyHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-TAB', this.mapKeyHandler);
      this.input.keyboard?.off('keydown-ESC', this.pauseKeyHandler);
      this.input.keyboard?.off('keydown', this.keyboardDeviceHandler);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.pointerDeviceHandler);
      window.removeEventListener('blur', this.blurHandler);
      window.removeEventListener('keydown', this.helpKeyHandler);
      this.overlay?.destroy(true);
    });
  }

  public update(): void {
    const health = `${this.session.health}/${this.session.maxHealth}`;
    if (health !== this.renderedHealth) {
      this.renderedHealth = health;
      this.healthText.setText(health);
    }
    const exploration = `探索 ${this.session.visitedRooms.size}/${COMPLETION_TOTAL.rooms}  ·  ${completionPercent(this.session)}%`;
    if (exploration !== this.renderedExploration) {
      this.renderedExploration = exploration;
      this.explorationText.setText(exploration);
    }
    if (this.session.abilities.phaseDash !== this.renderedDash) {
      this.renderedDash = this.session.abilities.phaseDash;
      this.dashIcon.setAlpha(this.renderedDash ? 1 : 0.22);
    }
    if (this.session.abilities.magneticGrip !== this.renderedGrip) {
      this.renderedGrip = this.session.abilities.magneticGrip;
      this.gripIcon.setAlpha(this.renderedGrip ? 1 : 0.22);
    }
    const message = (this.registry.get(REGISTRY_KEYS.runtimeMessage) as string) ?? '';
    if (message !== this.renderedMessage) {
      this.renderedMessage = message;
      this.messageText.setText(message);
    }
    this.messageText.setVisible(this.mode === 'game' && this.messageText.text.length > 0);
    const roomLabel = (this.registry.get(REGISTRY_KEYS.roomLabel) as string) ?? '';
    if (roomLabel !== this.renderedRoomLabel) {
      this.renderedRoomLabel = roomLabel;
      this.roomLabelText.setText(roomLabel);
    }
    // 覆盖层展开时必须藏起来，否则它会留在面板底下触发排版重叠断言。
    this.roomLabelText.setVisible(this.mode === 'game' && roomLabel.length > 0);
    this.updateBossBar();
    this.updateGamepadMenuInput();
  }

  private updateBossBar(): void {
    const bossHealth = this.registry.get(REGISTRY_KEYS.bossHealth) as number | undefined;
    const phase = this.registry.get(REGISTRY_KEYS.bossPhase) as number | undefined;
    if (typeof bossHealth === 'number' && bossHealth > 0 && this.mode === 'game') {
      const cells = Math.ceil(bossHealth / 2);
      const boss = `守核者 Λ  ${'◆'.repeat(cells)}${'◇'.repeat(15 - cells)}  P${phase ?? 1}`;
      if (boss !== this.renderedBoss) {
        this.renderedBoss = boss;
        this.bossText.setText(boss);
      }
      this.bossText.setVisible(true);
    } else {
      this.renderedBoss = '';
      this.bossText.setVisible(false);
    }
  }

  private updateGamepadMenuInput(): void {
    const pad = this.input.gamepad?.getPad(0);
    const mapPressed = pad?.buttons[8]?.pressed ?? false;
    const pausePressed = pad?.buttons[9]?.pressed ?? false;
    const helpPressed = pad?.buttons[4]?.pressed ?? false;
    const gamepadActive =
      Boolean(pad) &&
      ((pad?.buttons.some((button) => button.pressed) ?? false) ||
        Math.abs(pad?.axes[0]?.getValue() ?? 0) > 0.24 ||
        Math.abs(pad?.axes[1]?.getValue() ?? 0) > 0.24);
    if (gamepadActive) this.useInputDevice('gamepad');
    if (helpPressed && !this.previousGamepadHelp) {
      if (this.mode === 'help') this.closeHelp();
      else this.openHelp();
    } else if (mapPressed && !this.previousGamepadMap && this.mode !== 'help') {
      if (this.mode === 'map') this.closeOverlay();
      else if (this.mode === 'game') this.openOverlay('map');
    }
    if (pausePressed && !this.previousGamepadPause && this.mode !== 'help') {
      this.pauseKeyHandler();
    }
    this.previousGamepadMap = mapPressed;
    this.previousGamepadPause = pausePressed;
    this.previousGamepadHelp = helpPressed;
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
    if (this.mode === 'help') {
      this.renderedHelpDevice = getInputDevice(this.registry);
      this.registry.set(REGISTRY_KEYS.uiMode, `help-${this.renderedHelpDevice}`);
      renderHelpPanel(this, container, this.renderedHelpDevice);
      const close = this.add
        .text(454, 28, '关闭 ×', {
          ...bodyTextStyle('#d8f7ff'),
          backgroundColor: '#25385c',
          padding: { x: 7, y: 4 },
        })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.closeHelp());
      container.add(close);
    } else if (this.mode === 'map') this.renderMap(container);
    else if (this.mode === 'pause') this.renderPause(container);
    else if (this.mode === 'settings') this.renderSettings(container);
  }

  private renderPause(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('任务暂停'));
    this.menuButton(container, 88, '继续任务', () => this.closeOverlay());
    this.menuButton(container, 116, '探索地图', () => this.openOverlay('map'));
    this.menuButton(container, 144, '设置', () => this.openOverlay('settings'));
    this.menuButton(container, 172, '帮助与控制', () => this.openHelp());
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

  private renderMap(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('探索地图'));
    const graphics = this.add.graphics();
    const rooms = rawRooms as RoomDefinition[];
    const visited = this.session.visitedRooms;
    const adjacency = buildAdjacency(rooms);

    const connections = new Set<string>();
    for (const room of rooms) {
      for (const exit of room.exits) {
        const key = [room.id, exit.targetRoomId].sort().join('|');
        if (connections.has(key)) continue;
        connections.add(key);
        if (!connectionVisible(room.id, exit.targetRoomId, visited)) continue;
        const start = ROOM_MAP_LAYOUT[room.id];
        const end = ROOM_MAP_LAYOUT[exit.targetRoomId];
        if (!start || !end) continue;
        const explored = visited.has(room.id) && visited.has(exit.targetRoomId);
        graphics.lineStyle(2, explored ? COLORS.cyan : COLORS.steel, explored ? 0.65 : 0.3);
        graphics.lineBetween(start.x, start.y, end.x, end.y);
      }
    }

    for (const room of rooms) {
      const point = ROOM_MAP_LAYOUT[room.id];
      if (!point) continue;
      const visibility = roomVisibility(room.id, visited, adjacency);
      if (visibility === 'hidden') continue;
      if (visibility === 'adjacent') {
        // 只画轮廓：玩家知道那边有个房间，但还不知道里面是什么。
        graphics.lineStyle(1, COLORS.steel, 0.55).strokeRect(point.x - 6, point.y - 4, 12, 8);
        continue;
      }
      const current = room.id === this.session.currentRoomId;
      graphics.fillStyle(current ? COLORS.amber : COLORS.cyan, 1);
      graphics.fillRect(point.x - 6, point.y - 4, 12, 8);
      if (current)
        graphics.lineStyle(1, COLORS.pale, 1).strokeRect(point.x - 8, point.y - 6, 16, 12);
    }

    // 标注全部用 graphics 画：地图上不加文本，避免踩低分辨率排版断言。
    for (const marker of visibleMarkers(rooms, this.session)) {
      const point = ROOM_MAP_LAYOUT[marker.roomId];
      if (!point) continue;
      if (marker.kind === 'terminal') {
        graphics.fillStyle(COLORS.pale, 0.95).fillRect(point.x - 1, point.y - 9, 2, 4);
      } else if (marker.kind === 'pickup') {
        graphics.fillStyle(COLORS.amber, 0.95).fillCircle(point.x + 8, point.y - 6, 2);
      } else {
        graphics.lineStyle(1, 0xed63d6, 0.9).strokeRect(point.x - 9, point.y + 5, 4, 3);
      }
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
          204,
          `当前位置：${currentRoom?.name ?? '未知'}  ·  探索 ${visited.size}/${COMPLETION_TOTAL.rooms}`,
          bodyTextStyle('#d8f7ff'),
        )
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(
          240,
          218,
          '白点终端 · 琥珀点未取道具 · 紫框能力门 · TAB 返回',
          bodyTextStyle('#8da1c8'),
        )
        .setOrigin(0.5),
    );
    this.menuButton(container, 238, '返回游戏', () => this.closeOverlay());
  }

  private heading(label: string): Phaser.GameObjects.Text {
    return this.add
      .text(240, 48, label, {
        ...bodyTextStyle('#d8f7ff'),
        fontSize: '24px',
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

  private openHelp(): void {
    if (this.mode === 'help') return;
    this.helpReturnMode = this.mode;
    if (this.mode === 'game') this.scene.pause('play');
    this.mode = 'help';
    this.renderedHelpDevice = undefined;
    this.renderOverlay();
  }

  private closeHelp(): void {
    if (this.mode !== 'help') return;
    const returnMode = this.helpReturnMode;
    if (returnMode === 'game') {
      this.closeOverlay();
      return;
    }
    this.mode = returnMode;
    this.registry.set(REGISTRY_KEYS.uiMode, returnMode);
    this.renderOverlay();
  }

  private useInputDevice(device: InputDevice): void {
    const changed = setInputDevice(this.registry, device);
    if (changed && this.mode === 'help') {
      this.renderedHelpDevice = undefined;
      this.renderOverlay();
    }
  }

  private persistSettings(): void {
    this.saveService.writeSettings(this.session.settings);
    (this.scene.get('play') as PlayScene).applyAudioSettings();
    this.renderOverlay();
  }
}
