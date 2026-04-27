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
  { action: 'listen', label: 'LISTEN', description: 'Hear their story' },
  { action: 'serve',  label: 'SERVE',  description: 'Act on their need' },
  { action: 'pray',   label: 'PRAY',   description: 'Intercede for them' },
  { action: 'pass',   label: 'PASS BY', description: 'Continue on your way' },
];

const COLORS: Record<EncounterAction, number> = {
  listen:  0x4a9eff,
  serve:   0x5ecb6b,
  pray:    0xf5deb3,
  pass:    0x888888,
};

const BOX_X = 4;
const BOX_Y = 4;
const BOX_W = 140;

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
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
    this.cursors = scene.input.keyboard!.createCursorKeys();
  }

  private createUI() {
    this.container = this.scene.add.container(0, 0).setDepth(110);

    this.bg = this.scene.add.graphics();
    this.container.add(this.bg);

    this.situationText = this.scene.add.text(BOX_X + 6, BOX_Y + 6, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#d4b896',
      wordWrap: { width: BOX_W - 12 },
      lineSpacing: 3,
      resolution: 4,
    });
    this.container.add(this.situationText);

    this.descText = this.scene.add.text(BOX_X + 6, BOX_Y + 60, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#aaaaaa',
      wordWrap: { width: BOX_W - 12 },
      resolution: 4,
    });
    this.container.add(this.descText);

    this.setVisible(false);
  }

  private drawBG(optionCount: number) {
    const h = 30 + optionCount * 14 + 18;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.5);
    this.bg.fillRect(BOX_X + 2, BOX_Y + 2, BOX_W, h);
    this.bg.fillStyle(0x100c08, 0.95);
    this.bg.fillRect(BOX_X, BOX_Y, BOX_W, h);
    this.bg.lineStyle(1, 0xc9a84c, 1);
    this.bg.strokeRect(BOX_X, BOX_Y, BOX_W, h);
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
      const isSelected = i === this.selectedIndex;
      const color = isSelected
        ? Phaser.Display.Color.IntegerToColor(COLORS[opt.action]).rgba
        : '#666666';
      const prefix = isSelected ? '▶ ' : '  ';
      const t = this.scene.add.text(BOX_X + 8, BOX_Y + 28 + i * 14, prefix + opt.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '5px',
        color,
        resolution: 4,
      });
      this.container.add(t);
      this.optionTexts.push(t);
    });

    this.descText.setY(BOX_Y + 28 + this.options.length * 14 + 4);
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
