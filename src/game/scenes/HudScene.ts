import Phaser from 'phaser';

import { COLORS, REGISTRY_KEYS } from '../constants';
import { getInputDevice, setInputDevice, type InputDevice } from '../input/device';
import { createBrowserSaveService, type SaveService } from '../save/SaveService';
import type { GameSessionState } from '../state/GameSession';
import { COMPLETION_TOTAL, completionPercent } from '../ui/completion';
import { bindFullscreenKey } from '../ui/fullscreen';
import { overlayKeyAction, type OverlayKey, type OverlayMode } from '../ui/hudMode';
import { ROOM_MAP_LAYOUT } from '../ui/mapLayout';
import {
  buildAdjacency,
  connectionVisible,
  roomVisibility,
  visibleMarkers,
} from '../ui/mapVisibility';
import { BUTTON, HUD, MAP, OVERLAY, PAUSE, SETTINGS, UI, mapPoint } from '../ui/layout';
import { renderHelpPanel } from '../ui/renderHelpPanel';
import { headingTextStyle, hudTextStyle, proseTextStyle, wrapProse } from '../ui/text';
import rawRooms from '../world/rooms.json';
import type { RoomDefinition } from '../world/types';
import type { PlayScene } from './PlayScene';

export class HudScene extends Phaser.Scene {
  private healthText!: Phaser.GameObjects.Text;
  private explorationText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private roomLabelText!: Phaser.GameObjects.Text;
  private dashIcon!: Phaser.GameObjects.Image;
  private gripIcon!: Phaser.GameObjects.Image;
  /** 覆盖层展开时要整层藏掉的常驻 HUD，否则它们会从面板底下透出来并撞版。 */
  private gameLayer: Phaser.GameObjects.Components.Visible[] = [];
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
    this.applyOverlayKey('map');
  };
  private readonly pauseKeyHandler = (): void => this.applyOverlayKey('pause');
  private readonly helpKeyHandler = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyH' || event.repeat) return;
    event.preventDefault();
    this.applyOverlayKey('help');
  };
  private readonly keyboardDeviceHandler = (): void => this.useInputDevice('keyboardMouse');
  private readonly pointerDeviceHandler = (): void => this.useInputDevice('keyboardMouse');

  public constructor() {
    super('hud');
  }

  public create(): void {
    // Phaser 复用 Scene 实例，字段初始化器不会重跑。mode 残留上一局退出时的
    // 'pause'/'map' 会让 syncHudVisibility 把常驻 HUD 整层藏掉，而只有 closeOverlay
    // 写得回 'game'——玩家必须先开一次覆盖层才看得到 HUD。rendered* 是 diff 基准，
    // 残留旧值会与新建的空串判等，血量、探索度、房名就永远不画。
    this.overlay = undefined;
    this.setMode('game');
    this.helpReturnMode = 'game';
    this.renderedHelpDevice = undefined;
    this.renderedHealth = '';
    this.renderedExploration = '';
    this.renderedMessage = '';
    this.renderedBoss = '';
    this.renderedRoomLabel = '';
    this.renderedDash = undefined;
    this.renderedGrip = undefined;
    this.previousGamepadMap = false;
    this.previousGamepadPause = false;
    this.previousGamepadHelp = false;

    this.session = this.registry.get(REGISTRY_KEYS.session) as GameSessionState;
    this.saveService = createBrowserSaveService();
    bindFullscreenKey(this);

    // 图标源图是 16×16 的像素画，整数 2× 放大，和世界层的做法一致。
    const healthIcon = this.add
      .image(HUD.healthIcon.x, HUD.healthIcon.y, 'base-icons', 0)
      .setOrigin(0)
      .setScale(2)
      .setScrollFactor(0);
    this.healthText = this.add
      .text(HUD.healthText.x, HUD.healthText.y, '', hudTextStyle('#d8f7ff'))
      .setScrollFactor(0);
    this.dashIcon = this.add
      .image(HUD.abilityIcon.firstX, HUD.abilityIcon.y, 'base-icons', 1)
      .setScale(2)
      .setScrollFactor(0);
    this.gripIcon = this.add
      .image(HUD.abilityIcon.firstX + HUD.abilityIcon.gap, HUD.abilityIcon.y, 'base-icons', 2)
      .setScale(2)
      .setScrollFactor(0);
    this.explorationText = this.add
      .text(HUD.exploration.x, HUD.exploration.y, '', hudTextStyle('#8da1c8'))
      .setOrigin(1, 0)
      .setScrollFactor(0);
    const keyHint = this.add
      .text(HUD.keyHint.x, HUD.keyHint.y, 'TAB 地图 · H 帮助 · ESC 暂停', hudTextStyle('#8da1c8'))
      .setOrigin(1, 0)
      .setScrollFactor(0);
    // 底部对齐：多行提示向上生长，不会压到左下角的房名。
    this.messageText = wrapProse(
      this.add
        .text(HUD.toast.x, HUD.toast.bottom, '', {
          ...proseTextStyle('#d8f7ff'),
          backgroundColor: '#07101dcc',
          padding: { x: 16, y: 10 },
          align: 'center',
        })
        .setOrigin(0.5, 1)
        .setScrollFactor(0),
      HUD.toast.wrap,
    );
    // Boss 血条必须留在像素字体上：15 格菱形要靠可预测的步进宽度对齐。
    this.bossText = this.add
      .text(HUD.bossBar.x, HUD.bossBar.y, '', {
        ...hudTextStyle('#ffb454'),
        backgroundColor: '#07101dcc',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.roomLabelText = this.add
      .text(HUD.roomLabel.x, HUD.roomLabel.y, '', hudTextStyle('#7184a8'))
      .setOrigin(0, 1)
      .setScrollFactor(0);
    this.gameLayer = [
      healthIcon,
      this.healthText,
      this.dashIcon,
      this.gripIcon,
      this.explorationText,
      keyHint,
    ];
    this.syncHudVisibility();

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
      this.overlay = undefined;
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
    const roomLabel = (this.registry.get(REGISTRY_KEYS.roomLabel) as string) ?? '';
    if (roomLabel !== this.renderedRoomLabel) {
      this.renderedRoomLabel = roomLabel;
      this.roomLabelText.setText(roomLabel);
    }
    this.updateBossBar();
    this.syncHudVisibility();
    this.updateGamepadMenuInput();
  }

  /**
   * 覆盖层展开时整层 HUD 都要藏起来，否则会从面板底下透出来并撞版。
   *
   * 必须在切换模式的当下就调用，不能只依赖 update()：openOverlay 是在 update 之外
   * 同步改 mode 的，中间那一帧 HUD 仍然可见——Chromium 上碰巧看不出来，Firefox 上会。
   */
  private syncHudVisibility(): void {
    const inGame = this.mode === 'game';
    for (const object of this.gameLayer) object.setVisible(inGame);
    this.messageText.setVisible(inGame && this.messageText.text.length > 0);
    this.roomLabelText.setVisible(inGame && this.roomLabelText.text.length > 0);
    if (!inGame) this.bossText.setVisible(false);
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
    if (helpPressed && !this.previousGamepadHelp) this.applyOverlayKey('help');
    else if (mapPressed && !this.previousGamepadMap) this.applyOverlayKey('map');
    // help 只交给 LB 关闭：MENU 在 help 下不响应，避免一次按压同时穿过两层面板。
    if (pausePressed && !this.previousGamepadPause && this.mode !== 'help') {
      this.applyOverlayKey('pause');
    }
    this.previousGamepadMap = mapPressed;
    this.previousGamepadPause = pausePressed;
    this.previousGamepadHelp = helpPressed;
  }

  /**
   * mode 与 registry 必须一起写。它们曾经是两份独立状态：create() 只写 registry，
   * 于是 e2e 断言的 uiMode 全程正确，而真正控制 HUD 可见性的字段留着上一局的值。
   */
  private setMode(next: OverlayMode): void {
    this.mode = next;
    this.registry.set(REGISTRY_KEYS.uiMode, next);
  }

  private applyOverlayKey(key: OverlayKey): void {
    const action = overlayKeyAction(this.mode, key);
    if (action.kind === 'open') {
      if (action.mode === 'help') this.openHelp();
      else this.openOverlay(action.mode);
    } else if (action.kind === 'close') this.closeOverlay();
    else if (action.kind === 'closeHelp') this.closeHelp();
  }

  private openOverlay(mode: Exclude<OverlayMode, 'game'>): void {
    if (!this.scene.isActive('play') && !this.scene.isPaused('play')) return;
    if (this.mode === 'game') this.scene.pause('play');
    this.setMode(mode);
    this.syncHudVisibility();
    this.renderOverlay();
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.setMode('game');
    this.syncHudVisibility();
    const play = this.scene.get('play') as PlayScene;
    play.clearInput();
    this.scene.resume('play');
  }

  private renderOverlay(): void {
    this.overlay?.destroy(true);
    const container = this.add.container(0, 0).setDepth(100);
    container.add(
      this.add.rectangle(UI.centerX, UI.centerY, UI.width, UI.height, COLORS.void, 0.8),
    );
    container.add(
      this.add
        .rectangle(
          UI.centerX,
          UI.centerY,
          OVERLAY.panel.width,
          OVERLAY.panel.height,
          COLORS.panel,
          0.97,
        )
        .setStrokeStyle(1, COLORS.cyan, 0.7),
    );
    this.overlay = container;
    if (this.mode === 'help') {
      this.renderedHelpDevice = getInputDevice(this.registry);
      this.registry.set(REGISTRY_KEYS.uiMode, `help-${this.renderedHelpDevice}`);
      renderHelpPanel(this, container, this.renderedHelpDevice);
      const close = this.add
        .text(OVERLAY.close.x, OVERLAY.close.y, '关闭 ×', {
          ...hudTextStyle('#d8f7ff'),
          backgroundColor: '#25385c',
          padding: { x: BUTTON.paddingX, y: BUTTON.paddingY },
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
    const [resumeY, mapY, settingsY, helpY, exitY] = PAUSE.rows;
    container.add(this.heading('任务暂停'));
    this.menuButton(container, resumeY, '继续任务', () => this.closeOverlay());
    this.menuButton(container, mapY, '探索地图', () => this.openOverlay('map'));
    this.menuButton(container, settingsY, '设置', () => this.openOverlay('settings'));
    this.menuButton(container, helpY, '帮助与控制', () => this.openHelp());
    this.menuButton(container, exitY, '保存于终端 · 返回标题', () => {
      const play = this.scene.get('play') as PlayScene;
      play.returnToTitle();
    });
  }

  private renderSettings(container: Phaser.GameObjects.Container): void {
    const [volumeY, shakeY, flashY] = SETTINGS.rows;
    container.add(this.heading('设置'));
    this.menuButton(
      container,
      volumeY,
      `主音量  ${Math.round(this.session.settings.masterVolume * 100)}%  · 点击调整`,
      () => {
        const step = Math.round(this.session.settings.masterVolume * 4);
        this.session.settings.masterVolume = ((step + 1) % 5) / 4;
        this.persistSettings();
      },
    );
    this.menuButton(
      container,
      shakeY,
      `屏幕震动  ${this.session.settings.screenShake ? '开启' : '关闭'}`,
      () => {
        this.session.settings.screenShake = !this.session.settings.screenShake;
        this.persistSettings();
      },
    );
    this.menuButton(
      container,
      flashY,
      `强闪光  ${this.session.settings.strongFlashes ? '开启' : '关闭'}`,
      () => {
        this.session.settings.strongFlashes = !this.session.settings.strongFlashes;
        this.persistSettings();
      },
    );
    container.add(
      this.add
        .text(
          UI.centerX,
          SETTINGS.note.y,
          '关闭强闪光时保留轮廓预警，不使用全屏白闪。',
          proseTextStyle('#8da1c8', 'caption'),
        )
        .setOrigin(0.5),
    );
    this.menuButton(container, SETTINGS.back.y, '返回暂停菜单', () => this.openOverlay('pause'));
  }

  private renderMap(container: Phaser.GameObjects.Container): void {
    container.add(this.heading('探索地图'));
    // 关闭键挪到右上角：地图节点要占满面板中段，底部再放一排按钮就没地方给图例了。
    const close = this.add
      .text(OVERLAY.close.x, OVERLAY.close.y, '返回 · TAB', {
        ...hudTextStyle('#d8f7ff'),
        backgroundColor: '#25385c',
        padding: { x: BUTTON.paddingX, y: BUTTON.paddingY },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeOverlay());
    container.add(close);
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
        const start = mapPoint(ROOM_MAP_LAYOUT[room.id] ?? { x: 0, y: 0 });
        const end = mapPoint(ROOM_MAP_LAYOUT[exit.targetRoomId] ?? { x: 0, y: 0 });
        if (!ROOM_MAP_LAYOUT[room.id] || !ROOM_MAP_LAYOUT[exit.targetRoomId]) continue;
        const explored = visited.has(room.id) && visited.has(exit.targetRoomId);
        graphics.lineStyle(2, explored ? COLORS.cyan : COLORS.steel, explored ? 0.65 : 0.3);
        graphics.lineBetween(start.x, start.y, end.x, end.y);
      }
    }

    const markers = visibleMarkers(rooms, this.session);
    // 还没拿到的能力模块所在房间即使没探索过也要画出来：那是主线目标，
    // 藏起来只会让被能力门挡住的玩家不知道往哪走。
    const objectives = new Set(
      markers.filter((marker) => marker.kind === 'ability').map((marker) => marker.roomId),
    );

    const { halfWidth, halfHeight } = MAP.node;
    for (const room of rooms) {
      const raw = ROOM_MAP_LAYOUT[room.id];
      if (!raw) continue;
      const point = mapPoint(raw);
      const visibility = roomVisibility(room.id, visited, adjacency);
      if (visibility === 'hidden' && !objectives.has(room.id)) continue;
      if (visibility !== 'visited') {
        // 只画轮廓：玩家知道那边有个房间，但还不知道里面是什么。
        graphics
          .lineStyle(2, COLORS.steel, 0.55)
          .strokeRect(point.x - halfWidth, point.y - halfHeight, halfWidth * 2, halfHeight * 2);
        continue;
      }
      const current = room.id === this.session.currentRoomId;
      graphics.fillStyle(current ? COLORS.amber : COLORS.cyan, 1);
      graphics.fillRect(point.x - halfWidth, point.y - halfHeight, halfWidth * 2, halfHeight * 2);
      if (current) {
        const outline = MAP.currentNode;
        graphics
          .lineStyle(2, COLORS.pale, 1)
          .strokeRect(
            point.x - outline.halfWidth,
            point.y - outline.halfHeight,
            outline.halfWidth * 2,
            outline.halfHeight * 2,
          );
      }
    }

    // 节点标注是图元而不是文本：17 个房间挂满房名一定会撞版，而图例那一行才是解释它们的地方。
    for (const marker of markers) {
      const raw = ROOM_MAP_LAYOUT[marker.roomId];
      if (!raw) continue;
      const point = mapPoint(raw);
      if (marker.kind === 'terminal') {
        graphics.fillStyle(COLORS.pale, 0.95).fillRect(point.x - 2, point.y - 18, 4, 8);
      } else if (marker.kind === 'pickup') {
        graphics.fillStyle(COLORS.amber, 0.95).fillCircle(point.x + 16, point.y - 12, 4);
      } else if (marker.kind === 'ability') {
        // 摆在左上角：磁巢同时有终端和能力模块，两个标注不能叠在一起。
        graphics
          .fillStyle(COLORS.spore, 0.95)
          .fillTriangle(
            point.x - 16,
            point.y - 18,
            point.x - 22,
            point.y - 8,
            point.x - 10,
            point.y - 8,
          );
      } else {
        graphics.lineStyle(2, 0xed63d6, 0.9).strokeRect(point.x - 18, point.y + 10, 8, 6);
      }
    }

    container.add(graphics);
    const [vestibuleX, bioforgeX, reactorX] = MAP.regionLabels;
    container.add(
      this.add
        .text(vestibuleX.x, MAP.regionLabelY, '坠星前庭', hudTextStyle('#8ce7ff'))
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(bioforgeX.x, MAP.regionLabelY, '生化锻造区', hudTextStyle('#82d173'))
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(reactorX.x, MAP.regionLabelY, '零点反应堆', hudTextStyle('#ffb454'))
        .setOrigin(0.5),
    );
    const currentRoom = rooms.find((room) => room.id === this.session.currentRoomId);
    container.add(
      this.add
        .text(
          UI.centerX,
          MAP.current.y,
          `当前位置：${currentRoom?.name ?? '未知'}  ·  探索 ${visited.size}/${COMPLETION_TOTAL.rooms}`,
          hudTextStyle('#d8f7ff'),
        )
        .setOrigin(0.5),
    );
    this.renderMapLegend(container);
  }

  /** 原先是一行挤在一起的逗号串；现在每个图例都配上它实际画出来的那个图元。 */
  private renderMapLegend(container: Phaser.GameObjects.Container): void {
    const entries = [
      { label: '能力模块', color: COLORS.spore },
      { label: '同步终端', color: COLORS.pale },
      { label: '未取道具', color: COLORS.amber },
      { label: '能力门', color: 0xed63d6 },
    ] as const;
    const swatches = this.add.graphics();
    entries.forEach((entry, index) => {
      const x = MAP.legend.entryX[index] ?? 0;
      swatches
        .fillStyle(entry.color, 0.95)
        .fillRect(x, MAP.legend.y - MAP.legend.swatch / 2, MAP.legend.swatch, MAP.legend.swatch);
      container.add(
        this.add
          .text(
            x + MAP.legend.swatch + MAP.legend.labelGap,
            MAP.legend.y,
            entry.label,
            proseTextStyle('#8da1c8', 'caption'),
          )
          .setOrigin(0, 0.5),
      );
    });
    container.add(swatches);
  }

  private heading(label: string): Phaser.GameObjects.Text {
    return this.add.text(UI.centerX, OVERLAY.heading.y, label, headingTextStyle()).setOrigin(0.5);
  }

  private menuButton(
    container: Phaser.GameObjects.Container,
    y: number,
    label: string,
    action: () => void,
  ): void {
    const button = this.add
      .text(UI.centerX, y, label, {
        ...hudTextStyle('#d8f7ff'),
        backgroundColor: '#152445',
        padding: { x: BUTTON.paddingX, y: BUTTON.paddingY },
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
    this.setMode('help');
    this.renderedHelpDevice = undefined;
    this.syncHudVisibility();
    this.renderOverlay();
  }

  private closeHelp(): void {
    if (this.mode !== 'help') return;
    const returnMode = this.helpReturnMode;
    if (returnMode === 'game') {
      this.closeOverlay();
      return;
    }
    this.setMode(returnMode);
    this.syncHudVisibility();
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
