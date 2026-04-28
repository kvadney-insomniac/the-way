import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene, holyFlash, cosmicGlitch } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

const MAP_W = 320;
const MAP_H = 240;

export class GethsemaneScene extends Phaser.Scene {
  constructor() { super({ key: 'GethsemaneScene' }); }

  private player!: Player;
  private npcs: NPC[] = [];
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Dozing mechanic state
  private dozeCount: number = 0;
  private dozed: boolean = false;
  private dozeTimer: number = 0;
  private playerAwake: boolean = true;

  // Scene flow state
  private introDialogueDone = false;
  private dozeSequenceActive = false;
  private dozeSequenceDone = false;
  private awakePromptText!: Phaser.GameObjects.Text;
  private awakePromptVisible = false;
  private awakeWindow = 0;
  private transitioning = false;
  private judas!: NPC;
  private peter!: NPC;
  private andrew!: NPC;
  private judasEntryDone = false;

  create() {
    try {
      this.dozeCount = 0;
      this.dozed = false;
      this.dozeTimer = 0;
      this.playerAwake = true;
      this.introDialogueDone = false;
      this.dozeSequenceActive = false;
      this.dozeSequenceDone = false;
      this.awakePromptVisible = false;
      this.awakeWindow = 0;
      this.transitioning = false;
      this.judasEntryDone = false;

      this.buildMap();
      this.createPlayer();
      this.createNPCs();

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

      // Awake prompt text — hidden until needed
      this.awakePromptText = this.add.text(160, 130, '[Press SPACE to stay awake]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px',
        color: '#c8b080',
        resolution: 3,
        backgroundColor: '#00000088',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(210).setAlpha(0);

      this.drawHUD();
      this.drawLocationLabel();
      fadeIn(this, 900);
      // No music — just silence and ambient darkness

      // Suppress unused import warnings
      void holyFlash;
      void cosmicGlitch;
      void unlockEpisode;
      void completeEpisode;
      void writeSave;
      void applyEncounterChoice;
      void loadSave;

      // Jesus opens with auto-dialogue 2 seconds after create
      this.time.delayedCall(2000, () => {
        this.dialogue.start({
          lines: [
            {
              speaker: 'Jesus',
              text: '"My soul is very sorrowful, even to death. Remain here and watch with me."',
              nameColor: '0xf0c840',
            },
          ],
          onComplete: () => {
            this.introDialogueDone = true;
            this.dozeSequenceActive = true;
            this.dozeTimer = 0;
          },
        });
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('GethsemaneScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Sky — very dark purple-black
    g.fillStyle(0x08060f);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Stars — 20 dim fixed points in upper 60px
    const starPositions = [
      [12, 8], [30, 15], [55, 5], [72, 22], [90, 10],
      [110, 18], [135, 4], [152, 28], [170, 12], [188, 6],
      [205, 20], [222, 9], [240, 30], [258, 14], [272, 3],
      [288, 25], [300, 11], [310, 40], [40, 45], [200, 50],
    ];
    g.fillStyle(0x504858, 0.7);
    for (const [sx, sy] of starPositions) {
      g.fillRect(sx, sy, 1, 1);
    }
    // A few slightly brighter
    g.fillStyle(0x706878, 0.9);
    g.fillRect(90, 10, 1, 1);
    g.fillRect(170, 12, 1, 1);
    g.fillRect(258, 14, 1, 1);

    // Moonlight shaft — subtle rectangle down from top-center
    g.fillStyle(0x1e2010, 0.3);
    g.fillRect(140, 0, 40, MAP_H);

    // Ground — dark olive garden, y=60 to 240
    g.fillStyle(0x1a1e0a);
    g.fillRect(0, 60, MAP_W, MAP_H - 60);

    // Stone path — dim, winding from south to center
    g.fillStyle(0x2a2418);
    // Winding path: south → center
    g.fillRect(148, 180, 24, 60);
    g.fillRect(144, 150, 22, 35);
    g.fillRect(150, 120, 18, 35);
    g.fillRect(154, 90, 14, 35);
    g.fillRect(152, 60, 16, 35);

    // Olive trees — 7 large dark silhouettes
    this.drawOliveTree(g, 30,  90);
    this.drawOliveTree(g, 80,  75);
    this.drawOliveTree(g, 50,  145);
    this.drawOliveTree(g, 240, 85);
    this.drawOliveTree(g, 290, 110);
    this.drawOliveTree(g, 270, 160);
    this.drawOliveTree(g, 120, 65);
  }

  private drawOliveTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Trunk
    g.fillStyle(0x0a0804);
    g.fillRect(x - 3, y, 6, 22);
    // Foliage — layered ellipses for gnarled olive shape
    g.fillStyle(0x0e1206);
    g.fillEllipse(x, y - 10, 36, 28);
    g.fillEllipse(x - 8, y - 4, 22, 18);
    g.fillEllipse(x + 8, y - 6, 20, 16);
    g.fillEllipse(x, y - 18, 24, 16);
  }

  private createPlayer() {
    this.player = new Player(this, 160, 190);
  }

  private createNPCs() {
    // Jesus — apart, near center-north, kneeling suggested (lower depth)
    const jesus = new NPC(this, { key: 'jesus', name: 'Jesus', x: 160, y: 80 });

    // Disciples — can talk before dozing
    this.peter  = new NPC(this, { key: 'peter',  name: 'Peter',  x: 100, y: 160 });
    this.andrew = new NPC(this, { key: 'andrew', name: 'Andrew', x: 130, y: 170 });

    // Judas — at the east edge, in shadow; starts non-interactable
    this.judas = new NPC(this, { key: 'judas', name: 'Judas', x: 280, y: 60 });
    // Make judas very dim initially — lurking in shadow
    this.judas.setAlpha(0.25);

    this.npcs = [jesus, this.peter, this.andrew, this.judas];
  }

  private drawHUD() {
    const save = loadSave();
    const BAR_H = 18;
    const D = 201;
    // Nearly invisible HUD — this scene should feel different
    const g = this.add.graphics().setScrollFactor(0).setDepth(200);

    g.fillStyle(0x080604, 0.35);
    g.fillRect(0, 0, 320, BAR_H);
    g.lineStyle(1, 0xc9a84c, 0.15);
    g.lineBetween(0, BAR_H, 320, BAR_H);

    const faithLevel = Math.min(save.faithLevel, 5);
    this.add.text(5, 4, 'FAITH', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(D).setAlpha(0.3);

    for (let i = 0; i < 5; i++) {
      const filled = i < faithLevel;
      g.fillStyle(filled ? 0xe05050 : 0x3a2020, 0.3);
      g.fillRect(45 + i * 9, 5, 7, 7);
    }

    const loveColor = save.love >= 10 ? '#f5c842' : save.love >= 5 ? '#88cc88' : '#c9a84c';
    this.add.text(160, 4, `LOVE  ${save.love}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: loveColor, resolution: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D).setAlpha(0.3);

    this.add.text(315, 4, 'Z: TALK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#5a4530', resolution: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D).setAlpha(0.25);
  }

  private drawLocationLabel() {
    // Appears and never fades — quiet title
    this.add.text(160, 25, 'GETHSEMANE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: '#3a3428', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
  }

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked || this.dozeSequenceDone;

    this.dialogue.update(delta);
    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

    const justZ     = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const justSpace = Phaser.Input.Keyboard.JustDown(this.spaceKey);

    if (this.dialogue.isActive) {
      if (justZ || justSpace) this.dialogue.advance();
      return;
    }

    if (this.encounter.isActive) {
      const up   = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);
      const down = Phaser.Input.Keyboard.JustDown(this.cursorKeys.down!);
      this.encounter.handleInput({ up, down, space: justSpace, enter: false });
      return;
    }

    // Doze sequence
    if (this.dozeSequenceActive && !this.dozeSequenceDone) {
      this.dozeTimer += delta;

      // Awake prompt window — player has 3000ms to press Space
      if (this.awakePromptVisible) {
        this.awakeWindow -= delta;

        if (justSpace || justZ) {
          // Player stayed awake
          this.playerAwake = true;
          this.awakePromptVisible = false;
          this.awakeWindow = 0;
          this.awakePromptText.setAlpha(0);
          // Brighten screen
          this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 600,
          });
          this.dozeTimer = 0;
          // Peter encourages
          this.time.delayedCall(400, () => {
            this.dialogue.start({
              lines: [
                { speaker: 'Peter', text: 'Lord... I will not deny you.' },
              ],
            });
          });
        } else if (this.awakeWindow <= 0) {
          // Fell asleep
          this.awakePromptVisible = false;
          this.awakeWindow = 0;
          this.awakePromptText.setAlpha(0);
          this.playerAwake = false;
          this.dozeCount++;
          this.dozeTimer = 0;

          if (this.dozeCount < 3) {
            // Jesus speaks
            this.time.delayedCall(200, () => {
              this.dialogue.start({
                lines: [
                  {
                    speaker: 'Jesus',
                    text: '"Could you not watch with me one hour?"',
                    nameColor: '0xf0c840',
                  },
                ],
              });
            });
          } else {
            // Third doze — "The hour has come"
            this.dozeSequenceDone = true;
            this.player.frozen = true;
            this.time.delayedCall(400, () => {
              this.dialogue.start({
                lines: [
                  {
                    speaker: 'Jesus',
                    text: '"The hour has come. See, my betrayer is at hand."',
                    nameColor: '0xf0c840',
                  },
                ],
                onComplete: () => {
                  this.beginJudasEntry();
                },
              });
            });
          }
        }
        return;
      }

      // Every 8 seconds, trigger a doze check
      if (this.dozeTimer >= 8000 && !this.awakePromptVisible) {
        this.dozeTimer = 0;
        this.playerAwake = false;
        this.awakePromptVisible = true;
        this.awakeWindow = 3000;

        // Dim the screen
        this.tweens.add({
          targets: this.cameras.main,
          alpha: 0.3,
          duration: 800,
        });

        // Show heavy-eyes text then awake prompt
        const drowsyText = this.add.text(160, 115, 'You feel your eyes growing heavy...', {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '8px', color: '#a09078', resolution: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(212).setAlpha(0);

        this.tweens.add({
          targets: drowsyText,
          alpha: 1,
          duration: 500,
          onComplete: () => {
            this.awakePromptText.setAlpha(1);
            this.time.delayedCall(2800, () => {
              this.tweens.add({
                targets: drowsyText,
                alpha: 0,
                duration: 300,
                onComplete: () => drowsyText.destroy(),
              });
            });
          },
        });
      }
    }

    // Interact with NPCs (before/during doze sequence but not after it completes)
    if (!this.dozeSequenceDone && (justZ || justSpace)) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }
  }

  private beginJudasEntry() {
    if (this.judasEntryDone) return;
    this.judasEntryDone = true;

    // Judas walks in from east — brighten him, animate x position
    this.judas.setAlpha(0.8);
    const startX = 310;
    this.judas.setX(startX);

    this.tweens.add({
      targets: this.judas,
      x: 220,
      duration: 2000,
      ease: 'Linear',
      onComplete: () => {
        // Judas speaks
        this.dialogue.start({
          lines: [
            { speaker: 'Judas', text: 'Rabbi!' },
          ],
          onComplete: () => {
            // Judas kisses Jesus — red flash
            this.cameras.main.flash(300, 80, 0, 0);
            this.time.delayedCall(500, () => {
              this.dialogue.start({
                lines: [
                  {
                    speaker: 'Jesus',
                    text: '"Friend, do what you came to do."',
                    nameColor: '0xf0c840',
                  },
                ],
                onComplete: () => {
                  this.scatterDisciples();
                },
              });
            });
          },
        });
      },
    });
  }

  private scatterDisciples() {
    // Crowd implied — screen flashes, disciples scatter
    this.cameras.main.flash(200, 40, 30, 20);

    const scatterText = this.add.text(160, 110, 'The disciples scatter into the dark.', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '8px', color: '#807060', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(212).setAlpha(0);

    this.tweens.add({
      targets: scatterText,
      alpha: 1,
      duration: 600,
    });

    // Fade Peter and Andrew out
    this.tweens.add({ targets: this.peter,  alpha: 0, duration: 1200, delay: 300 });
    this.tweens.add({ targets: this.andrew, alpha: 0, duration: 1200, delay: 500 });

    // Transition to PassionScene after 2 seconds
    this.time.delayedCall(2000, () => {
      if (!this.transitioning) {
        this.transitioning = true;
        fadeToScene(this, 'PassionScene');
      }
    });
  }

  private interactWith(npc: NPC) {
    if (npc.npcName === 'Jesus') {
      this.dialogue.start({
        lines: [
          {
            speaker: 'Jesus',
            text: '"My soul is very sorrowful, even to death. Remain here and watch with me."',
            nameColor: '0xf0c840',
          },
        ],
      });
    } else if (npc.npcName === 'Peter') {
      this.dialogue.start({
        lines: [
          { speaker: 'Peter', text: 'I will never leave you. Whatever happens.' },
          { speaker: 'Peter', text: 'Even if I must die with you.' },
        ],
      });
    } else if (npc.npcName === 'Andrew') {
      this.dialogue.start({
        lines: [
          { speaker: 'Andrew', text: "It's so dark out here. But I'll stay. I promise." },
        ],
      });
    }
    // Judas is not interactable in this path
  }
}
