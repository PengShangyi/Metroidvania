import type Phaser from 'phaser';

import { COLORS } from '../constants';

type Painter = (graphics: Phaser.GameObjects.Graphics) => void;
type FramePainter = (graphics: Phaser.GameObjects.Graphics, frame: number) => void;

export function createProceduralTextures(scene: Phaser.Scene): void {
  createTexture(scene, 'pixel', 1, 1, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 1, 1));

  // 主角图集与 HUD 图标是首屏唯二没有兜底的真素材：一旦 404，generateFrameNumbers
  // 会返回空数组，9 个 iya-* 动画全部建不起来，主角和血量/能力图标就变成 Phaser 的
  // 绿色缺图块。这两张按真图的帧数与尺寸补上，key 相同，真图先到就自动让位。
  createFrameTexture(scene, 'iya-atlas', 24, 32, 19, paintFallbackPlayer);
  createFrameTexture(scene, 'base-icons', 16, 16, 5, paintFallbackIcon);

  createTexture(scene, 'hazard', 16, 16, (g) => {
    g.fillStyle(COLORS.danger);
    for (let x = 0; x < 16; x += 4) g.fillTriangle(x, 16, x + 2, 4, x + 4, 16);
  });

  createTexture(scene, 'hazard-acid', 16, 16, (g) => {
    g.fillStyle(0x102c2a).fillRect(0, 5, 16, 11);
    g.fillStyle(0x7adf8a).fillRect(0, 5, 16, 3);
    g.fillStyle(0xd8f7aa, 0.8).fillCircle(4, 4, 2).fillCircle(12, 6, 1);
    g.fillStyle(0xed63d6, 0.45).fillRect(2, 10, 4, 2).fillRect(10, 13, 3, 1);
  });

  createTexture(scene, 'hazard-reactor', 16, 16, (g) => {
    g.fillStyle(0x07101d).fillRect(0, 0, 16, 16);
    g.fillStyle(COLORS.cyan, 0.38).fillRect(0, 6, 16, 6);
    g.lineStyle(2, COLORS.pale, 0.9);
    g.beginPath().moveTo(0, 10).lineTo(5, 4).lineTo(10, 12).lineTo(16, 6).strokePath();
  });

  createTexture(scene, 'projectile', 8, 4, (g) => {
    g.fillStyle(COLORS.pale).fillRect(0, 1, 8, 2);
    g.fillStyle(COLORS.cyan).fillRect(2, 0, 4, 4);
  });

  createTexture(scene, 'projectile-piercing', 14, 5, (g) => {
    g.fillStyle(COLORS.cyan).fillRect(0, 1, 14, 3);
    g.fillStyle(COLORS.pale).fillRect(2, 2, 10, 1);
    g.fillStyle(COLORS.amber).fillRect(5, 0, 4, 5);
  });

  createTexture(scene, 'slash', 28, 24, (g) => {
    g.lineStyle(4, COLORS.pale, 0.9);
    g.beginPath().arc(4, 20, 18, -1.35, 0.05).strokePath();
    g.lineStyle(2, COLORS.cyan, 0.75);
    g.beginPath().arc(4, 20, 13, -1.35, 0.05).strokePath();
  });

  createTexture(scene, 'crawler', 24, 16, (g) => {
    g.fillStyle(0x1b2f51).fillTriangle(0, 14, 12, 2, 24, 14);
    g.fillStyle(COLORS.amber).fillRect(7, 10, 10, 2);
  });

  createTexture(scene, 'crawler-shielded', 24, 16, (g) => {
    g.fillStyle(0x1b2f51).fillTriangle(0, 14, 12, 2, 24, 14);
    g.fillStyle(COLORS.steel).fillRect(14, 4, 8, 10);
    g.fillStyle(COLORS.pale).fillRect(20, 5, 2, 8);
    g.fillStyle(COLORS.cyan).fillRect(15, 7, 5, 3);
  });

  createTexture(scene, 'crawler-exposed', 24, 16, (g) => {
    g.fillStyle(0x1b2f51).fillTriangle(0, 14, 12, 2, 24, 14);
    g.fillStyle(0x334b76).fillRect(5, 7, 9, 6);
    g.fillStyle(COLORS.amber).fillCircle(19, 9, 4);
    g.fillStyle(COLORS.pale).fillCircle(19, 9, 2);
  });

  createTexture(scene, 'sentry', 20, 20, (g) => {
    g.fillStyle(0x263e67).fillTriangle(10, 0, 20, 10, 10, 20).fillTriangle(10, 0, 0, 10, 10, 20);
    g.fillStyle(COLORS.cyan).fillCircle(10, 10, 3);
  });

  createTexture(scene, 'turret', 24, 24, (g) => {
    g.fillStyle(0x263e67).fillRect(2, 8, 20, 15);
    g.fillStyle(COLORS.danger).fillRect(10, 5, 12, 4);
    g.fillStyle(0x111b35).fillRect(6, 12, 12, 8);
  });

  createTexture(scene, 'spore', 22, 22, (g) => {
    g.fillStyle(0x345d53).fillCircle(11, 12, 10);
    g.fillStyle(0xed63d6).fillCircle(8, 8, 3).fillCircle(15, 11, 2);
  });

  createTexture(scene, 'terminal', 20, 32, (g) => {
    g.fillStyle(0x263e67).fillRect(2, 2, 16, 30);
    g.fillStyle(COLORS.cyan).fillRect(5, 5, 10, 8);
    g.fillStyle(0x07101d).fillRect(7, 7, 6, 4);
    g.fillStyle(COLORS.amber).fillRect(8, 18, 4, 2);
  });

  createTexture(scene, 'ability-dash', 18, 18, (g) => {
    g.fillStyle(COLORS.cyan, 0.32).fillCircle(9, 9, 9);
    g.fillStyle(COLORS.pale).fillTriangle(3, 9, 13, 3, 10, 8).fillTriangle(15, 9, 5, 15, 8, 10);
  });

  createTexture(scene, 'ability-grip', 18, 18, (g) => {
    g.fillStyle(0xed63d6, 0.32).fillCircle(9, 9, 9);
    g.lineStyle(3, COLORS.pale).strokeCircle(9, 9, 5);
    g.fillStyle(COLORS.pale).fillRect(7, 1, 4, 5).fillRect(7, 12, 4, 5);
  });

  createTexture(scene, 'health-cell', 16, 16, (g) => {
    g.fillStyle(COLORS.danger, 0.28).fillCircle(8, 8, 8);
    g.fillStyle(COLORS.pale).fillRect(6, 2, 4, 12).fillRect(2, 6, 12, 4);
  });

  createTexture(scene, 'boss', 72, 72, (g) => {
    g.lineStyle(10, 0x263e67).strokeCircle(36, 36, 27);
    g.fillStyle(COLORS.cyan, 0.3).fillCircle(36, 36, 15);
    g.fillStyle(COLORS.pale).fillCircle(36, 36, 7);
    g.fillStyle(COLORS.danger).fillRect(33, 0, 6, 12).fillRect(33, 60, 6, 12);
  });
}

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: Painter,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  paint(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

/**
 * 横向排布的多帧贴图。手工补的编号帧和 load.spritesheet 走的是同一套
 * Texture.add，所以 generateFrameNumbers 解析出来的帧号完全一致。
 */
function createFrameTexture(
  scene: Phaser.Scene,
  key: string,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  paint: FramePainter,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let frame = 0; frame < frameCount; frame += 1) paint(graphics, frame);
  graphics.generateTexture(key, frameWidth * frameCount, frameHeight);
  graphics.destroy();
  const texture = scene.textures.get(key);
  for (let frame = 0; frame < frameCount; frame += 1) {
    texture.add(frame, 0, frame * frameWidth, 0, frameWidth, frameHeight);
  }
}

