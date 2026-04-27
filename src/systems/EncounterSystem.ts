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

const PANEL_X  = 4;
const PANEL_Y  = 20;   // just below the 18px HUD bar
const PANEL_W  = 200;  // wider so situation text fits
const PAD      = 8;
const OPT_H    = 14;   // px per option row

export class EncounterSystem {
  private scene: Phaser.Scene;
  private bg!: Phaser.GameObjects.Graphics;
  private situationText!: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private descText!: Phaser.GameObjects.Text;

  private options: EncounterOption[] = [];
  private selectedIndex = 0;
  private active = false;
  private onChoice?: (action: EncounterAction, save: SaveData) => void;
  private save?: SaveData;

  // track y-offset of option block so we can reposition on selection change
  private optionsBaseY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI() {
    // Depth 210+ — above HUD bar (200) and location label (201)
    this.bg = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(210).setVisible(false);

    this.situationText = this.scene.add.text(
      PANEL_X + PAD, PANEL_Y + PAD, '',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '9px',
        color: '#d4b896',
        wordWrap: { width: PANEL_W - PAD * 2 },
        lineSpacing: 3,
        resolution: 3,
      },
    ).setScrollFactor(0).setDepth(211).setVisible(false);

    this.descText = this.scene.add.text(
      PANEL_X + PAD, 0, '',
      {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '9px',
        fontStyle: 'italic',
        color: '#7a6a5a',
        wordWrap: { width: PANEL_W - PAD * 2 },
        resolution: 3,
      },
    ).setScrollFactor(0).setDepth(211).setVisible(false);
  }

  start(config: EncounterConfig, save: SaveData) {
    this.options = config.options ?? DEFAULT_OPTIONS;
    this.onChoice = config.onChoice;
    this.save = save;
    this.selectedIndex = 0;
    this.active = true;

    this.situationText.setText(config.situation);
    this.situationText.setVisible(true);

    // Measure rendered text height to flow options below it
    const sitH = this.situationText.height;
    this.optionsBaseY = PANEL_Y + PAD + sitH + PAD;

    this.rebuildOptions();

    // Total panel height: pad + situation + pad + options + pad + desc + pad
    const descH  = 12;
    const totalH = PAD + sitH + PAD + this.options.length * OPT_H + PAD + descH + PAD;
    this.drawBG(totalH);

    this.descText.setVisible(true);
    this.bg.setVisible(true);
  }

  private drawBG(h: number) {
    this.bg.clear();
    // Shadow
    this.bg.fillStyle(0x000000, 0.5);
    this.bg.fillRect(PANEL_X + 2, PANEL_Y + 2, PANEL_W, h);
    // Body
    this.bg.fillStyle(0x100c08, 0.97);
    this.bg.fillRect(PANEL_X, PANEL_Y, PANEL_W, h);
    // Gold border
    this.bg.lineStyle(1, 0xc9a84c, 1);
    this.bg.strokeRect(PANEL_X, PANEL_Y, PANEL_W, h);
    // Inner border
    this.bg.lineStyle(1, 0x7a5c2a, 0.4);
    this.bg.strokeRect(PANEL_X + 2, PANEL_Y + 2, PANEL_W - 4, h - 4);
    // Divider between situation and options
    this.bg.lineStyle(1, 0x3a2a1a, 0.8);
    this.bg.lineBetween(
      PANEL_X + PAD, this.optionsBaseY - PAD / 2,
      PANEL_X + PANEL_W - PAD, this.optionsBaseY - PAD / 2,
    );
  }

  private rebuildOptions() {
    this.optionTexts.forEach(t => t.destroy());
    this.optionTexts = [];

    this.options.forEach((opt, i) => {
      const sel    = i === this.selectedIndex;
      const prefix = sel ? '▶ ' : '  ';
      const t = this.scene.add.text(
        PANEL_X + PAD,
        this.optionsBaseY + i * OPT_H,
        prefix + opt.label,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '6px',
          color: sel ? COLORS[opt.action] : '#4a4030',
          resolution: 3,
        },
      ).setScrollFactor(0).setDepth(211);
      this.optionTexts.push(t);
    });

    const descY = this.optionsBaseY + this.options.length * OPT_H + PAD;
    this.descText.setY(descY);
    this.descText.setText(this.options[this.selectedIndex]?.description ?? '');
  }

  handleInput(justDown: { up: boolean; down: boolean; space: boolean; enter: boolean }) {
    if (!this.active) return;
    if (justDown.up) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      this.rebuildOptions();
    } else if (justDown.down) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      this.rebuildOptions();
    } else if (justDown.space || justDown.enter) {
      this.confirm();
    }
  }

  private confirm() {
    const chosen = this.options[this.selectedIndex];
    if (!chosen || !this.save) return;
    this.active = false;
    this.hide();
    this.onChoice?.(chosen.action, this.save);
  }

  private hide() {
    this.bg.setVisible(false);
    this.situationText.setVisible(false);
    this.descText.setVisible(false);
    this.optionTexts.forEach(t => t.destroy());
    this.optionTexts = [];
  }

  get isActive() { return this.active; }
}
