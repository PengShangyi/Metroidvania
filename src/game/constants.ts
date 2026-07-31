export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const TILE_SIZE = 16;

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
  bossHealth: 'star-echo.boss-health',
  bossPhase: 'star-echo.boss-phase',
  uiMode: 'star-echo.ui-mode',
} as const;
