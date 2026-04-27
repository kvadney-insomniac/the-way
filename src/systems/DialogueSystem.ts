import Phaser from 'phaser';

export interface DialogueLine {
  speaker: string;
  text: string;
  portrait?: string;
  /** Optional color tint for the speaker name */
  nameColor?: number;
}

export interface DialogueConfig {
  lines: DialogueLine[];
  onComplete?: () => void;
}

const BOX_X = 4;
const BOX_Y = 110;
const BOX_W = 312;
const BOX_H = 66;
const PADDING = 8;
const CHARS_PER_FRAME = 2;

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
    this.box = this.scene.add.graphics();
    this.box.setDepth(100);

    this.nameText = this.scene.add.text(BOX_X + PADDING, BOX_Y + PADDING, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#f5deb3',
      resolution: 4,
    }).setDepth(101);

    this.bodyText = this.scene.add.text(BOX_X + PADDING, BOX_Y + PADDING + 14, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#fffde8',
      wordWrap: { width: BOX_W - PADDING * 2 },
      lineSpacing: 4,
      resolution: 4,
    }).setDepth(101);

    this.continueArrow = this.scene.add.text(
      BOX_X + BOX_W - PADDING - 6,
      BOX_Y + BOX_H - PADDING - 6,
      '▼',
      { fontFamily: '"Press Start 2P", monospace', fontSize: '5px', color: '#c9a84c', resolution: 4 }
    ).setDepth(101).setVisible(false);

    this.setVisible(false);
  }

  private drawBox() {
    this.box.clear();
    // Shadow
    this.box.fillStyle(0x000000, 0.6);
    this.box.fillRect(BOX_X + 2, BOX_Y + 2, BOX_W, BOX_H);
    // Background
    this.box.fillStyle(0x1a120a, 0.92);
    this.box.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);
    // Gold border
    this.box.lineStyle(1, 0xc9a84c, 1);
    this.box.strokeRect(BOX_X, BOX_Y, BOX_W, BOX_H);
    // Inner border
    this.box.lineStyle(1, 0x7a5c2a, 0.5);
    this.box.strokeRect(BOX_X + 2, BOX_Y + 2, BOX_W - 4, BOX_H - 4);
  }

  private setVisible(v: boolean) {
    this.box.setVisible(v);
    this.nameText.setVisible(v);
    this.bodyText.setVisible(v);
    this.continueArrow.setVisible(false);
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
    if (this.currentLine >= this.lines.length) {
      this.finish();
      return;
    }
    const line = this.lines[this.currentLine];
    this.nameText.setText(line.speaker.toUpperCase());
    this.nameText.setColor(
      line.nameColor ? Phaser.Display.Color.IntegerToColor(line.nameColor).rgba : '#f5deb3'
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
      // Skip typewriter — show full text
      this.displayedChars = line.text.length;
      this.bodyText.setText(line.text);
      this.continueArrow.setVisible(true);
    } else {
      this.currentLine++;
      this.displayedChars = 0;
      this.charTimer = 0;
      this.continueArrow.setVisible(false);
      this.showLine();
    }
  }

  update(delta: number) {
    if (!this.active) return;
    const line = this.lines[this.currentLine];
    if (!line) return;

    if (this.displayedChars < line.text.length) {
      this.charTimer += delta;
      const charsToAdd = Math.floor(this.charTimer / (1000 / 60)) * CHARS_PER_FRAME;
      if (charsToAdd > 0) {
        this.charTimer = 0;
        this.displayedChars = Math.min(line.text.length, this.displayedChars + charsToAdd);
        this.bodyText.setText(line.text.slice(0, this.displayedChars));
      }
    } else {
      this.continueArrow.setVisible(true);
      // Pulse the arrow
      const pulse = Math.sin(this.scene.time.now * 0.005) * 0.3 + 0.7;
      this.continueArrow.setAlpha(pulse);
    }
  }

  private finish() {
    this.active = false;
    this.setVisible(false);
    this.onComplete?.();
  }

  get isActive() { return this.active; }
}
