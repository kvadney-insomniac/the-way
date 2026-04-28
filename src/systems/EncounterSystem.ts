import Phaser from 'phaser';
import { SaveData } from './SaveSystem';

export type EncounterAction = 'listen' | 'serve' | 'pray' | 'pass';

export interface EncounterOption {
  action: EncounterAction;
  label: string;
  description: string;
}

export interface EncounterConfig {
  npcName: string;
  situation: string;
  npcTextureKey?: string;       // texture to show as portrait (defaults to npcName)
  options?: EncounterOption[];
  onChoice: (action: EncounterAction, save: SaveData) => void;
}

const DEFAULT_OPTIONS: EncounterOption[] = [
  { action: 'listen', label: 'LISTEN',  description: 'Hear their story' },
  { action: 'serve',  label: 'SERVE',   description: 'Act on their need' },
  { action: 'pray',   label: 'PRAY',    description: 'Intercede for them' },
  { action: 'pass',   label: 'PASS BY', description: 'Continue on your way' },
];

// Full-screen layout constants (320×180 viewport)
const W = 320;
const H = 180;

// Palette
const COLOR_LISTEN  = '#4a9eff';
const COLOR_SERVE   = '#5ecb6b';
const COLOR_PRAY    = '#f5deb3';
const COLOR_PASS    = '#888888';
const COLOR_CURSOR  = '#f0c840';

const ACTION_COLORS: Record<EncounterAction, string> = {
  listen: COLOR_LISTEN,
  serve:  COLOR_SERVE,
  pray:   COLOR_PRAY,
  pass:   COLOR_PASS,
};

// Layout regions
const PORTRAIT_X    = 56;          // center of portrait region
const PORTRAIT_Y    = 66;
const PORTRAIT_SIZE = 48;          // 3× scale of 16px sprite
const SIT_X         = 120;         // situation text left edge
const SIT_Y         = 16;
const SIT_W         = 192;
const OPTIONS_Y     = 118;         // bottom action menu Y
const OPTION_SPACING = 72;         // px between each option (4 options across 288px)
const DESC_Y         = 158;

export class EncounterSystem {
  private scene: Phaser.Scene;

  // Full-screen overlay objects
  private overlay!: Phaser.GameObjects.Graphics;
  private portraitBg!: Phaser.GameObjects.Graphics;
  private portrait!: Phaser.GameObjects.Image;
  private npcNameText!: Phaser.GameObjects.Text;
  private situationText!: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private optionBoxes: Phaser.GameObjects.Graphics[] = [];
  private cursorText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private divider!: Phaser.GameObjects.Graphics;
  private bgPattern!: Phaser.GameObjects.Graphics;

  // State
  private options: EncounterOption[] = [];
  private selectedIndex = 0;
  private active = false;
  private onChoice?: (action: EncounterAction, save: SaveData) => void;
  private save?: SaveData;
  private npcKey = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI() {
    const d = 300; // depth — above everything

    // === Animated background pattern (EarthBound-style checker) ===
    this.bgPattern = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(d).setVisible(false);

    // === Dark overlay ===
    this.overlay = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(d + 1).setVisible(false);

    // === Portrait box (left side) ===
    this.portraitBg = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(d + 2).setVisible(false);

    // === Portrait sprite ===
    this.portrait = this.scene.add.image(PORTRAIT_X, PORTRAIT_Y, '__DEFAULT')
      .setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE)
      .setScrollFactor(0).setDepth(d + 3).setVisible(false);

    // === NPC name above portrait ===
    this.npcNameText = this.scene.add.text(PORTRAIT_X, 12, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#f0c840', resolution: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d + 3).setVisible(false);

    // === Situation text (right of portrait) ===
    this.situationText = this.scene.add.text(SIT_X, SIT_Y, '', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '9px', color: '#f0ead0',
      wordWrap: { width: SIT_W },
      lineSpacing: 3, resolution: 3,
    }).setScrollFactor(0).setDepth(d + 3).setVisible(false);

    // === Divider line between portrait region and action menu ===
    this.divider = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(d + 2).setVisible(false);

    // === Description text (bottom bar) ===
    this.descText = this.scene.add.text(W / 2, DESC_Y, '', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '8px', fontStyle: 'italic',
      color: '#9a8878', resolution: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d + 3).setVisible(false);

