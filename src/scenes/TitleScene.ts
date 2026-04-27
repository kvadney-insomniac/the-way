import Phaser from 'phaser';
import { loadSave } from '../systems/SaveSystem';
import { fadeIn, fadeToScene } from '../utils/pixelTransition';
import { globalAudio } from '../systems/AudioSystem';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    fadeIn(this, 1200);
    this.drawBackground();
    this.drawTitle();
    this.drawMenu();
    this.drawSaveInfo();
    globalAudio.play('title', 2000);
  }

  private drawBackground() {
    const { width, height } = this.scale;

    const colors = [0x0d0a07, 0x110e0a, 0x16120d, 0x1a1610, 0x2a1f12, 0x3d2b18];
    colors.forEach((c, i) => {
      const g = this.add.graphics();
      const bandH = Math.ceil(height / colors.length);
      g.fillStyle(c);
      g.fillRect(0, i * bandH, width, bandH + 1);
    });

    const starGraphics = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height * 0.6);
      starGraphics.fillStyle(0xfff8e8, Phaser.Math.FloatBetween(0.3, 1.0));
      starGraphics.fillRect(x, y, 1, 1);
    }

    const horizonGlow = this.add.graphics();
    horizonGlow.fillGradientStyle(0x3d2b18, 0x3d2b18, 0xc47a2a, 0xc47a2a, 0.0, 0.0, 0.3, 0.3);
    horizonGlow.fillRect(0, height * 0.55, width, height * 0.45);

    const silhouette = this.add.graphics();
    silhouette.fillStyle(0x0a0704);
    silhouette.fillTriangle(0, height, 80, height * 0.72, 160, height);
    silhouette.fillTriangle(160, height, 280, height * 0.68, 320, height);
    silhouette.fillRect(260, Math.floor(height * 0.72), 2, 20);
    silhouette.fillEllipse(261, Math.floor(height * 0.72), 14, 10);

    const cityG = this.add.graphics();
    for (let i = 0; i < 12; i++) {
      cityG.fillStyle(0xf5c842, Phaser.Math.FloatBetween(0.3, 0.7));
      cityG.fillRect(
        Phaser.Math.Between(20, 160),
        Phaser.Math.Between(Math.floor(height * 0.73), Math.floor(height * 0.77)),
        1, 1,
      );
    }
  }

  private drawTitle() {
    const { width } = this.scale;

    // Drop shadow
    this.add.text(width / 2 + 1, 23, 'THE WAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#1a0e05',
      resolution: 3,
    }).setOrigin(0.5).setAlpha(0.7);

    // Main title
    this.add.text(width / 2, 22, 'THE WAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#c9a84c',
      resolution: 3,
    }).setOrigin(0.5);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0xc9a84c, 0.5);
    div.lineBetween(width / 2 - 70, 38, width / 2 + 70, 38);

    // Scripture — use a readable serif size
    this.add.text(width / 2, 52, '"I am the way,\nthe truth, and the life."', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '13px',
      color: '#f0dba0',
      align: 'center',
      lineSpacing: 4,
      resolution: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, 73, '— John 14:6', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      fontSize: '11px',
      color: '#c9a84c',
      resolution: 3,
    }).setOrigin(0.5);
  }

  private drawMenu() {
    const { width } = this.scale;
    const save = loadSave();
    const isNewGame = save.faithLevel === 1 && save.totalXP === 0;

    const menuItems = isNewGame
      ? [{ label: '> BEGIN YOUR JOURNEY', key: 'new' }]
      : [
          { label: '> CONTINUE', key: 'continue' },
          { label: '  BEGIN AGAIN', key: 'new' },
        ];

    menuItems.forEach((item, i) => {
      const y = 90 + i * 18;
      const t = this.add.text(width / 2, y, item.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: i === 0 ? '#f5deb3' : '#6a5a4a',
        resolution: 3,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      t.on('pointerover', () => t.setColor('#c9a84c'));
      t.on('pointerout',  () => t.setColor(i === 0 ? '#f5deb3' : '#6a5a4a'));
      t.on('pointerdown', () => this.startGame());
    });

    this.input.keyboard!.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard!.on('keydown-ENTER', () => this.startGame());

    const prompt = this.add.text(width / 2, 153, 'PRESS SPACE TO BEGIN', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#c9a84c',
      resolution: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawSaveInfo() {
    const save = loadSave();
    if (save.totalXP === 0) return;
    this.add.text(6, 4, `DAY ${save.faithLevel}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#c9a84c',
      resolution: 3,
    });
    this.add.text(6, 14, `LOVE ${save.love}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#88cc88',
      resolution: 3,
    });
  }

  private startGame() {
    globalAudio.stop(400);
    fadeToScene(this, 'CapernaumScene');
  }
}
