import Phaser from 'phaser';
import otRoots from '../data/scrollRoom/otRoots.json';
import { getUnlockedScrollCards } from '../systems/LOVESystem';
import { loadSave } from '../systems/SaveSystem';
import { fadeIn } from '../utils/pixelTransition';

interface ScrollCard {
  heading: string;
  text: string;
  reference?: string;
  word?: string;
}

type CardKey = 'otRoot' | 'wordStudy' | 'narrativeArc' | 'newCreation' | 'deepDive';

const CARD_KEYS: CardKey[] = ['otRoot', 'wordStudy', 'narrativeArc', 'newCreation', 'deepDive'];

export class ScrollRoomScene extends Phaser.Scene {
  private episodeKey = '';
  private cards: ScrollCard[] = [];
  private currentCard = 0;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private zKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'ScrollRoomScene' });
  }

  init(data: { episodeKey: string }) {
    this.episodeKey = data.episodeKey;
  }

  create() {
    fadeIn(this, 600);
    this.buildCards();
    this.drawBackground();
    this.renderCard(0);

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.zKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  private buildCards() {
    const episodeData = (otRoots as unknown as Record<string, Record<string, ScrollCard>>)[this.episodeKey];
    if (!episodeData) { this.close(); return; }

    const save = loadSave();
    const unlockedKeys = getUnlockedScrollCards(save);

    this.cards = CARD_KEYS
      .filter(k => unlockedKeys.includes(k) && episodeData[k])
      .map(k => episodeData[k]);
  }

  private drawBackground() {
    const { width, height } = this.scale;

    // Deep lapis background (Bible Project feel)
    this.add.rectangle(0, 0, width, height, 0x0d1929).setOrigin(0);

    // Subtle star field
    const stars = this.add.graphics();
    for (let i = 0; i < 30; i++) {
      stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.05, 0.25));
      stars.fillRect(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 1, 1);
    }

    // Gold decorative lines (top and bottom)
    const deco = this.add.graphics();
    deco.lineStyle(1, 0xc9a84c, 0.6);
    deco.lineBetween(10, 14, width - 10, 14);
    deco.lineBetween(10, height - 14, width - 10, height - 14);

    // "SCROLL ROOM" label
    this.add.text(width / 2, 6, '✦  THE SCROLL ROOM  ✦', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#c9a84c',
      resolution: 4,
    }).setOrigin(0.5);
  }

  private renderCard(index: number) {
    // Clear previous card contents (keep background)
    this.children.list
      .filter(c => (c as Phaser.GameObjects.GameObject).getData?.('cardContent'))
      .forEach(c => c.destroy());

    const card = this.cards[index];
    if (!card) { this.close(); return; }

    const { width, height } = this.scale;
    const CARD_X = 12;
    const CARD_Y = 20;
    const CARD_W = width - 24;
    const CARD_H = height - 36;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x091422, 0.95);
    bg.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
    bg.lineStyle(1, 0xc9a84c, 0.8);
    bg.strokeRect(CARD_X, CARD_Y, CARD_W, CARD_H);
    bg.setData('cardContent', true);

    // Animated gold line drawing from left
    const accentLine = this.add.graphics().setData('cardContent', true);
    accentLine.lineStyle(1, 0xc9a84c, 0.4);
    accentLine.lineBetween(CARD_X + 8, CARD_Y + 8, CARD_X + CARD_W - 8, CARD_Y + 8);

    // Card number / progress dots
    const dots = this.add.text(width / 2, height - 10, this.buildDots(index), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#c9a84c',
      resolution: 4,
    }).setOrigin(0.5).setData('cardContent', true);
    void dots;

    // Heading
    const heading = this.add.text(CARD_X + 10, CARD_Y + 14, card.heading, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#f5deb3',
      wordWrap: { width: CARD_W - 20 },
      lineSpacing: 3,
      resolution: 4,
    }).setData('cardContent', true);

    // Hebrew/Greek word (if present)
    if (card.word) {
      this.add.text(CARD_X + CARD_W - 14, CARD_Y + 14, card.word, {
        fontFamily: 'serif',
        fontSize: '10px',
        color: '#c9a84c',
        resolution: 4,
      }).setOrigin(1, 0).setData('cardContent', true);
    }

    // Separator
    const sepY = heading.y + heading.height + 6;
    const sep = this.add.graphics().setData('cardContent', true);
    sep.lineStyle(1, 0x3a4a6a, 1);
    sep.lineBetween(CARD_X + 10, sepY, CARD_X + CARD_W - 10, sepY);

    // Body text — using Crimson Text style (fallback serif)
    this.add.text(CARD_X + 10, sepY + 6, card.text, {
      fontFamily: '"Crimson Text", Georgia, serif',
      fontSize: '8px',
      color: '#c8d8e8',
      wordWrap: { width: CARD_W - 20 },
      lineSpacing: 4,
      resolution: 4,
    }).setData('cardContent', true);

    // Scripture reference
    if (card.reference) {
      this.add.text(CARD_X + CARD_W - 10, CARD_Y + CARD_H - 12, card.reference, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '4px',
        color: '#7a9aaa',
        resolution: 4,
      }).setOrigin(1, 1).setData('cardContent', true);
    }

    // Continue prompt
    const isLast = index >= this.cards.length - 1;
    const continueText = isLast ? 'PRESS Z TO RETURN' : 'PRESS Z FOR NEXT';
    this.add.text(width / 2, height - 22, continueText, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px',
      color: '#6a7a8a',
      resolution: 4,
    }).setOrigin(0.5).setData('cardContent', true);

    // Animate card in
    const allNew = this.children.list.filter(c =>
      (c as Phaser.GameObjects.GameObject).getData?.('cardContent')
    );
    allNew.forEach(c => {
      (c as Phaser.GameObjects.Image).setAlpha?.(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 400 });
    });
  }

  private buildDots(current: number): string {
    return this.cards.map((_, i) => i === current ? '●' : '○').join(' ');
  }

  update() {
    if (
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.zKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey)
    ) {
      if (this.currentCard < this.cards.length - 1) {
        this.currentCard++;
        this.renderCard(this.currentCard);
      } else {
        this.close();
      }
    }
  }

  private close() {
    this.scene.stop();
    this.scene.resume('CapernaumScene');
  }
}
