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
const MAP_H = 180;

export class UpperRoomScene extends Phaser.Scene {
  constructor() { super({ key: 'UpperRoomScene' }); }

  private player!: Player;
  private npcs: NPC[] = [];
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private supper1Done = false;
  private footWashingDone = false;
  private judas!: NPC;
  private transitioning = false;
  private scrollRoomQueued: string | null = null;

  create() {
    try {
      this.supper1Done = false;
      this.footWashingDone = false;
      this.transitioning = false;
      this.scrollRoomQueued = null;

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

      this.drawHUD();
      this.drawLocationLabel();
      fadeIn(this, 800);
      globalAudio.silence(1000);

      // Auto-sequence: after 1s, Jesus breaks bread
      this.time.delayedCall(1000, () => this.triggerBreadSequence());

      // suppress unused import warnings
      void fadeToScene;
      void holyFlash;
      void cosmicGlitch;
      void unlockEpisode;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('UpperRoomScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Background — warm stone
    g.fillStyle(0x1a1208);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Ceiling/upper wall
    g.fillStyle(0x120e07);
    g.fillRect(0, 0, MAP_W, 20);

    // Floor — wooden
    g.fillStyle(0x3a2818);
    g.fillRect(0, 60, MAP_W, MAP_H - 60);
    // Wooden planks
    g.fillStyle(0x2e2010);
    for (let x = 0; x < MAP_W; x += 20) {
      g.fillRect(x, 60, 18, MAP_H - 60);
    }
    g.fillStyle(0x3a2818);
    for (let y = 70; y < MAP_H; y += 24) {
      g.fillRect(0, y, MAP_W, 1);
    }

    // Long table center: x=40, y=70, w=240, h=16
    g.fillStyle(0x5a3a20);
    g.fillRect(40, 70, 240, 16);
    // Table legs
    g.fillStyle(0x3a2010);
    g.fillRect(44, 84, 8, 12);
    g.fillRect(112, 84, 8, 12);
    g.fillRect(200, 84, 8, 12);
    g.fillRect(268, 84, 8, 12);

    // Table cloth: x=42, y=68, w=236, h=14
    g.fillStyle(0xd4c090);
    g.fillRect(42, 68, 236, 14);
    // Cloth folds
    g.fillStyle(0xc4b080);
    g.fillRect(42, 70, 236, 2);
    g.fillRect(42, 74, 236, 1);

    // Bread on table at x=80,120,160,200,240, y=70
    g.fillStyle(0xd4a870);
    const breadX = [80, 120, 160, 200, 240];
    for (const bx of breadX) {
      g.fillRect(bx - 5, 69, 10, 5);
      // Bread highlights
      g.fillStyle(0xe4b880);
      g.fillRect(bx - 4, 69, 8, 2);
      g.fillStyle(0xd4a870);
    }

    // Cup in center — wine red
    g.fillEllipse(160, 72, 8, 12);
    g.fillStyle(0xb04020);
    g.fillEllipse(160, 72, 8, 12);
    g.fillStyle(0xd05030);
    g.fillEllipse(160, 70, 7, 5);

    // Oil lamps on walls — orange dots at corners
    const lampPositions = [[16, 30], [304, 30], [16, 140], [304, 140]];
    for (const [lx, ly] of lampPositions) {
      g.fillStyle(0xff8820);
      g.fillCircle(lx, ly, 5);
      g.fillStyle(0xffaa40);
      g.fillCircle(lx, ly, 2);
      // Warm glow
      g.fillStyle(0xff6610, 0.2);
      g.fillCircle(lx, ly, 12);
    }

    // Wall details — stone blocks
    g.fillStyle(0x221a10);
    for (let y = 0; y < 60; y += 14) {
      for (let x = 0; x < MAP_W; x += 28) {
        g.lineStyle(1, 0x2a2010, 0.5);
        g.strokeRect(x + ((y % 28 === 0) ? 0 : 14), y, 26, 12);
      }
    }

    // Tapestries on walls
    g.fillStyle(0x4a2a10);
    g.fillRect(50, 8, 20, 30);
    g.fillStyle(0x6a3a18);
    g.fillRect(52, 10, 16, 26);
    g.fillStyle(0x4a2a10);
    g.fillRect(250, 8, 20, 30);
    g.fillStyle(0x6a3a18);
    g.fillRect(252, 10, 16, 26);
  }

  private createPlayer() {
    this.player = new Player(this, 160, 145);
  }

  private createNPCs() {
    const jesus  = new NPC(this, { key: 'jesus',    name: 'Jesus',  x: 160, y: 50  });
    const peter  = new NPC(this, { key: 'peter',    name: 'Peter',  x: 80,  y: 90  });
    this.judas   = new NPC(this, { key: 'judas',    name: 'Judas',  x: 240, y: 90  });
    const andrew = new NPC(this, { key: 'andrew',   name: 'Andrew', x: 120, y: 90  });
    // Additional disciples as villagers
    const d1 = new NPC(this, { key: 'villager', name: 'Disciple', x: 200, y: 90 });
    const d2 = new NPC(this, { key: 'villager', name: 'Disciple', x: 50,  y: 90 });
    const d3 = new NPC(this, { key: 'villager', name: 'Disciple', x: 270, y: 90 });
    this.npcs = [jesus, peter, this.judas, andrew, d1, d2, d3];
  }

  private triggerBreadSequence() {
    this.player.frozen = true;

    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"Take, eat; this is my body."',
          nameColor: 0xf0c840,
        },
        {
          speaker: 'Jesus',
          text: '"Drink of it, all of you, for this is my blood of the covenant."',
          nameColor: 0xf0c840,
        },
      ],
      onComplete: () => this.triggerFootWashing(),
    });
  }

  private triggerFootWashing() {
    let save = loadSave();
    this.encounter.start({
      npcName: 'Jesus',
      npcTextureKey: 'jesus',
      situation: 'Jesus rises, takes a towel, and begins to wash the disciples\' feet. He moves toward you.',
      options: [
        { action: 'listen', label: 'RECEIVE',  description: 'Let him wash your feet' },
        { action: 'serve',  label: 'REFUSE',   description: 'You cannot let him do this' },
        { action: 'pray',   label: 'WEEP',     description: 'You are undone by this' },
        { action: 'pass',   label: 'FREEZE',   description: 'You cannot move' },
      ],
      onChoice: (action: EncounterAction, _s) => {
        save = applyEncounterChoice(save, action);
        writeSave(save);
        this.footWashingDone = true;
        this.handleFootWashingChoice(action);
      },
    }, save);
  }

  private handleFootWashingChoice(action: EncounterAction) {
    switch (action) {
      case 'listen':
        // RECEIVE
        this.dialogue.start({
          lines: [
            {
              speaker: 'Jesus',
              text: '"You do not understand now, but you will understand afterward."',
              nameColor: 0xf0c840,
            },
          ],
          onComplete: () => this.triggerJudasMoment(),
        });
        break;

      case 'serve':
        // REFUSE — then immediate receive
        this.dialogue.start({
          lines: [
            {
              speaker: 'Jesus',
              text: '"If I do not wash you, you have no share with me."',
              nameColor: 0xf0c840,
            },
          ],
          onComplete: () => {
            // Receive happens after refusal
            this.time.delayedCall(300, () => {
              this.dialogue.start({
                lines: [
                  {
                    speaker: 'Jesus',
                    text: '"You do not understand now, but you will understand afterward."',
                    nameColor: 0xf0c840,
                  },
                ],
                onComplete: () => this.triggerJudasMoment(),
              });
            });
          },
        });
        break;

      case 'pray':
        // WEEP — beautiful moment, camera flash gold
        this.cameras.main.flash(400, 240, 200, 80, true);
        this.time.delayedCall(500, () => {
          this.dialogue.start({
            lines: [
              {
                speaker: 'Jesus',
                text: '"You do not understand now, but you will understand afterward."',
                nameColor: 0xf0c840,
              },
            ],
            onComplete: () => this.triggerJudasMoment(),
          });
        });
        break;

      case 'pass':
        // FREEZE — Peter speaks
        this.dialogue.start({
          lines: [
            {
              speaker: 'Peter',
              text: '"Lord, not my feet only but also my hands and my head!"',
            },
          ],
          onComplete: () => this.triggerJudasMoment(),
        });
        break;
    }
  }

  private triggerJudasMoment() {
    let save = loadSave();
    this.dialogue.start({
      lines: [
        {
          speaker: 'Judas',
          text: 'Is it I, Lord?',
        },
      ],
      onComplete: () => {
        save = completeEpisode(save, 'last_supper');
        writeSave(save);
        this.scrollRoomQueued = 'scroll_last_supper';
      },
    });
  }

  private triggerJudasExit() {
    // Subtle music shift
    globalAudio.silence(800);

    // Judas walks to east edge and disappears
    this.tweens.add({
      targets: this.judas,
      x: MAP_W + 20,
      duration: 2000,
      ease: 'Power1',
      onComplete: () => {
        this.judas.setVisible(false);
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

    this.add.text(315, 4, 'Z: TALK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#5a4530', resolution: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D);
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 25, 'THE UPPER ROOM', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#f5deb3', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 2500,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked;

    this.dialogue.update(delta);
    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

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

    if (this.scrollRoomQueued) {
      const key = this.scrollRoomQueued;
      this.scrollRoomQueued = null;
      // After scroll room, Judas exits
      this.time.delayedCall(300, () => {
        this.triggerJudasExit();
        this.scene.launch('ScrollRoomScene', { episodeKey: key });
        this.scene.pause();
      });
      return;
    }

    // Allow talking to disciples if sequence not yet started
    if (!this.supper1Done && (justZ || justSpace)) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) {
        this.dialogue.start({
          lines: [
            { speaker: nearby.npcName, text: 'We are all here together. Something feels different tonight.' },
          ],
        });
      }
    }
  }
}
