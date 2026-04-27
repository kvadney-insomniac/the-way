import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CapernaumScene } from './scenes/act1/CapernaumScene';
import { ScrollRoomScene } from './scenes/ScrollRoomScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 320,
  height: 180,
  zoom: 3,
  pixelArt: true,
  backgroundColor: '#0d0a07',
  parent: document.body,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, TitleScene, CapernaumScene, ScrollRoomScene],
};

const game = new Phaser.Game(config);

// Expose for dev-console debugging
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game__ = game;
}
