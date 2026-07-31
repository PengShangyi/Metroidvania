import type Phaser from 'phaser';

import { COLORS } from '../constants';

type Painter = (graphics: Phaser.GameObjects.Graphics) => void;

export function createProceduralTextures(scene: Phaser.Scene): void {
  createTexture(scene, 'pixel', 1, 1, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 1, 1));

  createTexture(scene, 'player', 24, 32, (g) => {
    g.fillStyle(COLORS.steel).fillRect(6, 7, 12, 20);
    g.fillStyle(COLORS.pale).fillRect(8, 3, 10, 8);
    g.fillStyle(COLORS.cyan).fillRect(11, 5, 8, 2);
    g.fillStyle(COLORS.amber).fillRect(18, 14, 5, 4);
    g.fillStyle(COLORS.steel).fillRect(6, 27, 4, 5).fillRect(14, 27, 4, 5);
  });

  createTexture(scene, 'tile', 16, 16, (g) => {
    g.fillStyle(COLORS.steel).fillRect(0, 0, 16, 16);
    g.fillStyle(0x334b76).fillRect(1, 1, 14, 3);
    g.fillStyle(0x111b35).fillRect(2, 8, 12, 6);
    g.fillStyle(COLORS.cyan, 0.4).fillRect(2, 5, 1, 1).fillRect(12, 5, 1, 1);
  });

  createTexture(scene, 'hazard', 16, 16, (g) => {
    g.fillStyle(COLORS.danger);
    for (let x = 0; x < 16; x += 4) g.fillTriangle(x, 16, x + 2, 4, x + 4, 16);
  });

  createTexture(scene, 'projectile', 8, 4, (g) => {
    g.fillStyle(COLORS.pale).fillRect(0, 1, 8, 2);
    g.fillStyle(COLORS.cyan).fillRect(2, 0, 4, 4);
  });

  createTexture(scene, 'crawler', 24, 16, (g) => {
    g.fillStyle(0x1b2f51).fillTriangle(0, 14, 12, 2, 24, 14);
    g.fillStyle(COLORS.amber).fillRect(7, 10, 10, 2);
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
