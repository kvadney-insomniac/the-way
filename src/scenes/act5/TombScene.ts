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
void applyEncounterChoice;
void writeSave;
void fadeIn;

const MAP_W = 320;
const MAP_H = 180;

export class TombScene extends Phaser.Scene {
  constructor() { super({ key: 'TombScene' }); }

  private player!: Player;
  private jesusNPC!: NPC;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private dawnProgress = 0;
  private skyGraphics!: Phaser.GameObjects.Graphics;
  private flowerGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private hudTexts: Phaser.GameObjects.Text[] = [];

  private insideTomb = false;
  private tombDialogueDone = false;
  private jesusSpawned = false;
  private resurrectionDone = false;
  private transitioning = false;
  private marySpokeInitial = false;

  create() {
    try {
      this.insideTomb = false;
      this.tombDialogueDone = false;
      this.jesusSpawned = false;
      this.resurrectionDone = false;
      this.transitioning = false;
      this.marySpokeInitial = false;
      this.dawnProgress = 0;

      this.buildMap();
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

      // Very slow fade in — deep dark
      this.cameras.main.fadeIn(5000, 10, 8, 6);

      this.drawHUD();

      // Initial Mary dialogue after 3 seconds
      this.time.delayedCall(3000, () => {
        if (!this.marySpokeInitial) {
          this.marySpokeInitial = true;
          this.dialogue.start({
            lines: [
              {
                speaker: 'Mary',
                text: 'They have taken the Lord out of the tomb, and I do not know where they have laid him.',
              },
            ],
          });
        }
      });

      // Location label after dawn (4s delay)
      this.time.delayedCall(4000, () => {
        this.drawLocationLabel();
      });

      // No music track for Tomb — silence at dawn
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('TombScene.create error:', err);
    }
  }

  private buildMap() {
    // Sky — drawn each frame via dawnProgress, initialised dark
    this.skyGraphics = this.add.graphics().setDepth(0);

    // Static ground — garden path, stone
    const g = this.add.graphics().setDepth(1);

    // Ground
    g.fillStyle(0x3a2e22);
    g.fillRect(0, 80, MAP_W, MAP_H - 80);

    // Garden path — lighter sandy strip
    g.fillStyle(0x4e3e2c);
    g.fillRect(40, 100, 200, 20);

    // Rock hillside forming tomb area
    g.fillStyle(0x4a4038);
    g.fillRect(80, 40, 180, 80);
    g.fillRect(70, 50, 20, 70);
    g.fillRect(250, 45, 30, 75);
    // Extra rocks
    g.fillStyle(0x3e3530);
    g.fillRect(60, 60, 25, 40);
    g.fillRect(255, 55, 20, 35);

    // Tomb entrance opening
    g.fillStyle(0x1a1410);
    g.fillRect(120, 60, 80, 60);

    // Rolled-away stone — ellipse off to the right side
    g.fillStyle(0x5a5040);
    g.fillEllipse(230, 110, 38, 32);
    // Stone shadow
    g.fillStyle(0x3a3428, 0.6);
    g.fillEllipse(234, 114, 36, 10);

    // Flowers placeholder — will be drawn progressively
    this.flowerGraphics = this.add.graphics().setDepth(2);
  }

  private createPlayer() {
    this.player = new Player(this, 80, 105);
    this.player.frozen = true; // start frozen during fade-in
    // Un-freeze after initial fade
    this.time.delayedCall(5000, () => {
      this.player.frozen = false;
    });
  }

  private spawnJesusNPC() {
    if (this.jesusSpawned) return;
    this.jesusSpawned = true;
    this.jesusNPC = new NPC(this, { key: 'jesus', name: 'Jesus', x: 200, y: 120 });
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
    this.hudGraphics.setAlpha(0.2); // very low alpha initially

    const faithLevel = Math.min(save.faithLevel, 5);
    const faithLabel = this.add.text(5, 4, 'FAITH', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(D).setAlpha(0.2);
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
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D).setAlpha(0.2);
    this.hudTexts.push(loveText);

    const helpText = this.add.text(315, 4, 'Z: TALK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#5a4530', resolution: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D).setAlpha(0.2);
    this.hudTexts.push(helpText);
  }

