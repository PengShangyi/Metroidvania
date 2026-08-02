import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { HelpScene } from './scenes/HelpScene';
import { HudScene } from './scenes/HudScene';
import { PlayScene } from './scenes/PlayScene';
import { TitleScene } from './scenes/TitleScene';
import { TutorialHudScene } from './scenes/TutorialHudScene';
import { TutorialScene } from './scenes/TutorialScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'app',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#070b18',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 900 },
        fps: 60,
        fixedStep: true,
        debug: false,
      },
    },
    input: {
      gamepad: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
    // 顺序即渲染层级：UI 场景要压在各自的世界场景之上，HelpScene 再压在所有 UI 之上。
    scene: [
      BootScene,
      TitleScene,
      TutorialScene,
      TutorialHudScene,
      PlayScene,
      HudScene,
      HelpScene,
      EndingScene,
    ],
  };
}