type FallbackPose = {
  /** 正数下沉、负数上抬，与 scripts/generate-sprite-atlas.mjs 的 bob 同号。 */
  bob?: number;
  legShift?: number;
  body?: number;
  accent?: number;
  alpha?: number;
  muzzle?: boolean;
  trail?: boolean;
};

// 帧表对齐 playerAnimations.ts：idle 0-1 / run 2-5 / jump 6 / fall 7 / shoot 8-9 /
// slash 10-12 / dash 13 / hurt 14 / death 15-18。
const FALLBACK_PLAYER_POSES: readonly FallbackPose[] = [
  {},
  { bob: -1 },
  { legShift: 2 },
  { bob: -1 },
  { legShift: -2 },
  { bob: -1 },
  { bob: -2, legShift: 1 },
  { bob: 1, legShift: -1 },
  { muzzle: true },
  { bob: -1, muzzle: true },
  { bob: -1, legShift: -1 },
  { legShift: 1 },
  { bob: 1, legShift: 2 },
  { legShift: 2, body: COLORS.cyan, trail: true },
  { bob: -1, body: COLORS.danger, accent: COLORS.pale },
  { bob: -1, accent: COLORS.pale },
  { bob: 1, body: COLORS.cyan, alpha: 0.8 },
  { bob: 2, body: COLORS.cyan, alpha: 0.55 },
  { bob: 3, body: COLORS.cyan, alpha: 0.3 },
];