  private revealHUD() {
    this.tweens.add({ targets: this.hudGraphics, alpha: 1, duration: 800 });
    this.hudTexts.forEach(t => {
      this.tweens.add({ targets: t, alpha: 1, duration: 800 });
    });
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 25, 'THE GARDEN TOMB', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: '#f5deb3', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      duration: 800,
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          delay: 2500,
          duration: 800,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  private enterTombSequence() {
    if (this.tombDialogueDone) return;
    this.tombDialogueDone = true;
    this.player.frozen = true;

    // Brief white flash
    this.cameras.main.flash(300, 255, 255, 255, true);

    this.time.delayedCall(400, () => {
      this.dialogue.start({
        lines: [
          { speaker: 'Mary', text: '...It is empty.' },
          {
            speaker: 'Angel',
            text: '"Why do you seek the living among the dead? He is not here — he is risen."',
            nameColor: '0xffffff',
          },
        ],
        onComplete: () => {
          this.player.frozen = false;
          this.insideTomb = false;
          // Spawn Jesus after Mary exits tomb
          this.time.delayedCall(1000, () => {
            this.spawnJesusNPC();
            this.startGardenerSequence();
          });
        },
      });
    });
  }

  private startGardenerSequence() {
    this.time.delayedCall(600, () => {
      this.dialogue.start({
        lines: [
          { speaker: 'Stranger', text: '"Woman, why are you weeping? Whom are you seeking?"' },
          {
            speaker: 'Mary',
            text: '"Sir, if you have carried him away, tell me where you have laid him."',
          },
          {
            speaker: 'Jesus',
            text: '"Mary."',
            nameColor: '0xf0c840',
          },
        ],
        onComplete: () => {
          this.triggerResurrectionMoment();
        },
      });
    });
  }

  private triggerResurrectionMoment() {
    if (this.resurrectionDone) return;
    this.resurrectionDone = true;

    cosmicGlitch(this);

    this.time.delayedCall(500, () => {
      holyFlash(this);

      // Dawn completes fully — sky goes bright gold
      this.dawnProgress = 1;

      this.revealHUD();

      this.time.delayedCall(600, () => {
        this.dialogue.start({
          lines: [
            { speaker: 'Mary', text: '"Rabboni!"' },
            {
              speaker: 'Jesus',
              text: '"Do not cling to me... but go to my brothers."',
              nameColor: '0xf0c840',
            },
          ],
          onComplete: () => {
            // Unlock resurrection episode
            let save = loadSave();
            save = unlockEpisode(save, 'empty_tomb');
            writeSave(save);

            this.time.delayedCall(2000, () => {
              if (!this.transitioning) {
                this.transitioning = true;
                fadeToScene(this, 'EmmausScene');
              }
            });
          },
        });
      });
    });
  }

  private updateSky() {
    const t = this.dawnProgress;
    // Lerp from dark (0x0a0808) to golden (0xf0c878)
    const r = Math.floor(0x0a + (0xf0 - 0x0a) * t);
    const gv = Math.floor(0x08 + (0xc8 - 0x08) * t);
    const b = Math.floor(0x08 + (0x78 - 0x08) * t);
    const color = (r << 16) | (gv << 8) | b;

    this.skyGraphics.clear();
    this.skyGraphics.fillStyle(color, 1);
    this.skyGraphics.fillRect(0, 0, MAP_W, 80);
  }

  private updateFlowers() {
    if (this.dawnProgress < 0.3) return;
    const progress = (this.dawnProgress - 0.3) / 0.7; // 0→1 after 30% dawn
    this.flowerGraphics.clear();

    const flowerPositions = [
      [50, 98], [70, 102], [100, 95], [130, 99], [155, 97],
      [175, 101], [200, 96], [220, 100], [245, 98], [260, 103],
    ];

    const colors = [0xff8888, 0xffcc88, 0xffffff, 0xffaacc, 0x88ffcc];

    for (let i = 0; i < Math.floor(flowerPositions.length * progress); i++) {
      const [fx, fy] = flowerPositions[i];
      this.flowerGraphics.fillStyle(colors[i % colors.length], 1);
      this.flowerGraphics.fillRect(fx, fy, 2, 2);
      // Stem
      this.flowerGraphics.fillStyle(0x448844, 1);
      this.flowerGraphics.fillRect(fx + 1, fy + 2, 1, 3);
    }
  }

  update(_time: number, delta: number) {
    // Advance dawn over 6 seconds from scene start
    if (this.dawnProgress < 1) {
      this.dawnProgress = Math.min(1, this.dawnProgress + delta / 6000);
    }
    this.updateSky();
    this.updateFlowers();

    this.dialogue.update(delta);
    this.encounter.update(delta);

    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked || this.resurrectionDone && this.transitioning;

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

    // Check if player enters tomb
    if (!this.tombDialogueDone && !this.insideTomb) {
      if (
        this.player.x >= 120 && this.player.x <= 200 &&
        this.player.y >= 60  && this.player.y <= 110
      ) {
        this.insideTomb = true;
        this.enterTombSequence();
      }
    }

    // Interact with Jesus NPC after spawn
    if (this.jesusSpawned && this.jesusNPC && !this.resurrectionDone) {
      this.jesusNPC.checkProximity(this.player.x, this.player.y);
    }
  }
}
