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

export class JerusalemScene extends Phaser.Scene {
  constructor() { super({ key: 'JerusalemScene' }); }

  private player!: Player;
  private npcs: NPC[] = [];
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private phariseeEncounterDone = false;
  private transitioning = false;
  private scrollRoomQueued: string | null = null;

  create() {
    try {
      this.phariseeEncounterDone = false;
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

      // suppress unused import warnings
      void holyFlash;
      void cosmicGlitch;
      void unlockEpisode;
      void completeEpisode;
      void writeSave;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('JerusalemScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Sky — azure blue gradient
    g.fillGradientStyle(0x4a90d0, 0x4a90d0, 0x8ec8f0, 0x8ec8f0);
    g.fillRect(0, 0, MAP_W, 30);

    // Ground — warm Jerusalem limestone
    g.fillStyle(0xd4c090);
    g.fillRect(0, 30, MAP_W, MAP_H - 30);

    // Temple mount background — tall rectangle at top center
    g.fillStyle(0x9a8060);
    g.fillRect(80, 30, 160, 50);
    // Temple detail — columns hint
    g.fillStyle(0xb0986e);
    for (let cx = 90; cx <= 220; cx += 20) {
      g.fillRect(cx, 30, 6, 50);
    }
    // Temple roof
    g.fillStyle(0x7a6040);
    g.fillRect(76, 28, 168, 6);

    // Stone road down center — 40px wide
    g.fillStyle(0xb8a878);
    g.fillRect(140, 30, 40, MAP_H - 30);
    // Road cobblestone marks
    g.fillStyle(0xa89868);
    for (let y = 35; y < MAP_H; y += 14) {
      g.fillRect(142, y, 10, 5);
      g.fillRect(158, y + 7, 9, 5);
    }

    // Crowd of implied NPCs — 40 small ellipses scattered across y=80-180
    g.fillStyle(0xd4a870);
    const crowdPositions = [
      [30,90],[50,100],[45,120],[60,130],[35,145],[80,85],[90,110],[85,140],
      [100,155],[110,90],[105,125],[115,165],[120,85],[125,170],[130,100],
      [195,88],[200,115],[210,95],[220,130],[230,90],[225,150],[240,105],
      [250,120],[255,85],[260,145],[270,100],[275,130],[280,160],[285,95],
      [290,115],[295,140],[300,85],[305,110],[310,135],[315,95],[60,170],
      [70,165],[95,175],[200,170],[250,175],
    ];
    for (const [cx, cy] of crowdPositions) {
      g.fillEllipse(cx, cy, 6, 4);
    }

    // Palm branches scattered on ground
    g.fillStyle(0x5a8a30);
    const palmPositions = [
      [50,140],[75,155],[130,120],[170,110],[190,145],[220,135],[260,155],
    ];
    for (const [px, py] of palmPositions) {
      g.fillRect(px, py, 10, 2);
      g.fillRect(px + 2, py - 2, 6, 1);
      g.fillRect(px + 4, py + 2, 6, 1);
    }

    // City walls (sides)
    g.fillStyle(0xb09870);
    g.fillRect(0, 30, 20, MAP_H - 30);
    g.fillRect(300, 30, 20, MAP_H - 30);

    // Archways in walls
    g.fillStyle(0x1a120a);
    g.fillRect(4, 80, 16, 30);
    g.fillRect(300, 80, 16, 30);
  }

  private createPlayer() {
    this.player = new Player(this, 160, 140);
  }

  private createNPCs() {
    const judas    = new NPC(this, { key: 'judas',    name: 'Judas',    x: 100, y: 100 });
    const peter    = new NPC(this, { key: 'peter',    name: 'Peter',    x: 160, y: 80  });
    const pharisee = new NPC(this, { key: 'pharisee', name: 'Pharisee', x: 240, y: 120 });
    const v1       = new NPC(this, { key: 'villager', name: 'Villager', x: 60,  y: 140 });
    const v2       = new NPC(this, { key: 'villager', name: 'Villager', x: 200, y: 130 });
    const v3       = new NPC(this, { key: 'villager', name: 'Villager', x: 280, y: 110 });
    this.npcs = [judas, peter, pharisee, v1, v2, v3];
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
    const label = this.add.text(160, 25, 'JERUSALEM', {
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

    // Scene exits
    if (!this.transitioning) {
      // North exit → TempleScene
      if (this.player.y < 30 && this.player.x >= 120 && this.player.x <= 200) {
        this.transitioning = true;
        fadeToScene(this, 'TempleScene');
      }
      // South exit → CapernaumScene (placeholder)
      if (this.player.y > MAP_H - 4) {
        this.transitioning = true;
        fadeToScene(this, 'CapernaumScene');
      }
    }
  }

  private interactWith(npc: NPC) {
    let save = loadSave();

    if (npc.npcName === 'Judas') {
      this.dialogue.start({
        lines: [
          { speaker: 'Judas', text: 'Look at them all. If we play this right, he could take the throne.' },
          { speaker: 'Judas', text: "I've been... thinking. About what's best for everyone." },
        ],
      });
    } else if (npc.npcName === 'Pharisee') {
      if (!this.phariseeEncounterDone) {
        this.encounter.start({
          npcName: 'Pharisee',
          npcTextureKey: 'pharisee',
          situation: 'A Pharisee demands Jesus silence the crowd. The air crackles with tension.',
          onChoice: (action: EncounterAction, _s) => {
            save = applyEncounterChoice(save, action);
            writeSave(save);
            this.phariseeEncounterDone = true;
            // Pharisee storms off — dialogue from Peter
            this.time.delayedCall(400, () => {
              this.dialogue.start({
                lines: [
                  { speaker: 'Peter', text: '"If these were silent, the very stones would cry out."' },
                ],
              });
            });
          },
        }, save);
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Pharisee', text: 'Tell your disciples to be quiet!' }],
        });
      }
    } else if (npc.npcName === 'Peter') {
      this.dialogue.start({
        lines: [
          { speaker: 'Peter', text: 'Can you hear them? The whole city is watching.' },
        ],
      });
    } else {
      this.dialogue.start({
        lines: [{ speaker: 'Villager', text: 'Hosanna! Blessed is he who comes in the name of the Lord!' }],
      });
    }
  }
}