/** 朝右——docs/ART_BIBLE.md 约定只画朝右帧，朝左由 Player.setFlipX 镜像。 */
function paintFallbackPlayer(graphics: Phaser.GameObjects.Graphics, frame: number): void {
  const pose = FALLBACK_PLAYER_POSES[frame] ?? {};
  const ox = frame * 24;
  const oy = pose.bob ?? 0;
  const legShift = pose.legShift ?? 0;
  const body = pose.body ?? COLORS.steel;
  const accent = pose.accent ?? COLORS.amber;
  const alpha = pose.alpha ?? 1;

  if (pose.trail) graphics.fillStyle(COLORS.cyan, 0.3 * alpha).fillRect(ox + 1, oy + 7, 12, 25);
  graphics.fillStyle(body, alpha).fillRect(ox + 6, oy + 7, 12, 20);
  graphics.fillStyle(COLORS.pale, alpha).fillRect(ox + 8, oy + 3, 10, 8);
  graphics.fillStyle(COLORS.cyan, alpha).fillRect(ox + 11, oy + 5, 8, 2);
  graphics.fillStyle(accent, alpha).fillRect(ox + 18, oy + 14, 5, 4);
  graphics
    .fillStyle(body, alpha)
    .fillRect(ox + 6 + legShift, oy + 27, 4, 5)
    .fillRect(ox + 14 - legShift, oy + 27, 4, 5);
  if (pose.muzzle) graphics.fillStyle(COLORS.cyan, alpha).fillRect(ox + 19, oy + 15, 4, 2);
}

// 形状照抄 scripts/generate-sprite-atlas.mjs 的 iconRect 段：兜底图要和真图同一个
// 剪影，HUD 的图标位置才不会在回退时错位。
function paintFallbackIcon(graphics: Phaser.GameObjects.Graphics, frame: number): void {
  const ox = frame * 16;
  switch (frame) {
    case 0:
      graphics
        .fillStyle(COLORS.pale)
        .fillRect(ox + 6, 2, 4, 12)
        .fillRect(ox + 2, 6, 12, 4);
      graphics
        .fillStyle(COLORS.danger)
        .fillRect(ox + 7, 3, 2, 10)
        .fillRect(ox + 3, 7, 10, 2);
      return;
    case 1:
      graphics.fillStyle(COLORS.cyan);
      for (let x = 2; x < 14; x += 1) {
        graphics.fillRect(ox + x, Math.round(8 - Math.abs(8 - x) / 2), 1, 1);
      }
      graphics.fillStyle(COLORS.pale).fillRect(ox + 6, 6, 7, 3);
      return;
    case 2:
      graphics
        .fillStyle(COLORS.pale)
        .fillRect(ox + 3, 2, 3, 12)
        .fillRect(ox + 10, 2, 3, 12);
      graphics.fillStyle(COLORS.cyan).fillRect(ox + 6, 5, 4, 6);
      return;
    case 3:
      graphics.fillStyle(COLORS.steel).fillRect(ox + 2, 3, 12, 10);
      graphics.fillStyle(COLORS.cyan).fillRect(ox + 4, 5, 4, 3);
      graphics.fillStyle(COLORS.amber).fillRect(ox + 9, 9, 3, 3);
      return;
    default:
      graphics.fillStyle(COLORS.steel).fillRect(ox + 3, 1, 10, 14);
      graphics.fillStyle(COLORS.cyan).fillRect(ox + 5, 4, 6, 5);
      graphics.fillStyle(COLORS.amber).fillRect(ox + 7, 11, 2, 2);
  }
}
