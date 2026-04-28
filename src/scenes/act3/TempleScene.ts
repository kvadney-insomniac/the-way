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
const MAP_H = 200;

export class TempleScene extends Phaser.Scene {
  constructor() { super({ key: 'TempleScene' }); }

  private player!: Player;
  private npcs: NPC[] = [];
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private sequenceTriggered = false;
  private transitioning = false;
  private scrollRoomQueued: string | null = null;

  create() {
    try {
      this.sequenceTriggered = false;
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
      fadeIn(this, 600);
      globalAudio.play('jerusalem', 1500);

      // Auto-sequence after 2s delay
      this.time.delayedCall(2000, () => this.triggerTempleSequence());

      // suppress unused import warnings
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
      console.error('TempleScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Background — grand stone
    g.fillStyle(0x2a2218);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Floor — polished stone
    g.fillStyle(0x3a3028);
    g.fillRect(0, 80, MAP_W, MAP_H - 80);
    // Floor tile pattern
    g.fillStyle(0x322818);
    for (let x = 0; x < MAP_W; x += 24) {
      for (let y = 80; y < MAP_H; y += 16) {
        g.fillRect(x, y, 22, 14);
      }
    }

    // Columns — 4 tall rectangles
    const columnXs = [40, 100, 220, 280];
    for (const cx of columnXs) {
      g.fillStyle(0x4a4030);
      g.fillRect(cx, 20, 12, 100);
      // Column capital
      g.fillStyle(0x5a5040);
      g.fillRect(cx - 3, 18, 18, 4);
      // Column base
      g.fillRect(cx - 3, 116, 18, 4);
    }

    // Ceiling
    g.fillStyle(0x1a1510);
    g.fillRect(0, 0, MAP_W, 20);
    // Ceiling beams
    g.fillStyle(0x2a2018);
    for (let x = 0; x < MAP_W; x += 40) {
      g.fillRect(x, 0, 20, 20);
    }

    // Money changers' tables
    g.fillStyle(0x7a5830);
    g.fillRect(60, 100, 60, 10);
    g.fillRect(180, 100, 60, 10);
    // Table legs
    g.fillStyle(0x5a4020);
    g.fillRect(62, 108, 6, 8);
    g.fillRect(108, 108, 6, 8);
    g.fillRect(182, 108, 6, 8);
    g.fillRect(228, 108, 6, 8);

    // Dove cages (circles) near tables
    g.fillStyle(0x8aaa6a);
    g.fillCircle(75, 92, 7);
    g.fillCircle(95, 94, 6);
    g.fillCircle(195, 92, 7);
    g.fillCircle(215, 94, 6);
    // Cage bars
    g.lineStyle(1, 0x5a7a3a, 0.8);
    g.strokeCircle(75, 92, 7);
    g.strokeCircle(195, 92, 7);

    // Scattered coins around tables
    g.fillStyle(0xd4a82a);
    const coinPositions = [
      [65,98],[72,96],[80,99],[88,97],[100,98],[105,97],
      [185,98],[192,96],[200,99],[208,97],[220,98],[228,97],
    ];
    for (const [cx, cy] of coinPositions) {
      g.fillCircle(cx, cy, 2);
    }

    // Archway exit at south
    g.fillStyle(0x5a4a38);
    g.fillRect(130, 168, 60, 32);
    g.fillStyle(0x1a120a);
    g.fillRect(138, 170, 44, 30);
    g.lineStyle(1, 0xc9a84c, 0.6);
    g.strokeRect(130, 168, 60, 32);

    // Wall torches / lamps
    g.fillStyle(0xff8030);
    g.fillCircle(20, 50, 4);
    g.fillCircle(300, 50, 4);
    // Glow
    g.fillStyle(0xff9040);
    g.fillCircle(20, 50, 2);
    g.fillCircle(300, 50, 2);
  }

  private createPlayer() {
    this.player = new Player(this, 160, 150);
  }

  private createNPCs() {
    const changer1   = new NPC(this, { key: 'pharisee', name: 'Money Changer', x: 80,  y: 90  });
    const changer2   = new NPC(this, { key: 'villager', name: 'Money Changer', x: 200, y: 90  });
    const poorWoman  = new NPC(this, { key: 'villager', name: 'Poor Woman',    x: 160, y: 140 });
    const jesus      = new NPC(this, { key: 'jesus',    name: 'Jesus',         x: 160, y: 60  });
    this.npcs = [changer1, changer2, poorWoman, jesus];
  }

  private triggerTempleSequence() {
    if (this.sequenceTriggered) return;
    this.sequenceTriggered = true;

    this.player.frozen = true;

    // Jesus speaks first
    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"My house shall be called a house of prayer, but you have made it a den of robbers."',
          nameColor: 0xf0c840,
        },
      ],
      onComplete: () => this.triggerMoneyChangerEncounter(),
    });
  }

  private triggerMoneyChangerEncounter() {
    let save = loadSave();
    this.encounter.start({
      npcName: 'Jesus',
      npcTextureKey: 'jesus',
      situation: 'Jesus confronts the money changers. Tables clatter. Doves burst free. What do you do?',
      onChoice: (action: EncounterAction, _s) => {
        save = applyEncounterChoice(save, action);

        if (action !== 'pass') {
          // Jesus and poor woman interact — widow's mite
          this.time.delayedCall(300, () => {
            this.dialogue.start({
              lines: [
                { speaker: 'Jesus', text: 'She gave everything she had.', nameColor: 0xf0c840 },
                { speaker: 'Poor Woman', text: '...it is all I have. But it is his.' },
              ],
              onComplete: () => {
                save = completeEpisode(save, 'woman_adultery'); // closest available episode key
                writeSave(save);
                this.scrollRoomQueued = 'scroll_temple';
              },
            });
          });
        } else {
          writeSave(save);
          this.scrollRoomQueued = 'scroll_temple';
        }
      },
    }, save);
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
    const label = this.add.text(160, 25, 'THE TEMPLE', {
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
      this.time.delayedCall(300, () => {
        this.scene.launch('ScrollRoomScene', { episodeKey: key });
        this.scene.pause();
      });
      return;
    }

    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }

    // Exit south → JerusalemScene
    if (!this.transitioning && this.player.y > 195) {
      this.transitioning = true;
      fadeToScene(this, 'JerusalemScene');
    }
  }

  private interactWith(npc: NPC) {
    if (npc.npcName === 'Jesus') {
      this.dialogue.start({
        lines: [
          { speaker: 'Jesus', text: 'Come to me, all who labor and are heavy laden.', nameColor: 0xf0c840 },
        ],
      });
    } else if (npc.npcName === 'Money Changer') {
      this.dialogue.start({
        lines: [
          { speaker: 'Money Changer', text: 'Best rates in the temple courts! Approved coins only inside.' },
        ],
      });
    } else if (npc.npcName === 'Poor Woman') {
      this.dialogue.start({
        lines: [
          { speaker: 'Poor Woman', text: "I have only two small coins left. But he gave everything for us, didn't he?" },
        ],
      });
    }
  }
}
