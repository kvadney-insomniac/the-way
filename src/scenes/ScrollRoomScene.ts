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

// Typography — all sizes in game pixels (canvas is 320×180, displayed at 3× zoom)
const SERIF   = 'Georgia, "Times New Roman", serif';
const PIXEL   = '"Press Start 2P", monospace';

export class ScrollRoomScene extends Phaser.Scene {
  private episodeKey = '';
  private cards: ScrollCard[] = [];
  private currentCard = 0;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private zKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'ScrollRoomScene' });
  }

  init(data: { episodeKey: string }) {
    this.episodeKey = data.episodeKey;
  }

  create() {
    fadeIn(this, 500);
    this.buildCards();
    this.drawBackground();
    this.renderCard(0);

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.zKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  private buildCards() {
    const episodeData = (otRoots as unknown as Record<string, Record<string, ScrollCard>>)[this.episodeKey];
    if (!episodeData) { this.close(); return; }
    const save = loadSave();
    const unlocked = getUnlockedScrollCards(save);
    this.cards = CARD_KEYS.filter(k => unlocked.includes(k) && episodeData[k]).map(k => episodeData[k]);
  }

  private drawBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x0d1929).setOrigin(0);

    const stars = this.add.graphics();
    for (let i = 0; i < 30; i++) {
      stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.05, 0.2));
      stars.fillRect(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 1, 1);
    }

    const deco = this.add.graphics();
    deco.lineStyle(1, 0xc9a84c, 0.5);
    deco.lineBetween(8, 12, width - 8, 12);
    deco.lineBetween(8, height - 12, width - 8, height - 12);

    // Header
    this.add.text(width / 2, 6, 'THE SCROLL ROOM', {
      fontFamily: PIXEL,
      fontSize: '6px',
      color: '#c9a84c',
      resolution: 3,
    }).setOrigin(0.5);
  }

  private renderCard(index: number) {
    this.children.list
      .filter(c => (c as Phaser.GameObjects.GameObject).getData?.('card'))
      .forEach(c => c.destroy());

    const card = this.cards[index];
    if (!card) { this.close(); return; }

    const { width, height } = this.scale;
    const CX = 10, CY = 18;
    const CW = width - 20;
    const CH = height - 32;

    // Card background
    const bg = this.add.graphics().setData('card', true);
    bg.fillStyle(0x091422, 0.97);
    bg.fillRect(CX, CY, CW, CH);
    bg.lineStyle(1, 0xc9a84c, 0.9);
    bg.strokeRect(CX, CY, CW, CH);
    bg.lineStyle(1, 0x3a4a6a, 0.4);
    bg.strokeRect(CX + 2, CY + 2, CW - 4, CH - 4);

    const PAD = 8;
    let y = CY + PAD;

    // Heading
    const heading = this.add.text(CX + PAD, y, card.heading, {
      fontFamily: PIXEL,
      fontSize: '6px',
      color: '#f5deb3',
      wordWrap: { width: CW - PAD * 2 - (card.word ? 30 : 0) },
      lineSpacing: 4,
      resolution: 3,
    }).setData('card', true);
    y += heading.height + 4;

    // Hebrew/Greek word (top-right if present)
    if (card.word) {
      this.add.text(CX + CW - PAD, CY + PAD, card.word, {
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: '11px',
        color: '#c9a84c',
        resolution: 3,
      }).setOrigin(1, 0).setData('card', true);
    }

    // Separator
    const sep = this.add.graphics().setData('card', true);
    sep.lineStyle(1, 0x3a4a6a, 0.8);
    sep.lineBetween(CX + PAD, y, CX + CW - PAD, y);
    y += 5;

    // Body text
    this.add.text(CX + PAD, y, card.text, {
      fontFamily: SERIF,
      fontSize: '11px',
      color: '#c8d8e8',
      wordWrap: { width: CW - PAD * 2 },
      lineSpacing: 3,
      resolution: 3,
    }).setData('card', true);

    // Reference (bottom right)
    if (card.reference) {
      this.add.text(CX + CW - PAD, CY + CH - PAD, card.reference, {
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: '10px',
        color: '#7a9aaa',
        resolution: 3,
      }).setOrigin(1, 1).setData('card', true);
    }

    // Progress dots
    this.add.text(width / 2, height - 8, this.buildDots(index), {
      fontFamily: PIXEL,
      fontSize: '5px',
      color: '#c9a84c',
      resolution: 3,
    }).setOrigin(0.5).setData('card', true);

    // Continue prompt
    const isLast = index >= this.cards.length - 1;
    this.add.text(width / 2, height - 20, isLast ? 'PRESS Z TO RETURN' : 'PRESS Z FOR NEXT', {
      fontFamily: PIXEL,
      fontSize: '5px',
      color: '#5a7a8a',
      resolution: 3,
    }).setOrigin(0.5).setData('card', true);

    // Fade in all new elements
    this.children.list
      .filter(c => (c as Phaser.GameObjects.GameObject).getData?.('card'))
      .forEach(c => {
        (c as Phaser.GameObjects.Image).setAlpha?.(0);
        this.tweens.add({ targets: c, alpha: 1, duration: 350 });
      });
  }

  private buildDots(current: number): string {
    return this.cards.map((_, i) => (i === current ? '●' : '○')).join(' ');
  }

  update() {
    if (
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.zKey)
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
