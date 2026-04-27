import Phaser from 'phaser';
import { loadSave } from '../systems/SaveSystem';
import { fadeIn, fadeToScene } from '../utils/pixelTransition';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    fadeIn(this, 1200);
    this.drawBackground();
    this.drawTitle();
    this.drawMenu();
    this.drawVerse();
  }

  private drawBackground() {
    const { width, height } = this.scale;

    // Night sky gradient (pixel-style horizontal bands)
    const colors = [0x0d0a07, 0x110e0a, 0x16120d, 0x1a1610, 0x2a1f12, 0x3d2b18];
    colors.forEach((c, i) => {
      const g = this.add.graphics();
      const bandH = Math.ceil(height / colors.length);
      g.fillStyle(c);
      g.fillRect(0, i * bandH, width, bandH + 1);
    });

    // Stars
    const starGraphics = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height * 0.6);
      const brightness = Phaser.Math.FloatBetween(0.3, 1.0);
      starGraphics.fillStyle(0xfff8e8, brightness);
      starGraphics.fillRect(x, y, 1, 1);
    }

    // Horizon glow (pre-dawn)
    const horizonGlow = this.add.graphics();
    horizonGlow.fillGradientStyle(0x3d2b18, 0x3d2b18, 0xc47a2a, 0xc47a2a, 0.0, 0.0, 0.3, 0.3);
    horizonGlow.fillRect(0, height * 0.55, width, height * 0.45);

    // Silhouette: hills and a lone olive tree
    const silhouette = this.add.graphics();
    silhouette.fillStyle(0x0a0704);
    // Left hill
    silhouette.fillTriangle(0, height, 80, height * 0.72, 160, height);
    // Right hill
    silhouette.fillTriangle(160, height, 280, height * 0.68, 320, height);
    // Olive tree silhouette (right side)
    silhouette.fillRect(260, Math.floor(height * 0.72), 2, 20);
    silhouette.fillEllipse(261, Math.floor(height * 0.72), 14, 10);

    // Distant city lights (Jerusalem)
    const cityG = this.add.graphics();
    for (let i = 0; i < 12; i++) {
      cityG.fillStyle(0xf5c842, Phaser.Math.FloatBetween(0.3, 0.7));
      cityG.fillRect(Phaser.Math.Between(20, 160), Phaser.Math.Between(Math.floor(height * 0.73), Math.floor(height * 0.77)), 1, 1);
    }
  }

  private drawTitle() {
    const { width } = this.scale;

    // Drop shadow
    this.add.text(width / 2 + 1, 32, 'THE WAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#3a2510',
      resolution: 4,
    }).setOrigin(0.5).setAlpha(0.6);

    // Main title
    this.add.text(width / 2, 31, 'THE WAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#c9a84c',
      resolution: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 50, '"I am the way, the truth, and the life."', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#a08040',
      resolution: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, 58, '— John 14:6', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#6a5030',
      resolution: 4,
    }).setOrigin(0.5);
  }

  private drawMenu() {
    const { width } = this.scale;
    const save = loadSave();
    const isNewGame = save.faithLevel === 1 && save.totalXP === 0;

    const menuItems = isNewGame
      ? [{ label: '▶  BEGIN YOUR JOURNEY', key: 'new' }]
      : [
          { label: '▶  CONTINUE', key: 'continue' },
          { label: '   BEGIN AGAIN', key: 'new' },
        ];

    menuItems.forEach((item, i) => {
      const y = 90 + i * 16;
      const t = this.add.text(width / 2, y, item.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px',
        color: i === 0 ? '#f5deb3' : '#6a5a4a',
        resolution: 4,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      t.on('pointerover', () => t.setColor('#c9a84c'));
      t.on('pointerout',  () => t.setColor(i === 0 ? '#f5deb3' : '#6a5a4a'));
      t.on('pointerdown', () => this.startGame());
    });

    // SPACE to start
    this.input.keyboard!.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard!.on('keydown-ENTER', () => this.startGame());

    // Blink "press space" prompt
    const pressSpace = this.add.text(width / 2, 140, 'PRESS SPACE TO BEGIN', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#6a5a40',
      resolution: 4,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: pressSpace,
      alpha: 0,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawVerse() {
    // Day/LOVE display if returning player
    const save = loadSave();
    if (save.totalXP > 0) {
      this.add.text(4, 4, `DAY ${save.faithLevel}  LOVE ${save.love}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '4px',
        color: '#6a5030',
        resolution: 4,
      });
    }
  }

  private startGame() {
    fadeToScene(this, 'CapernaumScene');
  }
}
