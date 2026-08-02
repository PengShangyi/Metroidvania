/** 画布 / UI 层尺寸。UI 场景的相机 zoom 为 1，所有 UI 坐标都是这套像素。 */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/**
 * 世界层仍在 480×270 逻辑坐标里运行：rooms.json 的全部坐标、MOVEMENT/DASH/WALL_JUMP
 * 与 world/reachability.ts 的跳跃包络都是按这套数值调出来的，改动等于重做关卡可达性。
 */
export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 270;

/**
 * 世界相机的放大倍数，必须是整数：Camera.preRender 里
 * `renderRoundPixels = roundPixels && Number.isInteger(zoomX) && Number.isInteger(zoomY)`，
 * 1.5 之类的倍率会静默关掉整像素吸附，像素画就开始抖。
 */
export const WORLD_ZOOM = GAME_WIDTH / WORLD_WIDTH;

export const COLORS = {
  void: 0x070b18,
  panel: 0x101a32,
  steel: 0x25385c,
  cyan: 0x43d8e8,
  pale: 0xd8f7ff,
  amber: 0xffb454,
  danger: 0xff5678,
  spore: 0x82d173,
} as const;

export const REGISTRY_KEYS = {
  session: 'star-echo.session',
  runtimeMessage: 'star-echo.runtime-message',
  roomLabel: 'star-echo.room-label',
  tutorialHud: 'star-echo.tutorial-hud',
  bossHealth: 'star-echo.boss-health',
  bossPhase: 'star-echo.boss-phase',
  uiMode: 'star-echo.ui-mode',
  inputDevice: 'star-echo.input-device',
  audio: 'star-echo.audio',
} as const;
