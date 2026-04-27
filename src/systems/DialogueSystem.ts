import Phaser from 'phaser';

export interface DialogueLine {
  speaker: string;
  text: string;
  portrait?: string;
  nameColor?: number;
}

export interface DialogueConfig {
  lines: DialogueLine[];
  onComplete?: () => void;
}

// Screen-space constants (relative to the 320×180 viewport)
const BOX_X = 4;
const BOX_Y = 104;
const BOX_W = 312;
const BOX_H = 74;
const PAD = 7;
const CHARS_PER_TICK = 2;

export class DialogueSystem {
  private scene: Phaser.Scene;
  private box!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private continueArrow!: Phaser.GameObjects.Text;

  private lines: DialogueLine[] = [];
  private currentLine = 0;
  private displayedChars = 0;
  private charTimer = 0;
  private active = false;
  private onComplete?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI() {
    // All elements use setScrollFactor(0) — screen-fixed, not world-positioned
    this.box = this.scene.add.graphics()
      .setDepth(100).setScrollFactor(0);

    this.nameText = this.scene.add.text(BOX_X + PAD, BOX_Y + PAD, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#f5deb3',
      resolution: 3,
    }).setDepth(101).setScrollFactor(0);

    this.bodyText = this.scene.add.text(BOX_X + PAD, BOX_Y + PAD + 14, '', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '10px',
      color: '#fffde8',
      wordWrap: { width: BOX_W - PAD * 2 },
      lineSpacing: 2,
      resolution: 3,
    }).setDepth(101).setScrollFactor(0);

    this.continueArrow = this.scene.add.text(
      BOX_X + BOX_W - PAD - 8,
      BOX_Y + BOX_H - PAD - 8,
      '▼',
      { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#c9a84c', resolution: 3 },
    ).setDepth(101).setScrollFactor(0).setVisible(false);

    this.setVisible(false);
  }

  private drawBox() {
    this.box.clear();
    this.box.fillStyle(0x000000, 0.6);
    this.box.fillRect(BOX_X + 2, BOX_Y + 2, BOX_W, BOX_H);
    this.box.fillStyle(0x1a120a, 0.94);
    this.box.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);
    this.box.lineStyle(1, 0xc9a84c, 1);
    this.box.strokeRect(BOX_X, BOX_Y, BOX_W, BOX_H);
    this.box.lineStyle(1, 0x7a5c2a, 0.5);
    this.box.strokeRect(BOX_X + 2, BOX_Y + 2, BOX_W - 4, BOX_H - 4);
  }

  private setVisible(v: boolean) {
    this.box.setVisible(v);
    this.nameText.setVisible(v);
    this.bodyText.setVisible(v);
    if (!v) this.continueArrow.setVisible(false);
  }

  start(config: DialogueConfig) {
    this.lines = config.lines;
    this.onComplete = config.onComplete;
    this.currentLine = 0;
    this.displayedChars = 0;
    this.charTimer = 0;
    this.active = true;
    this.drawBox();
    this.setVisible(true);
    this.showLine();
  }

  private showLine() {
    if (this.currentLine >= this.lines.length) { this.finish(); return; }
    const line = this.lines[this.currentLine];
    this.nameText.setText(line.speaker.toUpperCase());
    this.nameText.setColor(
      line.nameColor ? Phaser.Display.Color.IntegerToColor(line.nameColor).rgba : '#f5deb3',
    );
    this.bodyText.setText('');
    this.displayedChars = 0;
    this.continueArrow.setVisible(false);
  }

  advance() {
    if (!this.active) return;
    const line = this.lines[this.currentLine];
    if (!line) return;
    if (this.displayedChars < line.text.length) {
      this.displayedChars = line.text.length;
      this.bodyText.setText(line.text);
      this.continueArrow.setVisible(true);
    } else {
      this.currentLine++;
      this.displayedChars = 0;
      this.charTimer = 0;
      this.showLine();
    }
  }

  update(delta: number) {
    if (!this.active) return;
    const line = this.lines[this.currentLine];
    if (!line) return;
    if (this.displayedChars < line.text.length) {
      this.charTimer += delta;
      const add = Math.floor(this.charTimer / (1000 / 60)) * CHARS_PER_TICK;
      if (add > 0) {
        this.charTimer = 0;
        this.displayedChars = Math.min(line.text.length, this.displayedChars + add);
        this.bodyText.setText(line.text.slice(0, this.displayedChars));
      }
    } else {
      this.continueArrow.setVisible(true);
      this.continueArrow.setAlpha(Math.sin(this.scene.time.now * 0.005) * 0.3 + 0.7);
    }
  }

  private finish() {
    this.active = false;
    this.setVisible(false);
    this.onComplete?.();
  }

  get isActive() { return this.active; }
}
