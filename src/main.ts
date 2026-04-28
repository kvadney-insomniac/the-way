import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CapernaumScene } from './scenes/act1/CapernaumScene';
import { CanaScene } from './scenes/act1/CanaScene';
import { SynagogueScene } from './scenes/act1/SynagogueScene';
import { MountainScene } from './scenes/act2/MountainScene';
import { SeaScene } from './scenes/act2/SeaScene';
import { JerusalemScene } from './scenes/act3/JerusalemScene';
import { TempleScene } from './scenes/act3/TempleScene';
import { NicodemusScene } from './scenes/act3/NicodemusScene';
import { UpperRoomScene } from './scenes/act3/UpperRoomScene';
import { GethsemaneScene } from './scenes/act4/GethsemaneScene';
import { PassionScene } from './scenes/act4/PassionScene';
import { TombScene } from './scenes/act5/TombScene';
import { EmmausScene } from './scenes/act5/EmmausScene';
import { RestorationScene } from './scenes/act5/RestorationScene';
import { ScrollRoomScene } from './scenes/ScrollRoomScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  pixelArt: true,
  backgroundColor: '#0d0a07',
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 320,
    height: 180,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [
    BootScene, TitleScene,
    // Act I
    CapernaumScene, CanaScene, SynagogueScene,
    // Act II
    MountainScene, SeaScene,
    // Act III
    JerusalemScene, TempleScene, NicodemusScene, UpperRoomScene,
    // Act IV
    GethsemaneScene, PassionScene,
    // Act V
    TombScene, EmmausScene, RestorationScene,
    // Overlay
    ScrollRoomScene,
  ],
};

const game = new Phaser.Game(config);

// Expose for dev-console debugging
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game__ = game;
}