    // === Soul cursor (✦) ===
    this.cursorText = this.scene.add.text(0, 0, '✦', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: COLOR_CURSOR, resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 5).setVisible(false);
  }

  private drawBackground() {
    // Parchment/stone tile checker — EarthBound-style background break
    this.bgPattern.clear();
    const tileSize = 10;
    for (let row = 0; row < Math.ceil(H / tileSize); row++) {
      for (let col = 0; col < Math.ceil(W / tileSize); col++) {
        const even = (row + col) % 2 === 0;
        this.bgPattern.fillStyle(even ? 0x0d0a07 : 0x130e09, 1);
        this.bgPattern.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
      }
    }

    // Main overlay — semi-transparent over the checker
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0806, 0.88);
    this.overlay.fillRect(0, 0, W, H);

    // Gold border frame
    this.overlay.lineStyle(2, 0xc9a84c, 1);
    this.overlay.strokeRect(4, 4, W - 8, H - 8);
    this.overlay.lineStyle(1, 0x7a5c2a, 0.6);
    this.overlay.strokeRect(7, 7, W - 14, H - 14);

    // Portrait box
    this.portraitBg.clear();
    this.portraitBg.fillStyle(0x000000, 0.5);
    this.portraitBg.fillRect(12, 12, PORTRAIT_SIZE + 12, PORTRAIT_SIZE + 12);
    this.portraitBg.fillStyle(0x1a120a, 0.95);
    this.portraitBg.fillRect(10, 10, PORTRAIT_SIZE + 12, PORTRAIT_SIZE + 12);
    this.portraitBg.lineStyle(1, 0xc9a84c, 0.9);
    this.portraitBg.strokeRect(10, 10, PORTRAIT_SIZE + 12, PORTRAIT_SIZE + 12);

    // Divider between top (portrait+situation) and bottom (action menu)
    this.divider.clear();
    this.divider.lineStyle(1, 0x3a2a1a, 0.9);
    this.divider.lineBetween(12, OPTIONS_Y - 8, W - 12, OPTIONS_Y - 8);
    this.divider.lineStyle(1, 0xc9a84c, 0.3);
    this.divider.lineBetween(12, OPTIONS_Y - 7, W - 12, OPTIONS_Y - 7);

    // Bottom bar (description area)
    this.overlay.fillStyle(0x0d0a07, 0.9);
    this.overlay.fillRect(10, DESC_Y - 6, W - 20, H - DESC_Y - 2);
  }

  private buildOptions() {
    // Destroy old
    this.optionTexts.forEach(t => t.destroy());
    this.optionBoxes.forEach(b => b.destroy());
    this.optionTexts = [];
    this.optionBoxes = [];

    const d = 304;
    const totalWidth = (this.options.length - 1) * OPTION_SPACING;
    const startX = W / 2 - totalWidth / 2;

    this.options.forEach((opt, i) => {
      const sel = i === this.selectedIndex;
      const cx = startX + i * OPTION_SPACING;
      const cy = OPTIONS_Y + 12;

      // Box behind each option
      const box = this.scene.add.graphics()
        .setScrollFactor(0).setDepth(d);
      box.fillStyle(sel ? 0x1a1208 : 0x100c08, 0.95);
      box.fillRect(cx - 28, cy - 10, 56, 20);
      box.lineStyle(1, sel ? 0xc9a84c : 0x3a2a1a, sel ? 1 : 0.6);
      box.strokeRect(cx - 28, cy - 10, 56, 20);
      this.optionBoxes.push(box);

      // Option label
      const color = sel ? ACTION_COLORS[opt.action] : '#4a4030';
      const t = this.scene.add.text(cx, cy, opt.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px', color, resolution: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1);
      this.optionTexts.push(t);
    });

    // Move cursor above selected option
    const selCX = startX + this.selectedIndex * OPTION_SPACING;
    this.cursorText.setPosition(selCX, OPTIONS_Y - 2);
    this.cursorText.setVisible(true);

    // Description
    const selOpt = this.options[this.selectedIndex];
    this.descText.setText(selOpt?.description ?? '');
  }

  start(config: EncounterConfig, save: SaveData) {
    this.options = config.options ?? DEFAULT_OPTIONS;
    this.onChoice = config.onChoice;
    this.save = save;
    this.selectedIndex = 0;
    this.active = true;
    this.npcKey = config.npcTextureKey ?? config.npcName.toLowerCase();

    // Flash in — camera flash then show
    this.scene.cameras.main.flash(200, 0, 0, 0, true);
    this.scene.time.delayedCall(180, () => this.show(config));
  }

  private show(config: EncounterConfig) {
    this.drawBackground();

    // Portrait
    const tex = this.scene.textures.exists(this.npcKey) ? this.npcKey : 'villager';
    this.portrait.setTexture(tex).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
    this.portrait.setPosition(PORTRAIT_X, PORTRAIT_Y);

    // NPC name
    this.npcNameText.setText(config.npcName.toUpperCase());

    // Situation text
    this.situationText.setText(config.situation);

    // Make visible
    [this.bgPattern, this.overlay, this.portraitBg, this.portrait,
     this.npcNameText, this.situationText, this.divider, this.descText].forEach(o => o.setVisible(true));

    this.buildOptions();

    // Animate options in — stagger from left
    this.optionTexts.forEach((t, i) => {
      t.setAlpha(0);
      this.scene.tweens.add({ targets: t, alpha: 1, delay: 80 + i * 60, duration: 120 });
    });
    this.optionBoxes.forEach((b, i) => {
      b.setAlpha(0);
      this.scene.tweens.add({ targets: b, alpha: 1, delay: 80 + i * 60, duration: 120 });
    });

    // Pulse the cursor
    this.scene.tweens.add({
      targets: this.cursorText,
      alpha: 0.3, scale: 0.8,
      duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  handleInput(justDown: { up: boolean; down: boolean; space: boolean; enter: boolean }) {
    if (!this.active) return;
    if (justDown.up) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      this.buildOptions();
    } else if (justDown.down) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      this.buildOptions();
    } else if (justDown.space || justDown.enter) {
      this.confirm();
    }
  }

  private confirm() {
    const chosen = this.options[this.selectedIndex];
    if (!chosen || !this.save) return;

    // Flash out
    this.scene.cameras.main.flash(150, 255, 240, 200, true);
    this.scene.time.delayedCall(120, () => {
      this.active = false;
      this.hide();
      this.onChoice?.(chosen.action, this.save!);
    });
  }

  private hide() {
    [this.bgPattern, this.overlay, this.portraitBg, this.portrait,
     this.npcNameText, this.situationText, this.divider, this.descText,
     this.cursorText].forEach(o => o.setVisible(false));
    this.optionTexts.forEach(t => t.destroy());
    this.optionBoxes.forEach(b => b.destroy());
    this.optionTexts = [];
    this.optionBoxes = [];
    this.scene.tweens.killTweensOf(this.cursorText);
  }

  update(_delta: number) {
    if (!this.active) return;
    // Animate cursor glow color
    const t = this.scene.time.now * 0.003;
    const alpha = 0.6 + Math.sin(t) * 0.4;
    this.cursorText.setAlpha(alpha);
  }

  get isActive() { return this.active; }
}
