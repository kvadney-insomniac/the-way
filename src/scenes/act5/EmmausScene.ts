import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene, holyFlash, cosmicGlitch } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

// suppress unused imports
void NPC;
void applyEncounterChoice;
void writeSave;
void unlockEpisode;
void completeEpisode;
void fadeIn;

const MAP_W = 960;
const MAP_H = 180;

export class EmmausScene extends Phaser.Scene {
  constructor() { super({ key: 'EmmausScene' }); }

  private player!: Player;
  private stranger!: Phaser.GameObjects.Sprite;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  // milestone tracking
  private milestone200 = false;
  private milestone400 = false;
  private milestone600 = false;
  private milestone800 = false;
  private milestoneArrived = false;
  private breadBreakingDone = false;
  private transitioning = false;

  // scripture card overlay
  private scriptureCard!: Phaser.GameObjects.Text;
  private scriptureCardVisible = false;

  create() {
    try {
      this.milestone200 = false;
      this.milestone400 = false;
      this.milestone600 = false;
      this.milestone800 = false;
      this.milestoneArrived = false;
      this.breadBreakingDone = false;
      this.transitioning = false;
      this.scriptureCardVisible = false;

      this.buildMap();
      this.createPlayer();
      this.createStranger();

      this.dialogue  = new DialogueSystem(this);
      this.encounter = new EncounterSystem(this);

      this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
      this.spaceKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.cursorKeys  = this.input.keyboard!.createCursorKeys();
      this.input.keyboard!.addCapture([
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.Z,
      ]);

      this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

      this.createScriptureCard();
      this.drawHUD();
      this.drawLocationLabel();

      fadeIn(this, 800);
      // Emmaus plays sea ambient (closest available track to "road at dusk")
      globalAudio.play('sea', 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('EmmausScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics().setDepth(0);

    // Sky — amber-gold to blue gradient across full width
    for (let x = 0; x < MAP_W; x += 4) {
      const skyT = x / MAP_W;
      const r = Math.floor(0xe8 - (0xe8 - 0x60) * skyT);
      const gv = Math.floor(0xc0 - (0xc0 - 0x90) * skyT);
      const b = Math.floor(0x60 + (0xc0 - 0x60) * skyT);
      const color = (r << 16) | (gv << 8) | b;
      g.fillStyle(color, 1);
      g.fillRect(x, 0, 4, 40);
    }

    // Rolling hills — silhouettes both sides
    g.fillStyle(0x4a6a2a);
    // Bottom hills running full width
    for (let hx = 0; hx < MAP_W; hx += 80) {
      const h = 30 + Math.sin(hx * 0.03) * 15;
      g.fillEllipse(hx + 40, 80, 100, h * 2);
    }
    // Upper hills (background)
    g.fillStyle(0x3a5a1a);
    for (let hx = 20; hx < MAP_W; hx += 120) {
      g.fillEllipse(hx + 60, 60, 140, 40);
    }

    // Road — long dirt path
    g.fillStyle(0xc0a060);
    g.fillRect(0, 90, MAP_W, 30);

    // Road texture marks
    g.fillStyle(0xb09050, 0.6);
    for (let rx = 10; rx < MAP_W; rx += 40) {
      g.fillRect(rx, 95, 15, 3);
      g.fillRect(rx + 20, 108, 12, 3);
    }

    // Road edges — slightly darker
    g.fillStyle(0x9a7840);
    g.fillRect(0, 90, MAP_W, 3);
    g.fillRect(0, 117, MAP_W, 3);

    // Ground below road
    g.fillStyle(0x5a8a30);
    g.fillRect(0, 120, MAP_W, MAP_H - 120);

    // Wildflowers along roadside
    const flowerColors = [0xff9966, 0xffdd44, 0xffffff, 0xff88bb];
    for (let fx = 5; fx < MAP_W; fx += 18) {
      const offset = Math.floor(Math.sin(fx * 0.1) * 5);
      g.fillStyle(flowerColors[Math.floor((fx / 18)) % flowerColors.length], 1);
      g.fillRect(fx, 122 + offset, 2, 2);
      g.fillRect(fx + 8, 88 + offset, 2, 2);
    }

    // Scattered rocks along road
    g.fillStyle(0x8a7a6a);
    for (let rx = 30; rx < MAP_W; rx += 90) {
      g.fillEllipse(rx, 115, 6, 4);
      g.fillEllipse(rx + 45, 92, 5, 3);
    }

    // Inn at end (x ~880)
    g.fillStyle(0xb89060);
    g.fillRect(850, 60, 80, 60);
    g.fillStyle(0x7a5030);
    g.fillRect(848, 55, 84, 10);
    g.fillStyle(0x4a3020);
    g.fillRect(875, 88, 16, 32);
    // Inn sign
    g.fillStyle(0x8a6040);
    g.fillRect(856, 65, 28, 12);

    // Inn table (for bread-breaking)
    g.fillStyle(0x8a6040);
    g.fillRect(870, 95, 30, 6);
    g.fillStyle(0x6a4820);
    g.fillRect(872, 101, 4, 10);
    g.fillRect(892, 101, 4, 10);
  }

  private createPlayer() {
    this.player = new Player(this, 48, 105);
  }

  private createStranger() {
    this.stranger = this.add.sprite(72, 105, 'jesus').setDepth(50);
  }

  private createScriptureCard() {
    this.scriptureCard = this.add.text(160, 70, '', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '9px',
      color: '#f5e8c0',
      wordWrap: { width: 220 },
      align: 'center',
      backgroundColor: '#00000099',
      padding: { left: 8, right: 8, top: 6, bottom: 6 },
      resolution: 3,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setAlpha(0)
      .setVisible(false);
  }

  private showScriptureCard(text: string) {
    if (this.scriptureCardVisible) return;
    this.scriptureCardVisible = true;
    this.scriptureCard.setText(text).setVisible(true);
    this.tweens.add({
      targets: this.scriptureCard,
      alpha: 1,
      duration: 400,
      onComplete: () => {
        this.time.delayedCall(3000, () => {
          this.tweens.add({
            targets: this.scriptureCard,
            alpha: 0,
            duration: 600,
            onComplete: () => {
              this.scriptureCard.setVisible(false);
              this.scriptureCardVisible = false;
            },
          });
        });
      },
    });
  }

  private drawHUD() {
    const save = loadSave();
    const BAR_H = 18;
    const D = 201;
    const g = this.add.graphics().setScrollFactor(0).setDepth(200);

    g.fillStyle(0x080604, 0.92);
    g.fillRect(0, 0, 320, BAR_H);
    g.lineStyle(1, 0xc9a84c, 0.5);
    g.lineBetween(0, BAR_H, 320, BAR_H);

    const faithLevel = Math.min(save.faithLevel, 5);
    this.add.text(5, 4, 'FAITH', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(D);

    for (let i = 0; i < 5; i++) {
      const filled = i < faithLevel;
      g.fillStyle(filled ? 0xe05050 : 0x3a2020);
      g.fillRect(45 + i * 9, 5, 7, 7);
    }

    const loveColor = save.love >= 10 ? '#f5c842' : save.love >= 5 ? '#88cc88' : '#c9a84c';
    this.add.text(160, 4, `LOVE  ${save.love}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: loveColor, resolution: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D);

    this.add.text(315, 4, 'WALK EAST', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#5a4530', resolution: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D);
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 25, 'THE ROAD TO EMMAUS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: '#f5deb3', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 2500,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  private triggerBreadBreaking() {
    if (this.breadBreakingDone) return;
    this.breadBreakingDone = true;

    this.player.frozen = true;

    // Bread blessing dialogue
    this.dialogue.start({
      lines: [
        { speaker: 'Stranger', text: 'He took the bread and gave thanks...' },
      ],
      onComplete: () => {
        this.cameras.main.flash(600, 255, 255, 240, true);

        this.time.delayedCall(400, () => {
          cosmicGlitch(this);

          // Stranger vanishes
          this.tweens.add({
            targets: this.stranger,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              this.stranger.setVisible(false);
            },
          });

          this.time.delayedCall(600, () => {
            holyFlash(this);

            this.dialogue.start({
              lines: [
                {
                  speaker: 'Cleopas',
                  text: '"Were not our hearts burning within us while he talked with us on the road?"',
                },
                {
                  speaker: 'Disciple',
                  text: '"He explained the Scriptures to us — and we knew him in the breaking of the bread."',
                },
              ],
              onComplete: () => {
                this.time.delayedCall(3000, () => {
                  if (!this.transitioning) {
                    this.transitioning = true;
                    fadeToScene(this, 'RestorationScene');
                  }
                });
              },
            });
          });
        });
      },
    });
  }

  update(_time: number, delta: number) {
    this.dialogue.update(delta);
    this.encounter.update(delta);

    const blocked = this.dialogue.isActive || this.encounter.isActive;
    if (!this.breadBreakingDone) {
      this.player.frozen = blocked;
    }

    // Stranger follows player
    if (this.stranger.visible) {
      this.stranger.x = this.player.x + 24;
      this.stranger.y = this.player.y;
      this.stranger.setDepth(this.player.y + 1);
    }

    const justZ     = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const justSpace = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const justUp    = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);

    if (this.dialogue.isActive) {
      if (justZ || justSpace) this.dialogue.advance();
      return;
    }

    if (this.encounter.isActive) {
      const up   = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);
      const down = Phaser.Input.Keyboard.JustDown(this.cursorKeys.down!);
      this.encounter.handleInput({ up, down, space: justSpace, enter: justUp });
      return;
    }

    const px = this.player.x;

    // Scripture milestone cards
    if (!this.milestone200 && px > 200) {
      this.milestone200 = true;
      this.showScriptureCard('He began with Moses and all the Prophets...');
    }
    if (!this.milestone400 && px > 400) {
      this.milestone400 = true;
      this.showScriptureCard('"The Messiah had to suffer these things and enter his glory."');
    }
    if (!this.milestone600 && px > 600) {
      this.milestone600 = true;
      this.showScriptureCard(
        'The Hebrew word \'Shalom\' —\npeace, wholeness,\nnothing missing, nothing broken.',
      );
    }
    if (!this.milestone800 && px > 800) {
      this.milestone800 = true;
      this.showScriptureCard('"Were not our hearts burning within us while he talked with us on the road?"');
    }

    // Arrival at Emmaus — inn appears ahead
    if (!this.milestoneArrived && px > 850) {
      this.milestoneArrived = true;
      const arrivalLabel = this.add.text(160, 40, 'EMMAUS', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px', color: '#f5deb3', resolution: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      this.tweens.add({
        targets: arrivalLabel,
        alpha: 0,
        delay: 2000,
        duration: 800,
        onComplete: () => arrivalLabel.destroy(),
      });
    }

    // Bread breaking trigger
    if (!this.breadBreakingDone && px > 900) {
      this.triggerBreadBreaking();
    }
  }
}
