import Phaser from 'phaser';

import { createGameConfig } from './game/config';
import './style.css';

const game = new Phaser.Game(createGameConfig());

window.addEventListener('beforeunload', () => game.destroy(true));
