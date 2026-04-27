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
  options?: EncounterOption[];
  onChoice: (action: EncounterAction, save: SaveData) => void;
}

const DEFAULT_OPTIONS: EncounterOption[] = [
  { action: 'listen', label: 'LISTEN',  description: 'Hear their story' },
  { action: 'serve',  label: 'SERVE',   description: 'Act on their need' },
  { action: 'pray',   label: 'PRAY',    description: 'Intercede for them' },
  { action: 'pass',   label: 'PASS BY', description: 'Continue on your way' },
];

const COLORS: Record<EncounterAction, string> = {
  listen: '#4a9eff',
  serve:  '#5ecb6b',
  pray:   '#f5deb3',
  pass:   '#888888',
};

// Centered panel — screen-space coordinates
const PANEL_W = 160;
const PANEL_X = 4;
const PANEL_Y = 14;  // just below the HUD bar

export class EncounterSystem {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private descText!: Phaser.GameObjects.Text;
  private situationText!: Phaser.GameObjects.Text;
  private bg!: Phaser.GameObjects.Graphics;

  private options: EncounterOption[] = [];
  private selectedIndex = 0;
  private active = false;
  private onChoice?: (action: EncounterAction, save: SaveData) => void;
  private save?: SaveData;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI() {
    // setScrollFactor(0) keeps the container screen-fixed
    this.container = this.scene.add.container(0, 0)
      .setDepth(110).setScrollFactor(0);

    this.bg = this.scene.add.graphics();
    this.container.add(this.bg);

    this.situationText = this.scene.add.text(PANEL_X + 6, PANEL_Y + 6, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#d4b896',
      wordWrap: { width: PANEL_W - 12 },
      lineSpacing: 2,
      resolution: 3,
    });
    this.container.add(this.situationText);

    this.descText = this.scene.add.text(PANEL_X + 6, PANEL_Y + 80, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      fontStyle: 'italic',
      color: '#aaaaaa',
      wordWrap: { width: PANEL_W - 12 },
      resolution: 3,
    });
    this.container.add(this.descText);

    this.setVisible(false);
  }

  private drawBG(optionCount: number) {
    const h = 38 + optionCount * 16 + 22;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.55);
    this.bg.fillRect(PANEL_X + 2, PANEL_Y + 2, PANEL_W, h);
    this.bg.fillStyle(0x100c08, 0.96);
    this.bg.fillRect(PANEL_X, PANEL_Y, PANEL_W, h);
    this.bg.lineStyle(1, 0xc9a84c, 1);
    this.bg.strokeRect(PANEL_X, PANEL_Y, PANEL_W, h);
    this.bg.lineStyle(1, 0x7a5c2a, 0.4);
    this.bg.strokeRect(PANEL_X + 2, PANEL_Y + 2, PANEL_W - 4, h - 4);
  }

  start(config: EncounterConfig, save: SaveData) {
    this.options = config.options ?? DEFAULT_OPTIONS;
    this.onChoice = config.onChoice;
    this.save = save;
    this.selectedIndex = 0;
    this.active = true;

    this.drawBG(this.options.length);
    this.situationText.setText(config.situation);
    this.updateOptionTexts();
    this.setVisible(true);
  }

  private updateOptionTexts() {
    this.optionTexts.forEach(t => t.destroy());
    this.optionTexts = [];

    this.options.forEach((opt, i) => {
      const sel = i === this.selectedIndex;
      const prefix = sel ? '> ' : '  ';
      const t = this.scene.add.text(PANEL_X + 8, PANEL_Y + 36 + i * 16, prefix + opt.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px',
        color: sel ? COLORS[opt.action] : '#555555',
        resolution: 3,
      });
      this.container.add(t);
      this.optionTexts.push(t);
    });

    this.descText.setY(PANEL_Y + 36 + this.options.length * 16 + 6);
    this.descText.setText(this.options[this.selectedIndex]?.description ?? '');
  }

  private setVisible(v: boolean) {
    this.container.setVisible(v);
  }

  handleInput(justDown: { up: boolean; down: boolean; space: boolean; enter: boolean }) {
    if (!this.active) return;
    if (justDown.up) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      this.updateOptionTexts();
    } else if (justDown.down) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      this.updateOptionTexts();
    } else if (justDown.space || justDown.enter) {
      this.confirm();
    }
  }

  private confirm() {
    const chosen = this.options[this.selectedIndex];
    if (!chosen || !this.save) return;
    this.active = false;
    this.setVisible(false);
    this.onChoice?.(chosen.action, this.save);
  }

  get isActive() { return this.active; }
}
