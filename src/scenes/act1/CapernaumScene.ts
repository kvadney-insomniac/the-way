import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';
import act1Data from '../../data/dialogue/act1.json';

const MAP_W = 320;
const MAP_H = 240;
const TILE = 16;

export class CapernaumScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private andrewMet = false;
  private andrewEncounterDone = false;
  private peterTriggered = false;
  private scrollRoomQueued: string | null = null;
  private transitioning = false;

  constructor() {
    super({ key: 'CapernaumScene' });
  }

  create() {
    try {
      this.walls = this.physics.add.staticGroup();
      this.buildMap();
      this.createPlayer();
      this.createNPCs();
      this.physics.add.collider(this.player, this.walls);

      this.dialogue  = new DialogueSystem(this);
      this.encounter = new EncounterSystem(this);

      this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
      this.spaceKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.cursorKeys  = this.input.keyboard!.createCursorKeys();
      // Prevent browser from scrolling / selecting text on arrow/space keys
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
      this.playAmbientIntro();
      fadeIn(this, 600);
      globalAudio.play('capernaum', 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('CapernaumScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Sky — warm Mediterranean morning
    g.fillGradientStyle(0x7ec8f0, 0x7ec8f0, 0xe8c878, 0xe8c878);
    g.fillRect(0, 0, MAP_W, 36);

    // Ground (bright sandy Galilean earth)
    g.fillStyle(0xdcba7a);
    g.fillRect(0, 36, MAP_W, MAP_H - 36);
    // Subtle ground texture
    g.fillStyle(0xc8a860);
    for (let x = 0; x < MAP_W; x += 24) {
      for (let y = 40; y < 158; y += 18) {
        g.fillRect(x + (y % 24 === 0 ? 8 : 0), y, 6, 2);
      }
    }

    // Dock area (water — bright Sea of Galilee blue)
    g.fillStyle(0x3a78c8);
    g.fillRect(0, 160, MAP_W, MAP_H - 160);
    // Water shimmer
    g.fillStyle(0x5a9ae0);
    for (let x = 0; x < MAP_W; x += 18) {
      g.fillRect(x, 165, 10, 2);
      g.fillRect(x + 9, 172, 8, 2);
    }

    // Dock planks — warm wood
    g.fillStyle(0x9a6a3a);
    g.fillRect(0, 156, MAP_W, 10);
    g.fillStyle(0x7a5028);
    for (let x = 0; x < MAP_W; x += 20) {
      g.fillRect(x, 157, 18, 1);
      g.fillRect(x, 161, 18, 1);
    }

    // Stone path down the center — lighter limestone
    g.fillStyle(0xb8a888);
    g.fillRect(140, 36, 40, 124);
    // Path cobblestone marks
    g.fillStyle(0xa89878);
    for (let y = 40; y < 155; y += 12) {
      g.fillRect(142, y, 9, 5);
      g.fillRect(158, y + 6, 8, 5);
    }

    // Houses (left side)
    this.drawHouse(g, 20,  50,  0xc4a46a);
    this.drawHouse(g, 20,  100, 0xb89458);
    this.drawHouse(g, 70,  60,  0xd4b47a);

    // Houses (right side)
    this.drawHouse(g, 200, 50,  0xc8a86e);
    this.drawHouse(g, 260, 40,  0xba9860);
    this.drawHouse(g, 220, 100, 0xcc9c62);

    // Well
    this.drawWell(g, 180, 90);

    // Boats on water
    this.drawBoat(g, 30, 175);
    this.drawBoat(g, 130, 185);

    // Fishing nets (coiled)
    g.fillStyle(0x6a4a2a);
    g.fillEllipse(60, 160, 16, 6);
    g.fillEllipse(90, 162, 12, 5);

    // Trees
    this.drawTree(g, 100, 40);
    this.drawTree(g, 280, 70);
    this.drawTree(g, 50, 130);

    // Synagogue entrance (north center — arched stone doorway)
    g.fillStyle(0x9a8870);
    g.fillRect(136, 30, 48, 20);        // doorway lintel
    g.fillStyle(0x1a120a);
    g.fillRect(144, 36, 32, 14);        // dark door opening
    g.fillStyle(0xc9a84c);
    g.fillRect(144, 36, 32, 2);         // gold arch hint
    // Synagogue label
    this.add.text(160, 24, '▲ SYNAGOGUE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px', color: '#c9a84c', resolution: 3,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10);

    // Cana road sign (east edge)
    g.fillStyle(0x7a5530);
    g.fillRect(308, 88, 4, 20);          // signpost pole
    g.fillStyle(0xd4b88a);
    g.fillRect(292, 85, 24, 10);         // sign board
    this.add.text(304, 90, '►\nCANA', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px', color: '#3a2010', resolution: 3, align: 'center',
    }).setOrigin(0.5).setDepth(10);

    // Ambient details: baskets, pottery
    g.fillStyle(0xa06030);
    g.fillEllipse(196, 95, 8, 6);
    g.fillEllipse(208, 97, 6, 5);

    // Collision walls — x,y = top-left corner (matching drawHouse/fillRect coords)
    this.addWall(0,   158, MAP_W, 6);  // water edge full width
    this.addWall(20,  50,  32, 24);    // left house 1
    this.addWall(20,  100, 32, 24);    // left house 2
    this.addWall(70,  60,  32, 24);    // left house 3
    this.addWall(200, 50,  32, 24);    // right house 1
    this.addWall(260, 40,  32, 24);    // right house 2
    this.addWall(220, 100, 32, 24);    // right house 3
    this.walls.refresh();
  }

  private addWall(x: number, y: number, w: number, h: number) {
    // Use Rectangle (not Zone) — has reliable width/height for physics bodies
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    (r.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
    this.walls.add(r);
  }

  /** Place a Kenney tiny-town tile house at world position (x, y).
   *  Layout: 2×1 roof row at y, 2×1 wall row at y+16.
   *  Covers the 32×24 collision footprint set by addWall().
   */
  private placeTileHouse(x: number, y: number) {
    const WALL_FRAME  = 26; // brown brick wall  (row 2, col 2)
    const ROOF_FRAME  = 38; // roof tile          (row 3, col 2)

    // Roof row — sits at the top of the house
    this.add.image(x,      y, 'kenney-town', ROOF_FRAME).setOrigin(0, 0);
    this.add.image(x + 16, y, 'kenney-town', ROOF_FRAME).setOrigin(0, 0);

    // Wall row — base of the house
    this.add.image(x,      y + 16, 'kenney-town', WALL_FRAME).setOrigin(0, 0);
    this.add.image(x + 16, y + 16, 'kenney-town', WALL_FRAME).setOrigin(0, 0);
  }

  private drawHouse(g: Phaser.GameObjects.Graphics, x: number, y: number, wallColor: number) {
    // Walls
    g.fillStyle(wallColor);
    g.fillRect(x, y, 32, 24);
    // Roof
    g.fillStyle(wallColor - 0x202020 < 0 ? 0 : wallColor - 0x202020);
    g.fillTriangle(x - 2, y, x + 16, y - 10, x + 34, y);
    // Door
    g.fillStyle(0x4a2a10);
    g.fillRect(x + 12, y + 14, 8, 10);
    // Window
    g.fillStyle(0x88aacc);
    g.fillRect(x + 4, y + 6, 6, 5);
    g.fillRect(x + 22, y + 6, 6, 5);
  }

  private drawBoat(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x7a5530);
    g.fillEllipse(x + 20, y + 4, 40, 10);
    g.fillStyle(0x6a4520);
    g.fillRect(x + 18, y - 4, 4, 10);
    // Sail
    g.fillStyle(0xf5deb3);
    g.fillTriangle(x + 20, y - 4, x + 36, y + 2, x + 20, y + 2);
  }

  private drawWell(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x8a7a6a);
    g.fillEllipse(x, y, 14, 8);
    g.fillStyle(0x6a5a4a);
    g.fillRect(x - 7, y - 8, 14, 8);
    g.lineStyle(1, 0x5a4a3a);
    g.strokeEllipse(x, y, 14, 8);
    // Roof posts
    g.fillStyle(0x5a4030);
    g.fillRect(x - 8, y - 16, 2, 10);
    g.fillRect(x + 6, y - 16, 2, 10);
    g.fillRect(x - 8, y - 16, 16, 2);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Trunk
    g.fillStyle(0x5a3a1a);
    g.fillRect(x - 1, y, 3, 8);
    // Foliage (olive tree — irregular)
    g.fillStyle(0x5a7a3a);
    g.fillEllipse(x, y - 2, 12, 8);
    g.fillEllipse(x - 4, y, 8, 6);
    g.fillEllipse(x + 4, y, 8, 6);
    g.fillStyle(0x4a6a2a);
    g.fillEllipse(x + 2, y - 4, 8, 6);
  }

  private createPlayer() {
    // Start in the village path, north of the dock — player walks south toward Andrew
    this.player = new Player(this, 160, 95);
  }

  private createNPCs() {
    // Andrew — on the dock, slightly left of center so player can walk up behind him
    const andrew = new NPC(this, { key: 'andrew', name: 'Andrew', x: 148, y: 154 });
    // Atmosphere NPCs
    const villager1 = new NPC(this, { key: 'andrew',    name: 'Villager',  x: 40,  y: 85 });
    const villager2 = new NPC(this, { key: 'peter',     name: 'Fisherman', x: 240, y: 150 });
    const villager3 = new NPC(this, { key: 'peter',     name: 'Child',     x: 195, y: 72, interactRadius: 18 });
    const nicodemus = new NPC(this, { key: 'nicodemus', name: 'Nicodemus', x: 270, y: 62 });

    this.npcs = [andrew, villager1, villager2, villager3, nicodemus];
  }

  private drawHUD() {
    const save = loadSave();
    const BAR_H = 18;
    const D = 201;
    const g = this.add.graphics().setScrollFactor(0).setDepth(200);

    // Bar background + border
    g.fillStyle(0x080604, 0.92);
    g.fillRect(0, 0, 320, BAR_H);
    g.lineStyle(1, 0xc9a84c, 0.5);
    g.lineBetween(0, BAR_H, 320, BAR_H);

    // Left section — Faith level as filled/empty pip dots
    const faithLevel = Math.min(save.faithLevel, 5);
    this.add.text(5, 4, 'FAITH', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(D);
    // Draw 5 small pips as graphics — more reliable than unicode hearts
    for (let i = 0; i < 5; i++) {
      const filled = i < faithLevel;
      g.fillStyle(filled ? 0xe05050 : 0x3a2020);
      g.fillRect(45 + i * 9, 5, 7, 7);
      if (filled) {
        g.lineStyle(1, 0xff8080, 0.6);
        g.strokeRect(45 + i * 9, 5, 7, 7);
      }
    }

    // Center — LOVE counter
    const loveColor = save.love >= 10 ? '#f5c842' : save.love >= 5 ? '#88cc88' : '#c9a84c';
    this.add.text(160, 4, `LOVE  ${save.love}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px', color: loveColor, resolution: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D);

    // Right — control hint
    this.add.text(315, 4, 'Z: TALK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#5a4530', resolution: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D);
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 25, 'CAPERNAUM', {
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

  private playAmbientIntro() {
    this.time.delayedCall(1500, () => {
      // Screen-space whisper bubble — centered near top of play area
      const bg = this.add.graphics().setScrollFactor(0).setDepth(49);
      const txt = this.add.text(160, 42,
        '"Have you heard about the teacher from Nazareth?"',
        {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '9px',
          color: '#e8d8b0',
          align: 'center',
          wordWrap: { width: 240 },
          resolution: 3,
        },
      ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(50);

      // Draw backdrop behind the text
      const b = txt.getBounds();
      bg.fillStyle(0x1a120a, 0.88);
      bg.fillRect(b.left - 6, b.top - 4, b.width + 12, b.height + 8);
      bg.lineStyle(1, 0xc9a84c, 0.6);
      bg.strokeRect(b.left - 6, b.top - 4, b.width + 12, b.height + 8);

      this.tweens.add({
        targets: [bg, txt],
        alpha: 0,
        delay: 3500,
        duration: 700,
        onComplete: () => { bg.destroy(); txt.destroy(); },
      });
    });
  }

  update(_time: number, delta: number) {
    // Don't process input during dialogue / encounter
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked;

    // Update dialogue typewriter
    this.dialogue.update(delta);

    // Check NPC proximity
    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

    // Z key / Space to interact or advance dialogue
    const justZ     = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const justSpace = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const justEnter = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);

    if (this.dialogue.isActive) {
      if (justZ || justSpace) this.dialogue.advance();
      return;
    }

    // Encounter system handles its own input
    if (this.encounter.isActive) {
      const up    = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);
      const down  = Phaser.Input.Keyboard.JustDown(this.cursorKeys.down!);
      this.encounter.handleInput({ up, down, space: justSpace, enter: justEnter });
      return;
    }

    // Scroll Room queued — trigger on next clear frame
    if (this.scrollRoomQueued) {
      const key = this.scrollRoomQueued;
      this.scrollRoomQueued = null;
      this.time.delayedCall(300, () => {
        this.scene.launch('ScrollRoomScene', { episodeKey: key });
        this.scene.pause();
      });
      return;
    }

    // Interact with nearby NPC
    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }

    // Scene exits — only allow after Andrew has been met (tutorial gating)
    if (!this.transitioning && this.andrewMet) {
      // North exit → Synagogue (walk through the doorway)
      if (this.player.y < 38 && this.player.x > 136 && this.player.x < 184) {
        this.transitioning = true;
        fadeToScene(this, 'SynagogueScene');
      }
      // East exit → Cana (walk off east edge)
      if (this.player.x > 313 && this.player.y > 40 && this.player.y < 155) {
        this.transitioning = true;
        fadeToScene(this, 'CanaScene');
      }
    }
  }

  private interactWith(npc: NPC) {
    const save = loadSave();

    if (npc.npcName === 'Andrew') {
      if (!this.andrewMet) {
        this.andrewMet = true;
        this.dialogue.start({
          lines: act1Data.andrew_intro,
          onComplete: () => this.triggerAndrewEncounter(npc),
        });
      } else if (this.andrewEncounterDone) {
        this.dialogue.start({
          lines: [{ speaker: 'Andrew', text: "He's out there somewhere. Follow the path north when you're ready." }],
        });
      }
    } else if (npc.npcName === 'Nicodemus') {
      this.dialogue.start({
        lines: [
          { speaker: 'Nicodemus', text: "Hmm. A follower of the Nazarene?" },
          { speaker: 'Nicodemus', text: "I have... questions of my own. Perhaps I will seek him out. By night." },
        ],
      });
    } else if (npc.npcName === 'Fisherman') {
      if (!this.peterTriggered && save.episodes.andrew_encounter?.status === 'completed') {
        this.dialogue.start({
          lines: [
            { speaker: 'Fisherman', text: "You lookin' for Simon? He's here. In a terrible mood." },
            { speaker: 'Fisherman', text: "Another empty net night. His brother Andrew keeps yammering about some rabbi." },
          ],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Fisherman', text: "Long night. Short catch. Same as always." }],
        });
      }
    } else {
      // Generic ambient lines
      const lines = [
        [{ speaker: 'Villager', text: "God be with you, stranger." }],
        [{ speaker: 'Child', text: "Have you seen the man who heals people? My father says he's a prophet!" }],
      ];
      this.dialogue.start({ lines: lines[Math.floor(Math.random() * lines.length)] });
    }

    void save; // suppress unused warning
  }

  private triggerAndrewEncounter(npc: NPC) {
    let save = loadSave();
    this.encounter.start({
      npcName: npc.npcName,
      situation: act1Data.andrew_encounter.situation,
      onChoice: (action: EncounterAction) => {
        save = applyEncounterChoice(save, action);

        let lines: Array<{speaker: string; text: string}>;
        switch (action) {
          case 'listen': lines = act1Data.andrew_listen; break;
          case 'serve':  lines = act1Data.andrew_serve;  break;
          case 'pray':   lines = act1Data.andrew_pray;   break;
          default:       lines = [{ speaker: 'Andrew', text: 'The teacher passed through here. Maybe you will see him yet.' }]; break;
        }

        this.dialogue.start({
          lines,
          onComplete: () => {
            save = completeEpisode(save, 'andrew_encounter');
            save = unlockEpisode(save, 'call_of_peter');
            writeSave(save);
            this.andrewEncounterDone = true;
            this.showXPPopup(action === 'pass' ? 0 : 15 + (action === 'serve' ? 5 : 0));
            // Queue scroll room for Andrew encounter
            this.scrollRoomQueued = 'andrew_encounter';
          },
        });
      },
    }, save);
  }

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
