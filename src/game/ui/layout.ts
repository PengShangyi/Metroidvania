/**
 * UI 层（960×540，相机 zoom 1）的具名锚点。
 *
 * 世界层仍是 480×270 逻辑坐标、由相机 zoom 2 放大，两套坐标系不要混用：
 * 这里的每个数字都是 UI 像素，世界坐标请用 constants.ts 的 WORLD_WIDTH/WORLD_HEIGHT。
 */

export const UI = {
  width: 960,
  height: 540,
  centerX: 480,
  centerY: 270,
  safe: 24,
} as const;

/**
 * Text 包围盒的保守估高。Phaser 按实际字形度量，这里只用于 layout.test.ts 的间距校验，
 * 所以每项都比真实高度略大——宁可测试偏严，也不要放过一个会重叠的锚点。
 */
export const LINE_BOX = {
  hud: 36,
  heading: 54,
  title: 68,
  prose: 34,
  caption: 28,
  lead: 42,
} as const;

export const BUTTON = {
  paddingX: 20,
  paddingY: 10,
  height: LINE_BOX.hud + 10 * 2,
} as const;

/** 帮助面板的按键胶囊比普通按钮矮，靠 fixedWidth 对齐而不是靠内边距。 */
export const CHIP = {
  paddingX: 10,
  paddingY: 4,
  width: 160,
  height: LINE_BOX.hud + 4 * 2,
} as const;

export const HUD = {
  healthIcon: { x: 24, y: 20 },
  healthText: { x: 66, y: 18 },
  abilityIcon: { firstX: 40, y: 92, gap: 40 },
  exploration: { x: 932, y: 18 },
  keyHint: { x: 932, y: 60 },
  /** Boss 血条放在右上状态栏下方：15 格菱形在 24px 下有 500px 宽，顶在中间会撞上探索度。 */
  bossBar: { x: 480, y: 110 },
  /** 底部对齐，让多行提示向上生长，永远不会压到房名。 */
  toast: { x: 480, bottom: 470, wrap: 800 },
  roomLabel: { x: 24, y: 516 },
} as const;

export const OVERLAY = {
  panel: { width: 888, height: 492 },
  heading: { y: 70 },
  close: { x: 900, y: 58 },
} as const;

export const PAUSE = {
  rows: [166, 238, 310, 382, 470],
} as const;

export const SETTINGS = {
  rows: [166, 238, 310],
  note: { y: 370 },
  back: { y: 430 },
} as const;

export const MAP = {
  /** ROOM_MAP_LAYOUT 仍以 480×270 授权，这里做仿射变换，mapLayout.test.ts 因此无需改动。 */
  scale: 2,
  offsetX: -22,
  offsetY: 40,
  node: { halfWidth: 12, halfHeight: 8 },
  /** 当前房间多描一圈外框，节点的实际占位比 node 大一圈。 */
  currentNode: { halfWidth: 16, halfHeight: 12 },
  regionLabels: [
    { x: 96, key: 'vestibule' },
    { x: 518, key: 'bioforge' },
    { x: 782, key: 'reactor' },
  ],
  regionLabelY: 130,
  current: { y: 430 },
  legend: { y: 484, entryX: [180, 440, 700], swatch: 16, labelGap: 10 },
} as const;

export const HELP = {
  subtitle: { y: 120 },
  groupTitle: { y: 170 },
  columnX: [44, 492],
  firstRowY: 204,
  rowGap: 56,
  /** 胶囊宽 160 + 16 间隙；剩下的宽度给动作说明换行。 */
  descriptionOffsetX: CHIP.width + 16,
  descriptionWrap: 224,
  footer: { y: 494 },
} as const;

export const TITLE = {
  heading: { y: 60 },
  version: { y: 124 },
  menuRows: [184, 252, 320, 388],
  saveStatus: { y: 442 },
  keyHint: { y: 490 },
  band: { y: 104, height: 208 },
  /** 立绘按 186×384 原生尺寸绘制：原先 setDisplaySize(111,229) 是 0.597 倍分数重采样。 */
  portrait: { x: 830, y: 536 },
  grid: { firstX: 48, step: 96, width: 4 },
  rings: { x: 480, y: 268, radii: [188, 236], fillRadius: 144 },
} as const;

export const ENDING = {
  heading: { y: 100 },
  prose: { y: 160, wrap: 640 },
  stats: { y: 252 },
  keyHint: { y: 450 },
} as const;

export const TUTORIAL_HUD = {
  band: { y: 86, width: 936, height: 156 },
  progress: { x: 28, y: 16 },
  title: { x: 480, y: 16 },
  keyHint: { x: 932, y: 16 },
  objective: { x: 480, y: 60, wrap: 860 },
  effect: { x: 480, y: 132, wrap: 860 },
  panel: { width: 720, height: 320 },
  panelHeading: { y: 168 },
  panelBody: { y: 222, wrap: 620 },
  panelButton: { y: 354 },
} as const;

export const BOOT = {
  loading: { x: UI.centerX, y: UI.centerY },
} as const;

export interface LayoutBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 面板按 UI 中心摆放，这里给出它的四边，供绘制与测试共用同一份算术。 */
export function panelBox(size: { width: number; height: number }): LayoutBox {
  return {
    left: UI.centerX - size.width / 2,
    right: UI.centerX + size.width / 2,
    top: UI.centerY - size.height / 2,
    bottom: UI.centerY + size.height / 2,
  };
}

/** 把 480×270 授权的地图坐标搬到 UI 空间。 */
export function mapPoint(point: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x * MAP.scale + MAP.offsetX, y: point.y * MAP.scale + MAP.offsetY };
}
