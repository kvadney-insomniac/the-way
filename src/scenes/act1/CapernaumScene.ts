import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn } from '../../utils/pixelTransition';
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

    // Sky gradient band (top strip)
    g.fillGradientStyle(0x8fb8e0, 0x8fb8e0, 0xc9a870, 0xc9a870);
    g.fillRect(0, 0, MAP_W, 30);

    // Ground (sandy)
    g.fillStyle(0xc8a870);
    g.fillRect(0, 30, MAP_W, MAP_H - 30);

    // Dock area (water)
    g.fillStyle(0x2a5fad);
    g.fillRect(0, 160, MAP_W, MAP_H - 160);

    // Dock planks
    g.fillStyle(0x7a5530);
    for (let x = 0; x < MAP_W; x += 20) {
      g.fillRect(x, 158, 18, 8);
    }

    // Stone path down the center
    g.fillStyle(0x9a8870);
    g.fillRect(140, 30, 40, 130);
    // Path texture marks
    g.fillStyle(0x8a7860);
    for (let y = 35; y < 155; y += 12) {
      g.fillRect(142, y, 8, 4);
      g.fillRect(158, y + 6, 7, 4);
    }

    // Houses (left side)
    this.drawHouse(g, 20, 50, 0x9a7050);
    this.drawHouse(g, 20, 100, 0x8a6040);
    this.drawHouse(g, 70, 60, 0xaa8060);

    // Houses (right side)
    this.drawHouse(g, 200, 50, 0x9a7050);
    this.drawHouse(g, 260, 40, 0x8a6040);
    this.drawHouse(g, 220, 100, 0xb09070);

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

    // Ambient details: baskets, pottery
    g.fillStyle(0xa06030);
    g.fillEllipse(196, 95, 8, 6);
    g.fillEllipse(208, 97, 6, 5);

    // Collision walls (invisible static bodies)
    this.addWall(MAP_W / 2, 160, MAP_W, 6);   // water edge — full width
    // House walls (match drawHouse positions: x, y, w=32, h=24)
    this.addWall(36, 62,  32, 24);   // left house 1
    this.addWall(36, 112, 32, 24);   // left house 2
    this.addWall(86, 72,  32, 24);   // left house 3
    this.addWall(216, 62, 32, 24);   // right house 1
    this.addWall(276, 52, 32, 24);   // right house 2
    this.addWall(236, 112, 32, 24);  // right house 3
  }

  private addWall(cx: number, cy: number, w: number, h: number) {
    const zone = this.add.zone(cx, cy, w, h);
    this.physics.add.existing(zone, true);
    this.walls.add(zone);
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
    this.player = new Player(this, 160, 130);
  }

  private createNPCs() {
    // Andrew — on the dock, mending nets
    const andrew = new NPC(this, { key: 'andrew', name: 'Andrew', x: 80, y: 158 });
    // Random villager NPCs for atmosphere
    const villager1 = new NPC(this, { key: 'andrew', name: 'Villager', x: 40, y: 80 });
    const villager2 = new NPC(this, { key: 'peter', name: 'Fisherman', x: 240, y: 155 });
    const villager3 = new NPC(this, { key: 'peter', name: 'Child', x: 195, y: 70, interactRadius: 18 });
    const nicodemus = new NPC(this, { key: 'nicodemus', name: 'Nicodemus', x: 270, y: 60 });

    this.npcs = [andrew, villager1, villager2, villager3, nicodemus];
  }

  private drawHUD() {
    const save = loadSave();
    const hudG = this.add.graphics().setScrollFactor(0).setDepth(200);

    // Top bar background
    hudG.fillStyle(0x0a0806, 0.8);
    hudG.fillRect(0, 0, 320, 12);

    this.add.text(4, 2, `♥ DAY ${save.faithLevel}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px', color: '#c9a84c', resolution: 3,
    }).setScrollFactor(0).setDepth(201);

    this.add.text(100, 2, `LOVE ${save.love}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px', color: '#88cc88', resolution: 3,
    }).setScrollFactor(0).setDepth(201);

    this.add.text(240, 2, '[Z] TALK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '4px', color: '#6a5030', resolution: 3,
    }).setScrollFactor(0).setDepth(201);
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 20, 'CAPERNAUM', {
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
    // Ambient dialogue bubble from a passerby after a short delay
    this.time.delayedCall(1500, () => {
      const bubble = this.add.text(35, 65, '"Have you heard\nabout the teacher?"', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '3px', color: '#aaaaaa',
        backgroundColor: '#1a120a',
        padding: { x: 3, y: 2 },
        resolution: 3,
      }).setScrollFactor(1).setDepth(50);

      this.tweens.add({
        targets: bubble,
        alpha: 0,
        delay: 3000,
        duration: 600,
        onComplete: () => bubble.destroy(),
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
  }

  private interactWith(npc: NPC) {
    const save = loadSave();

    if (npc.npcName === 'Andrew') {
      if (!this.andrewMet) {
        this.andrewMet = true;
        this.dialogue.start({
          lines: act1Data.andrew_encounter.greeting,
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
          case 'listen': lines = act1Data.andrew_encounter.after_listen; break;
          case 'serve':  lines = act1Data.andrew_encounter.after_serve;  break;
          case 'pray':   lines = act1Data.andrew_encounter.after_pray;   break;
          default:       lines = act1Data.andrew_encounter.after_pass;   break;
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
