import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

const MAP_W = 320;
const MAP_H = 240;

export class MountainScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private beatitudesMet: Set<string> = new Set();
  private jesusSpoke = false;
  private sermonComplete = false;
  private transitioning = false;
  private scrollRoomQueued: string | null = null;

  constructor() {
    super({ key: 'MountainScene' });
  }

  create() {
    try {
      this.beatitudesMet = new Set();
      this.jesusSpoke = false;
      this.sermonComplete = false;
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
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

      this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

      this.drawHUD();
      this.drawLocationLabel();
      fadeIn(this, 600);
      globalAudio.play('sea', 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('MountainScene.create error:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------------

  private buildMap() {
    const g = this.add.graphics();

    // Sky gradient (top: 0x6ab8e8, bottom: 0xe8d880)
    g.fillGradientStyle(0x6ab8e8, 0x6ab8e8, 0xe8d880, 0xe8d880);
    g.fillRect(0, 0, MAP_W, 40);

    // Distant water strip — horizon line
    g.fillStyle(0x4a88c8);
    g.fillRect(0, 38, MAP_W, 8);
    // Water shimmer
    g.fillStyle(0x6aaad8);
    for (let x = 0; x < MAP_W; x += 20) {
      g.fillRect(x, 40, 14, 2);
      g.fillRect(x + 10, 43, 10, 1);
    }

    // Upper green hillside (0x5a8a3a), y=44, h=80
    g.fillStyle(0x5a8a3a);
    g.fillRect(0, 44, MAP_W, 80);

    // Lower golden grass (0xc8a850), y=124, h=116
    g.fillStyle(0xc8a850);
    g.fillRect(0, 124, MAP_W, 116);

    // Subtle green/gold grass texture
    g.fillStyle(0x4a7a2a);
    for (let x = 0; x < MAP_W; x += 16) {
      for (let y = 48; y < 120; y += 12) {
        g.fillRect(x + (y % 16 === 0 ? 4 : 0), y, 5, 2);
      }
    }
    g.fillStyle(0xb89840);
    for (let x = 0; x < MAP_W; x += 18) {
      for (let y = 128; y < 230; y += 14) {
        g.fillRect(x + (y % 18 === 0 ? 6 : 0), y, 6, 2);
      }
    }

    // Path of rough stone (0x9a8860) — center, meandering up
    g.fillStyle(0x9a8860);
    g.fillRect(140, 44, 40, 80);   // upper path segment
    g.fillStyle(0x8a7850);
    g.fillRect(130, 124, 60, 116); // widens at bottom

    // Path stones/texture
    g.fillStyle(0xb09870);
    for (let y = 50; y < 230; y += 14) {
      g.fillRect(144, y, 10, 6);
      g.fillRect(158, y + 7, 9, 5);
    }

    // Wildflowers scattered across green area
    const flowerColors = [0xf0c0a0, 0xe05050, 0xf0e840];
    const flowerPositions = [
      [20, 55], [45, 70], [80, 50], [110, 65], [200, 52], [230, 68],
      [260, 57], [290, 75], [35, 90], [95, 100], [185, 85], [270, 95],
      [15, 110], [120, 105], [305, 60], [250, 44], [60, 48],
    ];
    flowerPositions.forEach(([fx, fy], i) => {
      g.fillStyle(flowerColors[i % flowerColors.length]);
      g.fillRect(fx, fy, 2, 2);
    });

    // Rocks
    g.fillStyle(0x9a9080);
    g.fillEllipse(30, 130, 14, 8);
    g.fillEllipse(285, 140, 18, 10);
    g.fillEllipse(70, 160, 10, 6);
    g.fillEllipse(240, 90, 12, 7);
    g.fillEllipse(120, 140, 16, 9);
    g.fillEllipse(310, 100, 10, 6);
    g.fillStyle(0x8a8070);
    g.fillEllipse(55, 170, 8, 5);
    g.fillEllipse(195, 120, 14, 8);

    // Olive trees
    this.drawTree(g, 25,  60);
    this.drawTree(g, 290, 55);
    this.drawTree(g, 100, 46);
    this.drawTree(g, 215, 70);

    // Distant hills silhouette (far background, lower depth)
    g.fillStyle(0x7aaa5a, 0.4);
    g.fillEllipse(50, 44, 120, 30);
    g.fillEllipse(260, 44, 140, 25);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x5a3a1a);
    g.fillRect(x - 1, y, 3, 10);
    g.fillStyle(0x4a7a2a);
    g.fillEllipse(x, y - 3, 14, 10);
    g.fillEllipse(x - 5, y, 9, 7);
    g.fillEllipse(x + 5, y, 9, 7);
    g.fillStyle(0x3a6a1a);
    g.fillEllipse(x + 2, y - 5, 9, 7);
  }

  // ---------------------------------------------------------------------------
  // Player & NPCs
  // ---------------------------------------------------------------------------

  private createPlayer() {
    this.player = new Player(this, 160, 220);
  }

  private createNPCs() {
    // Jesus at top of hill
    const jesus = new NPC(this, { key: 'jesus', name: 'Jesus', x: 160, y: 60, interactRadius: 30 });

    // 8 Beatitude characters
    const beggar    = new NPC(this, { key: 'villager', name: 'Beggar',   x: 60,  y: 180 });
    const widow     = new NPC(this, { key: 'woman',    name: 'Widow',    x: 100, y: 160 });
    const child     = new NPC(this, { key: 'child',    name: 'Child',    x: 50,  y: 140 });
    const scribe    = new NPC(this, { key: 'villager', name: 'Scribe',   x: 250, y: 170 });
    const merchant  = new NPC(this, { key: 'villager', name: 'Merchant', x: 280, y: 150 });
    const shepherd  = new NPC(this, { key: 'villager', name: 'Shepherd', x: 220, y: 200 });
    const pharisee  = new NPC(this, { key: 'pharisee', name: 'Angry Man',  x: 160, y: 190 });
    const bystander = new NPC(this, { key: 'villager', name: 'Bystander',  x: 175, y: 190 });
    const follower  = new NPC(this, { key: 'villager', name: 'Follower', x: 300, y: 120 });

    // Crowd fill — atmosphere NPCs arranged in arcs
    const crowd: NPC[] = [
      new NPC(this, { key: 'villager', name: 'Listener', x: 80,  y: 120, interactRadius: 14 }),
      new NPC(this, { key: 'villager', name: 'Listener', x: 130, y: 110, interactRadius: 14 }),
      new NPC(this, { key: 'woman',    name: 'Listener', x: 190, y: 115, interactRadius: 14 }),
      new NPC(this, { key: 'villager', name: 'Listener', x: 240, y: 130, interactRadius: 14 }),
      new NPC(this, { key: 'villager', name: 'Listener', x: 70,  y: 200, interactRadius: 14 }),
      new NPC(this, { key: 'woman',    name: 'Listener', x: 200, y: 220, interactRadius: 14 }),
      new NPC(this, { key: 'child',    name: 'Listener', x: 270, y: 185, interactRadius: 14 }),
      new NPC(this, { key: 'villager', name: 'Listener', x: 310, y: 155, interactRadius: 14 }),
    ];

    this.npcs = [
      jesus, beggar, widow, child, scribe,
      merchant, shepherd, pharisee, bystander, follower,
      ...crowd,
    ];
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private drawHUD() {
    const save = loadSave();
    const BAR_H = 18;
    const D = 201;
    const g = this.add.graphics().setScrollFactor(0).setDepth(200);

    g.fillStyle(0x080604, 0.92);
    g.fillRect(0, 0, MAP_W, BAR_H);
    g.lineStyle(1, 0xc9a84c, 0.5);
    g.lineBetween(0, BAR_H, MAP_W, BAR_H);

    const faithLevel = Math.min(save.faithLevel, 5);
    this.add.text(5, 4, 'FAITH', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(D);
    for (let i = 0; i < 5; i++) {
      const filled = i < faithLevel;
      g.fillStyle(filled ? 0xe05050 : 0x3a2020);
      g.fillRect(45 + i * 9, 5, 7, 7);
      if (filled) {
        g.lineStyle(1, 0xff8080, 0.6);
        g.strokeRect(45 + i * 9, 5, 7, 7);
      }
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
    const label = this.add.text(160, 25, 'THE MOUNT OF BEATITUDES', {
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

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------

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

    // Scroll Room queued
    if (this.scrollRoomQueued) {
      const key = this.scrollRoomQueued;
      this.scrollRoomQueued = null;
      this.time.delayedCall(300, () => {
        this.scene.launch('ScrollRoomScene', { episodeKey: key });
        this.scene.pause();
      });
      return;
    }

    // Interact
    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }

    // South exit → CapernaumScene
    if (!this.transitioning && this.player.y > 235) {
      this.transitioning = true;
      fadeToScene(this, 'CapernaumScene');
    }
  }

  // ---------------------------------------------------------------------------
  // Interaction dispatch
  // ---------------------------------------------------------------------------

  private interactWith(npc: NPC) {
    switch (npc.npcName) {
      case 'Jesus':     return this.interactJesus();
      case 'Beggar':    return this.interactBeggar(npc);
      case 'Widow':     return this.interactWidow(npc);
      case 'Child':     return this.interactChild(npc);
      case 'Scribe':    return this.interactScribe(npc);
      case 'Merchant':  return this.interactMerchant(npc);
      case 'Shepherd':  return this.interactShepherd(npc);
      case 'Angry Man': return this.interactPeacemaker(npc);
      case 'Bystander': return this.interactPeacemaker(npc);
      case 'Follower':  return this.interactFollower(npc);
      case 'Listener':  return this.interactListener();
      default:          return this.interactListener();
    }
  }

  // ---------------------------------------------------------------------------
  // Jesus
  // ---------------------------------------------------------------------------

  private interactJesus() {
    if (this.jesusSpoke) {
      this.dialogue.start({
        lines: [
          { speaker: 'Jesus', text: 'Go. Meet those on this hillside who live these words.', nameColor: '0xf0c840' },
        ],
      });
      return;
    }
    this.jesusSpoke = true;
    this.dialogue.start({
      lines: [
        { speaker: 'Jesus', text: '"Blessed are the poor in spirit, for theirs is the kingdom of heaven."', nameColor: '0xf0c840' },
        { speaker: 'Jesus', text: '"Blessed are those who mourn, for they shall be comforted."', nameColor: '0xf0c840' },
        { speaker: 'Jesus', text: '"Blessed are the meek, for they shall inherit the earth."', nameColor: '0xf0c840' },
        { speaker: 'Jesus', text: 'Go. Meet those on this hillside who live these words.', nameColor: '0xf0c840' },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Beatitude 1 — Beggar (poor in spirit)
  // ---------------------------------------------------------------------------

  private interactBeggar(npc: NPC) {
    if (this.beatitudesMet.has('Beggar')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'God bless you for stopping.' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'A beggar sits alone at the edge of the crowd. His robe is torn.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'listen':
            lines = [{ speaker: 'Beggar', text: 'I have nothing. But somehow... I feel like I belong here.' }];
            break;
          case 'serve':
            lines = [
              { speaker: 'You',   text: '(You share your bread with him.)' },
              { speaker: 'Beggar', text: "I haven't eaten since yesterday. God bless you." },
            ];
            break;
          case 'pray':
            lines = [{ speaker: 'Beggar', text: '...Thank you. I felt that.' }];
            break;
          default:
            lines = [{ speaker: 'Beggar', text: '(He watches you walk away, saying nothing.)' }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Beggar'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 2 — Widow (those who mourn)
  // ---------------------------------------------------------------------------

  private interactWidow(npc: NPC) {
    if (this.beatitudesMet.has('Widow')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'He said we will be comforted. I believe that now.' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'An old woman weeps quietly, holding a small clay lamp.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'listen':
            lines = [
              { speaker: 'Widow', text: 'My husband died last spring.' },
              { speaker: 'Widow', text: 'I came because I heard this teacher says the mourners will be comforted.' },
            ];
            break;
          case 'pray':
            lines = [
              { speaker: 'Widow', text: 'Will you... pray with me?' },
              { speaker: 'You',   text: '(You bow your head beside her. She reaches for your hand.)' },
              { speaker: 'Widow', text: '...Thank you. I feel less alone.' },
            ];
            break;
          case 'serve':
            lines = [
              { speaker: 'You',  text: '(You sit beside her in silence.)' },
              { speaker: 'Widow', text: 'Just having someone near... it helps.' },
            ];
            break;
          default:
            lines = [{ speaker: 'Widow', text: '(She wipes her tears and looks away.)' }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Widow'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 3 — Child (the meek)
  // ---------------------------------------------------------------------------

  private interactChild(npc: NPC) {
    if (this.beatitudesMet.has('Child')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'I can see everything from up here!' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'A small child is being pushed aside by adults trying to get closer.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'serve':
            lines = [
              { speaker: 'You',   text: '(You lift the child up so she can see over the crowd.)' },
              { speaker: 'Child', text: "Thank you! I couldn't see a thing." },
              { speaker: 'You',   text: '(The crowd parts slightly, making room.)' },
            ];
            break;
          case 'listen':
            lines = [{ speaker: 'Child', text: "Nobody moves for me. I'm too small. Can you help?" }];
            break;
          case 'pray':
            lines = [{ speaker: 'Child', text: 'Is God listening to us right now?' }];
            break;
          default:
            lines = [{ speaker: 'Child', text: '(She stands on her toes, still unable to see.)' }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Child'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 4 — Scribe (hunger for righteousness)
  // ---------------------------------------------------------------------------

  private interactScribe(npc: NPC) {
    if (this.beatitudesMet.has('Scribe')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: "I'm filling my third scroll. I don't want to miss a word." }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'A young scribe writes furiously, trying to capture every word.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'listen':
            lines = [
              { speaker: 'Scribe', text: "I've studied Torah for ten years." },
              { speaker: 'Scribe', text: "But this man teaches like he wrote it himself." },
            ];
            break;
          case 'serve':
            lines = [
              { speaker: 'You',   text: '(You hold the inkpot steady for him as he writes.)' },
              { speaker: 'Scribe', text: 'Blessed are those who hunger and thirst for righteousness... yes, that is exactly it.' },
            ];
            break;
          case 'pray':
            lines = [{ speaker: 'Scribe', text: 'Pray that I capture this faithfully. These words must be remembered.' }];
            break;
          default:
            lines = [{ speaker: 'Scribe', text: '(He does not look up from his writing.)' }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Scribe'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 5 — Merchant (the merciful)
  // ---------------------------------------------------------------------------

  private interactMerchant(npc: NPC) {
    if (this.beatitudesMet.has('Merchant')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'Mercy is better for business anyway, I think.' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'A merchant is arguing with a debtor. The amount is small.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'serve':
            lines = [
              { speaker: 'You',     text: '(You offer to mediate between them.)' },
              { speaker: 'Merchant', text: "You know what... forget the debt. I've heard enough today." },
              { speaker: 'Debtor',  text: '(The debtor stares in disbelief, then bows deeply.)' },
            ];
            break;
          case 'listen':
            lines = [
              { speaker: 'Merchant', text: "He owes me three denarii. Three! But listening to this teacher..." },
              { speaker: 'Merchant', text: 'Blessed are the merciful. Maybe I can afford to be merciful today.' },
            ];
            break;
          case 'pray':
            lines = [
              { speaker: 'You',     text: '(You pray quietly for both men.)' },
              { speaker: 'Merchant', text: "...I'll give him until next week. No interest." },
            ];
            break;
          default:
            lines = [{ speaker: 'Merchant', text: 'Three denarii! Do you hear me? Three!' }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Merchant'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 6 — Shepherd (pure in heart)
  // ---------------------------------------------------------------------------

  private interactShepherd(npc: NPC) {
    if (this.beatitudesMet.has('Shepherd')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'Still thinking about what he said. Every word of it.' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'A shepherd stands apart, watching his sheep on the lower slope.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'listen':
            lines = [
              { speaker: 'Shepherd', text: "I'm not educated. Never studied the law." },
              { speaker: 'Shepherd', text: "But when he speaks, I understand every word somehow." },
            ];
            break;
          case 'serve':
            lines = [
              { speaker: 'You',      text: '(You stand beside him and watch the flock together.)' },
              { speaker: 'Shepherd', text: 'Blessed are the pure in heart, for they shall see God. I wonder... is that me?' },
            ];
            break;
          case 'pray':
            lines = [
              { speaker: 'Shepherd', text: "I haven't prayed much. Always figured God had no time for shepherds." },
              { speaker: 'Shepherd', text: 'But this teacher... he makes me think otherwise.' },
            ];
            break;
          default:
            lines = [{ speaker: 'Shepherd', text: "(He keeps his eyes on the flock. 'Just passing through, then.')" }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Shepherd'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 7 — Peacemaker (two men almost fighting)
  // ---------------------------------------------------------------------------

  private interactPeacemaker(npc: NPC) {
    if (this.beatitudesMet.has('Peacemaker')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'Good thing you stepped in when you did.' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: 'Two Men',
      situation: 'Two men at the edge of the crowd are on the verge of a fight — voices raised, fists clenched.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'serve':
            lines = [
              { speaker: 'You',      text: '(You step between the two men. Both go tense.)' },
              { speaker: 'You',      text: '(A long, silent pause on the hillside.)' },
              { speaker: 'Angry Man', text: '...(He exhales slowly and steps back.)' },
              { speaker: 'Bystander', text: '...(The other man nods and turns away.)' },
            ];
            break;
          case 'listen':
            lines = [
              { speaker: 'Angry Man', text: "He insulted my family name in front of everyone!" },
              { speaker: 'Bystander', text: "I only told the truth!" },
              { speaker: 'You',       text: '(Both men look at each other, then at the teacher above.)' },
            ];
            break;
          case 'pray':
            lines = [
              { speaker: 'You',       text: '(You bow your head and pray quietly between them.)' },
              { speaker: 'Angry Man', text: '(He pauses mid-shout, confused, then embarrassed.)' },
              { speaker: 'Bystander', text: 'Maybe... we can settle this another time.' },
            ];
            break;
          default:
            lines = [
              { speaker: 'Angry Man', text: 'STAY OUT OF THIS!' },
              { speaker: 'You',       text: '(You move away. The argument escalates.)' },
            ];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Peacemaker'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Beatitude 8 — Follower (persecuted)
  // ---------------------------------------------------------------------------

  private interactFollower(npc: NPC) {
    if (this.beatitudesMet.has('Follower')) {
      this.dialogue.start({ lines: [{ speaker: npc.npcName, text: 'Worth every bruise to hear him speak.' }] });
      return;
    }
    const save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: 'A man with bruises on his face stands quietly at the edge — beaten yesterday for following Jesus.',
      onChoice: (action: EncounterAction) => {
        applyEncounterChoice(save, action);
        let lines: Array<{ speaker: string; text: string }>;
        switch (action) {
          case 'pray':
            lines = [
              { speaker: 'You',     text: '(You lay a hand on his shoulder and pray for him.)' },
              { speaker: 'Follower', text: 'Thank you. I needed someone to see.' },
              { speaker: 'Follower', text: '...Blessed are those who are persecuted for righteousness. He said that too.' },
            ];
            break;
          case 'listen':
            lines = [
              { speaker: 'Follower', text: 'They caught me outside the city gate at dawn.' },
              { speaker: 'Follower', text: 'Three of them. Said I was a troublemaker for following him.' },
              { speaker: 'Follower', text: "I'd do it again." },
            ];
            break;
          case 'serve':
            lines = [
              { speaker: 'You',     text: '(You offer him water and help clean his wounds.)' },
              { speaker: 'Follower', text: 'The kindness of strangers... this is what he teaches, yes?' },
            ];
            break;
          default:
            lines = [{ speaker: 'Follower', text: "(He watches you go, saying nothing. He's used to being unseen.)" }];
        }
        this.dialogue.start({
          lines,
          onComplete: () => this.markBeatitude('Follower'),
        });
      },
    }, save);
  }

  // ---------------------------------------------------------------------------
  // Listener (generic crowd NPC)
  // ---------------------------------------------------------------------------

  private interactListener() {
    const lines = [
      [{ speaker: 'Listener', text: 'Shhh... I am trying to hear every word.' }],
      [{ speaker: 'Listener', text: 'Have you ever heard anyone speak like this?' }],
      [{ speaker: 'Listener', text: 'Blessed are the peacemakers... I keep thinking about that one.' }],
      [{ speaker: 'Listener', text: 'My neighbor told me about him. I am glad I came.' }],
    ];
    this.dialogue.start({ lines: lines[Math.floor(Math.random() * lines.length)] });
  }

  // ---------------------------------------------------------------------------
  // Beatitude tracking & completion
  // ---------------------------------------------------------------------------

  private markBeatitude(name: string) {
    this.beatitudesMet.add(name);
    this.showXPPopup(15);

    if (this.beatitudesMet.size >= 8 && !this.sermonComplete) {
      this.sermonComplete = true;
      this.time.delayedCall(800, () => this.completeSermon());
    }
  }

  private completeSermon() {
    this.dialogue.start({
      lines: [
        { speaker: 'Jesus', text: 'You have seen the kingdom lived. Now go — and do likewise.', nameColor: '0xf0c840' },
      ],
      onComplete: () => {
        let save = loadSave();
        save = completeEpisode(save, 'sermon_mount');
        save = unlockEpisode(save, 'feeding_5000');
        writeSave(save);
        this.time.delayedCall(500, () => {
          this.scrollRoomQueued = 'scroll_sermon_mount';
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // XP popup
  // ---------------------------------------------------------------------------

  private showXPPopup(xp: number) {
    if (xp <= 0) return;
    const popup = this.add.text(this.player.x, this.player.y - 20, `+${xp} XP`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px', color: '#c9a84c', resolution: 3,
    }).setDepth(300);

    this.tweens.add({
      targets: popup,
      y: popup.y - 16,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => popup.destroy(),
    });
  }
}
