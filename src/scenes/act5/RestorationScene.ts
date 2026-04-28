import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene, holyFlash, cosmicGlitch } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

// suppress unused imports
void unlockEpisode;
void fadeToScene;

const MAP_W = 320;
const MAP_H = 180;

export class RestorationScene extends Phaser.Scene {
  constructor() { super({ key: 'RestorationScene' }); }

  private player!: Player;
  private peter!: NPC;
  private jesus!: NPC;
  private andrew!: NPC;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private hudGraphics!: Phaser.GameObjects.Graphics;
  private hudTexts: Phaser.GameObjects.Text[] = [];

  private round = 0; // 0 = pre-start, 1/2/3 = rounds, 4 = fourth-wall
  private encounterDone = false;
  private endingStarted = false;
  private treeGraphics!: Phaser.GameObjects.Graphics;
  private fireGraphics!: Phaser.GameObjects.Graphics;
  private rippleTime = 0;

  create() {
    try {
      this.round = 0;
      this.encounterDone = false;
      this.endingStarted = false;

      this.buildMap();
      this.createNPCs();
      this.createPlayer();

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
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

      this.drawHUD();
      this.drawLocationLabel();

      fadeIn(this, 1200);
      globalAudio.play('sea', 1200);

      // Auto-start the three-questions sequence after 2s
      this.time.delayedCall(2000, () => {
        this.startRound1();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('RestorationScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics().setDepth(0);

    // Sky — soft pink-gold to blue, 40px
    g.fillGradientStyle(0xf0d080, 0xf0d080, 0x8ac8e8, 0x8ac8e8);
    g.fillRect(0, 0, MAP_W, 40);

    // Distant hills / horizon
    g.fillStyle(0x6a9a4a);
    g.fillEllipse(60, 68, 120, 30);
    g.fillEllipse(200, 65, 140, 28);
    g.fillEllipse(300, 70, 90, 22);

    // Beach — sandy
    g.fillStyle(0xdcba7a);
    g.fillRect(0, 68, MAP_W, 47);

    // Beach texture — subtle variation
    g.fillStyle(0xd0ae6e, 0.4);
    for (let bx = 5; bx < MAP_W; bx += 22) {
      g.fillEllipse(bx, 75 + Math.floor(Math.sin(bx * 0.15) * 4), 14, 5);
    }

    // Water — calm blue
    g.fillStyle(0x5a9ac8);
    g.fillRect(0, 115, MAP_W, MAP_H - 115);

    // Gentle ripple rows (static, animated in update)
    this.fireGraphics = this.add.graphics().setDepth(3);
    this.drawFire();

    // Boat silhouette at water edge
    g.fillStyle(0x2a2018);
    g.fillRect(120, 118, 50, 8);
    g.fillRect(124, 110, 8, 8);
    g.fillRect(144, 113, 6, 5);

    // Water ripple layer (will update each frame)
    // stored as scene member via a separate approach in update

    // Tree graphics layer (for ending sequence)
    this.treeGraphics = this.add.graphics().setDepth(90).setVisible(false);
  }

  private drawFire() {
    this.fireGraphics.clear();

    // Fire base glow
    const t = this.time ? this.time.now * 0.003 : 0;
    const flicker = Math.sin(t) * 0.2 + 0.8;

    this.fireGraphics.fillStyle(0xff8820, flicker);
    this.fireGraphics.fillCircle(160, 103, 6);
    this.fireGraphics.fillStyle(0xffcc44, flicker * 0.9);
    this.fireGraphics.fillCircle(160, 100, 4);
    this.fireGraphics.fillStyle(0xffffff, flicker * 0.5);
    this.fireGraphics.fillCircle(160, 98, 2);

    // Glow aura
    this.fireGraphics.fillStyle(0xff6600, 0.15 * flicker);
    this.fireGraphics.fillCircle(160, 103, 14);

    // Fish on fire — simple marks
    this.fireGraphics.fillStyle(0xb0805a);
    this.fireGraphics.fillEllipse(148, 108, 12, 4);
    this.fireGraphics.fillEllipse(167, 107, 10, 4);
  }

  private createNPCs() {
    this.peter  = new NPC(this, { key: 'peter',  name: 'Peter',  x: 80,  y: 95  });
    this.jesus  = new NPC(this, { key: 'jesus',  name: 'Jesus',  x: 160, y: 90  });
    this.andrew = new NPC(this, { key: 'andrew', name: 'Andrew', x: 240, y: 100 });
  }

  private createPlayer() {
    this.player = new Player(this, 120, 100);
    this.player.frozen = true; // frozen throughout most of this scene
  }

  private drawHUD() {
    const save = loadSave();
    const BAR_H = 18;
    const D = 201;

    this.hudGraphics = this.add.graphics().setScrollFactor(0).setDepth(200);
    this.hudGraphics.fillStyle(0x080604, 0.92);
    this.hudGraphics.fillRect(0, 0, 320, BAR_H);
    this.hudGraphics.lineStyle(1, 0xc9a84c, 0.5);
    this.hudGraphics.lineBetween(0, BAR_H, 320, BAR_H);

    const faithLevel = Math.min(save.faithLevel, 5);
    const faithLabel = this.add.text(5, 4, 'FAITH', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(D);
    this.hudTexts.push(faithLabel);

    for (let i = 0; i < 5; i++) {
      const filled = i < faithLevel;
      this.hudGraphics.fillStyle(filled ? 0xe05050 : 0x3a2020);
      this.hudGraphics.fillRect(45 + i * 9, 5, 7, 7);
    }

    const loveColor = save.love >= 10 ? '#f5c842' : save.love >= 5 ? '#88cc88' : '#c9a84c';
    const loveText = this.add.text(160, 4, `LOVE  ${save.love}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: loveColor, resolution: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D);
    this.hudTexts.push(loveText);

    const helpText = this.add.text(315, 4, 'Z: ANSWER', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#5a4530', resolution: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D);
    this.hudTexts.push(helpText);
  }

  private hideHUD() {
    this.tweens.add({ targets: this.hudGraphics, alpha: 0, duration: 600 });
    this.hudTexts.forEach(t => {
      this.tweens.add({ targets: t, alpha: 0, duration: 600 });
    });
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 25, 'SHORE OF GALILEE', {
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

  private startRound1() {
    this.round = 1;
    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"Simon, son of John, do you love me more than these?"',
          nameColor: '0xf0c840',
        },
        { speaker: 'Peter', text: '"Yes, Lord; you know that I love you."' },
        { speaker: 'Jesus', text: '"Feed my lambs."', nameColor: '0xf0c840' },
      ],
      onComplete: () => {
        this.time.delayedCall(1000, () => this.startRound2());
      },
    });
  }

  private startRound2() {
    this.round = 2;
    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"Simon, son of John, do you love me?"',
          nameColor: '0xf0c840',
        },
        { speaker: 'Peter', text: '"Yes, Lord; you know that I love you."' },
        { speaker: 'Jesus', text: '"Tend my sheep."', nameColor: '0xf0c840' },
      ],
      onComplete: () => {
        this.time.delayedCall(1000, () => this.startRound3());
      },
    });
  }

  private startRound3() {
    this.round = 3;
    // First, the third question to Peter
    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"Simon, son of John, do you love me?"',
          nameColor: '0xf0c840',
        },
      ],
      onComplete: () => {
        // PAUSE — 3 seconds of silence. Fire crackles. Then fourth-wall break.
        this.time.delayedCall(3000, () => {
          this.startFourthWallMoment();
        });
      },
    });
  }

  private startFourthWallMoment() {
    this.round = 4;
    const save = loadSave();
    const playerName = 'friend';

    // Hide HUD for the sacred moment
    this.hideHUD();

    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: `"${playerName}, do you love me?"`,
          nameColor: '0xf0c840',
        },
      ],
      onComplete: () => {
        this.startFinalEncounter();
      },
    });
  }

  private startFinalEncounter() {
    const save = loadSave();

    this.encounter.start({
      npcName: 'Jesus',
      npcTextureKey: 'jesus',
      situation: `He has asked you three times. The fire crackles. Peter weeps. And now he turns — and looks at you.\n\nYour record: ${save.love} acts of love.`,
      options: [
        { action: 'listen', label: 'YES, LORD',    description: 'You know that I love you.' },
        { action: 'serve',  label: 'I HAVE TRIED', description: 'Imperfectly. But I have tried.' },
        { action: 'pray',   label: 'LORD, YOU KNOW', description: 'You know all things. You know.' },
        { action: 'pass',   label: '...',           description: 'Silence. Tears. No words come.' },
      ],
      onChoice: (action: EncounterAction, s) => {
        const updatedSave = applyEncounterChoice(s, action);
        writeSave(updatedSave);
        this.encounterDone = true;
        this.time.delayedCall(400, () => {
          this.startGreatCommission();
        });
      },
    }, save);
  }

  private startGreatCommission() {
    this.dialogue.start({
      lines: [
        { speaker: 'Jesus', text: '"Feed my sheep."', nameColor: '0xf0c840' },
        {
          speaker: 'Jesus',
          text: '"Go therefore and make disciples of all nations... And behold, I am with you always, to the end of the age."',
          nameColor: '0xf0c840',
        },
      ],
      onComplete: () => {
        cosmicGlitch(this);
        this.time.delayedCall(500, () => {
          holyFlash(this);
          this.time.delayedCall(400, () => {
            this.startEndingSequence();
          });
        });
      },
    });
  }

  private startEndingSequence() {
    if (this.endingStarted) return;
    this.endingStarted = true;

    // Save completion
    let save = loadSave();
    save = completeEpisode(save, 'restoration_peter');
    writeSave(save);

    // Freeze everything
    this.player.frozen = true;

    // Show tree growing from mustard seed
    this.treeGraphics.setVisible(true);
    this.growTree();
  }

  private growTree() {
    const cx = 160;
    const cy = 90;
    const g = this.treeGraphics;

    // Stage 1: seed dot (0ms)
    g.clear();
    g.fillStyle(0xa0703a);
    g.fillCircle(cx, cy, 2);

    // Stage 2: stem (400ms)
    this.time.delayedCall(400, () => {
      g.fillStyle(0x5a8a30);
      g.fillRect(cx - 1, cy - 12, 2, 14);
    });

    // Stage 3: trunk widens (900ms)
    this.time.delayedCall(900, () => {
      g.fillStyle(0x7a5a2a);
      g.fillRect(cx - 2, cy - 20, 4, 22);
    });

    // Stage 4: branches spread (1600ms)
    this.time.delayedCall(1600, () => {
      g.fillStyle(0x6a8a30);
      // Main branches
      g.fillRect(cx - 18, cy - 28, 36, 3);
      g.fillRect(cx - 12, cy - 36, 24, 3);
      g.fillRect(cx - 6,  cy - 44, 12, 3);
      // Branch arms
      g.fillRect(cx - 18, cy - 28, 3, 10);
      g.fillRect(cx + 15, cy - 28, 3, 10);
    });

    // Stage 5: foliage fills in golden-green (2400ms)
    this.time.delayedCall(2400, () => {
      // Canopy
      g.fillStyle(0x78aa40);
      g.fillEllipse(cx, cy - 48, 60, 40);
      g.fillStyle(0x9ac840);
      g.fillEllipse(cx - 10, cy - 52, 30, 24);
      g.fillStyle(0x60c848);
      g.fillEllipse(cx + 12, cy - 50, 28, 22);
      // Golden highlights — Tree of Life
      g.fillStyle(0xf0d060, 0.5);
      g.fillEllipse(cx, cy - 54, 20, 16);
      g.fillStyle(0xffd840, 0.3);
      g.fillEllipse(cx + 8, cy - 58, 12, 10);

      // Fade to black after tree fully grown
      this.time.delayedCall(1000, () => {
        this.cameras.main.fadeOut(2000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.showEndCredits();
        });
      });
    });
  }

  private showEndCredits() {
    // Black background
    const bg = this.add.graphics().setScrollFactor(0).setDepth(500);
    bg.fillStyle(0x000000, 1);
    bg.fillRect(0, 0, MAP_W, MAP_H);

    const title = this.add.text(160, 70, 'The Way — v0.1', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#f5deb3', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501).setAlpha(0);

    const subtitle = this.add.text(160, 95, 'Thank you for walking with us.', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '9px', color: '#c9a84c', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501).setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 1500,
      onComplete: () => {
        this.tweens.add({
          targets: subtitle,
          alpha: 1,
          duration: 1500,
          delay: 500,
        });
      },
    });
  }

  update(_time: number, delta: number) {
    // Animate fire
    this.drawFire();

    // Animate water ripples
    this.rippleTime += delta;
    this.drawWaterRipples();

    this.dialogue.update(delta);
    this.encounter.update(delta);

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

    // NPC proximity checks (for visual only — scene is auto-driven)
    if (!this.encounterDone) {
      this.peter.checkProximity(this.player.x, this.player.y);
      this.jesus.checkProximity(this.player.x, this.player.y);
      this.andrew.checkProximity(this.player.x, this.player.y);
    }
  }

  private drawWaterRipples() {
    // We draw ripples on an overlay; use a lazy-created graphics object
    if (!this._rippleGraphics) {
      this._rippleGraphics = this.add.graphics().setDepth(1);
    }
    const g = this._rippleGraphics;
    g.clear();

    const t = this.rippleTime * 0.001;
    g.lineStyle(1, 0x7ab8e0, 0.3);

    for (let row = 0; row < 5; row++) {
      const y = 120 + row * 12;
      for (let col = 0; col < 8; col++) {
        const x = col * 40 + Math.sin(t + col * 0.8) * 6;
        g.lineBetween(x, y, x + 28, y);
      }
    }

    // Subtle shimmer
    g.fillStyle(0xa0d4f0, 0.06);
    for (let col = 0; col < 6; col++) {
      const sx = col * 50 + Math.sin(t * 1.3 + col) * 8;
      g.fillEllipse(sx + 25, 130, 20, 4);
    }
  }

  private _rippleGraphics?: Phaser.GameObjects.Graphics;
}
