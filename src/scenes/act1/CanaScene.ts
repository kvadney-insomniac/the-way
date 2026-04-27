import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { loadSave, writeSave, completeEpisode, unlockEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene, holyFlash } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

const MAP_W = 320;
const MAP_H = 180;

// The 6 stone water jars — spread around the courtyard
const JAR_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 52,  y: 72  },
  { x: 52,  y: 110 },
  { x: 268, y: 72  },
  { x: 268, y: 110 },
  { x: 150, y: 148 },
  { x: 172, y: 148 },
];

const JAR_RADIUS = 14;

export class CanaScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private dialogue!: DialogueSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private scrollRoomQueued: string | null = null;

  // Jar state
  private jarsFound: Set<number> = new Set();
  private jarObjects: Phaser.GameObjects.Graphics[] = [];
  private jarLabels: Phaser.GameObjects.Text[] = [];
  private allJarsFound = false;
  private miracleTriggered = false;
  private openingDialogueDone = false;

  constructor() {
    super({ key: 'CanaScene' });
  }

  create() {
    try {
      this.walls = this.physics.add.staticGroup();
      this.buildMap();
      this.drawJars();
      this.createPlayer();
      this.createNPCs();
      this.physics.add.collider(this.player, this.walls);

      this.dialogue = new DialogueSystem(this);

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
      globalAudio.play('capernaum', 1000);

      // Opening dialogue plays after a brief delay — player "arrives" at the wedding
      this.time.delayedCall(1800, () => this.playOpeningDialogue());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('CanaScene.create error:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Map
  // -------------------------------------------------------------------------

  private buildMap() {
    const g = this.add.graphics();

    // Sky — warm afternoon
    g.fillGradientStyle(0x7aa8d0, 0x7aa8d0, 0xd4a060, 0xd4a060);
    g.fillRect(0, 0, MAP_W, 28);

    // Courtyard stone floor
    g.fillStyle(0x9a8870);
    g.fillRect(0, 28, MAP_W, MAP_H - 28);

    // Floor tile texture — subtle grid
    g.lineStyle(1, 0x8a7860, 0.35);
    for (let x = 0; x < MAP_W; x += 20) {
      g.lineBetween(x, 28, x, MAP_H);
    }
    for (let y = 28; y < MAP_H; y += 20) {
      g.lineBetween(0, y, MAP_W, y);
    }

    // Perimeter courtyard walls (thick stone)
    g.fillStyle(0x7a6850);
    g.fillRect(0, 28, MAP_W, 10);   // top wall
    g.fillRect(0, 28, 10, MAP_H);   // left wall
    g.fillRect(MAP_W - 10, 28, 10, MAP_H); // right wall
    g.fillRect(0, MAP_H - 10, MAP_W, 10);  // bottom wall

    // Wall highlights
    g.fillStyle(0x8a7860);
    g.fillRect(2, 30, MAP_W - 4, 3);
    g.fillRect(2, 30, 3, MAP_H - 32);
    g.fillRect(MAP_W - 5, 30, 3, MAP_H - 32);

    // Archway entrance — center bottom
    g.fillStyle(0x9a8870); // clear the wall section
    g.fillRect(130, MAP_H - 10, 60, 10);
    // Arch pillars
    g.fillStyle(0x6a5840);
    g.fillRect(126, MAP_H - 22, 10, 22);
    g.fillRect(184, MAP_H - 22, 10, 22);
    // Arch lintel
    g.fillRect(126, MAP_H - 22, 68, 7);
    // Arch keystone accent
    g.fillStyle(0x5a4830);
    g.fillRect(155, MAP_H - 22, 10, 7);

    // Long banquet tables — two rows
    this.drawTable(g, 40, 60, 100, 16);   // left table
    this.drawTable(g, 180, 60, 100, 16);  // right table
    this.drawTable(g, 90, 120, 140, 14);  // center back table

    // Table cloths
    g.fillStyle(0xf5e8c0, 0.7);
    g.fillRect(42, 61, 96, 12);
    g.fillRect(182, 61, 96, 12);
    g.fillRect(92, 121, 136, 10);

    // Food on tables — small colored rects/circles
    this.drawFoodItems(g, 50, 58);
    this.drawFoodItems(g, 190, 58);
    this.drawFoodItems(g, 105, 118);

    // Decorative oil lamps on walls
    this.drawLamp(g, 20, 50);
    this.drawLamp(g, 20, 90);
    this.drawLamp(g, 296, 50);
    this.drawLamp(g, 296, 90);

    // Vine/floral decorations along top wall
    g.fillStyle(0x4a7a2a);
    for (let x = 20; x < MAP_W - 20; x += 18) {
      g.fillEllipse(x, 33, 10, 7);
    }
    g.fillStyle(0x3a6a1a);
    for (let x = 28; x < MAP_W - 28; x += 18) {
      g.fillCircle(x, 35, 2);
    }

    // Hanging cloth banners
    g.fillStyle(0xc04030);
    g.fillTriangle(60, 28, 80, 28, 70, 44);
    g.fillTriangle(100, 28, 120, 28, 110, 44);
    g.fillStyle(0x304090);
    g.fillTriangle(200, 28, 220, 28, 210, 44);
    g.fillTriangle(240, 28, 260, 28, 250, 44);

    // Collision walls
    this.addWall(0,   28,  MAP_W, 10); // top wall
    this.addWall(0,   28,  10, MAP_H); // left wall
    this.addWall(MAP_W - 10, 28, 10, MAP_H); // right wall
    this.addWall(0,   MAP_H - 10, 130, 10); // bottom left (beside arch)
    this.addWall(190, MAP_H - 10, 130, 10); // bottom right (beside arch)
    // Table colliders
    this.addWall(40,  60, 100, 16);
    this.addWall(180, 60, 100, 16);
    this.addWall(90, 120, 140, 14);

    this.walls.refresh();
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    (r.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
    this.walls.add(r);
  }

  private drawTable(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Legs
    g.fillStyle(0x6a4020);
    g.fillRect(x + 2,     y + h, 4, 6);
    g.fillRect(x + w - 6, y + h, 4, 6);
    // Top
    g.fillStyle(0x8a6040);
    g.fillRect(x, y, w, h);
    // Edge highlight
    g.fillStyle(0xa07050);
    g.fillRect(x, y, w, 2);
  }

  private drawFoodItems(g: Phaser.GameObjects.Graphics, startX: number, y: number) {
    // Loaves of bread
    g.fillStyle(0xd4a060);
    g.fillEllipse(startX,      y, 10, 6);
    g.fillEllipse(startX + 14, y, 10, 6);
    // Grapes
    g.fillStyle(0x6a3080);
    g.fillCircle(startX + 28, y,     3);
    g.fillCircle(startX + 33, y,     3);
    g.fillCircle(startX + 30, y - 4, 3);
    // Fish
    g.fillStyle(0xc0c0a0);
    g.fillEllipse(startX + 44, y, 12, 5);
    g.fillTriangle(startX + 50, y - 3, startX + 56, y, startX + 50, y + 3);
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0xa08050);
    g.fillEllipse(x, y + 4, 8, 5);
    g.fillRect(x - 1, y, 2, 5);
    // Flame
    g.fillStyle(0xffcc44);
    g.fillTriangle(x - 2, y, x + 2, y, x, y - 5);
    g.fillStyle(0xff8820);
    g.fillTriangle(x - 1, y, x + 1, y, x, y - 3);
  }

  // -------------------------------------------------------------------------
  // Jars
  // -------------------------------------------------------------------------

  private drawJars() {
    JAR_POSITIONS.forEach((pos, i) => {
      const g = this.add.graphics().setDepth(pos.y + 1);
      this.renderJar(g, pos.x, pos.y, false);
      this.jarObjects.push(g);

      // Proximity label (hidden until nearby)
      const lbl = this.add.text(pos.x, pos.y - 14, `JAR ${i + 1}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '4px', color: '#c9a84c', resolution: 3,
      }).setOrigin(0.5).setDepth(pos.y + 2).setVisible(false);
      this.jarLabels.push(lbl);
    });
  }

  private renderJar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    filled: boolean,
  ) {
    g.clear();
    // Shadow
    g.fillStyle(0x5a4830, 0.4);
    g.fillEllipse(x + 2, y + 7, 14, 5);
    // Jar body
    g.fillStyle(filled ? 0x4a7aaa : 0x9a8060);
    g.fillEllipse(x, y, 12, 16);
    // Jar neck
    g.fillStyle(filled ? 0x3a6a9a : 0x8a7050);
    g.fillRect(x - 3, y - 9, 6, 4);
    // Jar mouth
    g.fillStyle(filled ? 0x2a5a8a : 0x7a6040);
    g.fillRect(x - 4, y - 11, 8, 3);
    // Highlight
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(x - 2, y - 2, 4, 6);
    if (filled) {
      // Water shimmer at the top
      g.fillStyle(0x88ccff, 0.6);
      g.fillEllipse(x, y - 8, 5, 2);
    }
  }

  private checkJarProximity() {
    if (this.allJarsFound || this.miracleTriggered) return;
    JAR_POSITIONS.forEach((pos, i) => {
      if (this.jarsFound.has(i)) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
      if (dist <= JAR_RADIUS) {
        this.jarsFound.add(i);
        this.jarLabels[i].setVisible(false);

        // Pop label
        const found = this.add.text(pos.x, pos.y - 18, 'Empty jar!', {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '7px', color: '#e8d8b0', resolution: 3,
        }).setOrigin(0.5).setDepth(300);
        this.tweens.add({
          targets: found,
          y: found.y - 10,
          alpha: 0,
          duration: 1200,
          ease: 'Power2',
          onComplete: () => found.destroy(),
        });

        // Show count bubble
        this.showJarCountPopup();

        if (this.jarsFound.size === 6) {
          this.allJarsFound = true;
          this.time.delayedCall(800, () => this.triggerMiracle());
        }
      }
    });
  }

  private showJarCountPopup() {
    const n = this.jarsFound.size;
    const txt = this.add.text(160, 88, `${n} / 6 jars found`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#c9a84c', resolution: 3,
      backgroundColor: '#1a120a',
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0).setPadding(4, 3);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      delay: 1500,
      duration: 600,
      onComplete: () => txt.destroy(),
    });
  }

  private updateJarLabels() {
    if (this.allJarsFound) return;
    JAR_POSITIONS.forEach((pos, i) => {
      if (this.jarsFound.has(i)) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
      this.jarLabels[i].setVisible(dist <= JAR_RADIUS + 8);
    });
  }

  // -------------------------------------------------------------------------
  // NPCs
  // -------------------------------------------------------------------------

  private createPlayer() {
    this.player = new Player(this, 160, 148);
  }

  private createNPCs() {
    // Mary — near the top-left area, watching the feast
    const mary = new NPC(this, {
      key: 'nicodemus', name: 'Mary', x: 75, y: 95,
      tint: 0xa07060, interactRadius: 26,
    });
    // Servant — near center
    const servant = new NPC(this, {
      key: 'andrew', name: 'Servant', x: 160, y: 88,
      interactRadius: 22,
    });
    // Bridegroom — right side, near head table
    const bridegroom = new NPC(this, {
      key: 'peter', name: 'Bridegroom', x: 240, y: 95,
      interactRadius: 22,
    });
    // Wedding Guest — ambient, near left table
    const guest = new NPC(this, {
      key: 'andrew', name: 'Wedding Guest', x: 60, y: 55,
      interactRadius: 20,
    });

    this.npcs = [mary, servant, bridegroom, guest];
  }

  // -------------------------------------------------------------------------
  // Dialogue events
  // -------------------------------------------------------------------------

  private playOpeningDialogue() {
    this.dialogue.start({
      lines: [
        {
          speaker: 'Wedding Guest',
          text: 'What a joyous celebration! The whole village has gathered for this wedding.',
        },
        {
          speaker: 'Mary',
          text: 'They have no wine.',
          nameColor: 0xa07060,
        },
        {
          speaker: 'Mary',
          text: 'Look around — there are six stone water jars here. Find each one.',
          nameColor: 0xa07060,
        },
        {
          speaker: 'Narrator',
          text: 'Walk near each of the 6 stone jars to inspect them.',
        },
      ],
      onComplete: () => {
        this.openingDialogueDone = true;
      },
    });
  }

  private triggerMiracle() {
    if (this.miracleTriggered) return;
    this.miracleTriggered = true;

    // Freeze player
    this.player.frozen = true;

    this.dialogue.start({
      lines: [
        {
          speaker: 'Mary',
          text: 'Do whatever he tells you.',
          nameColor: 0xa07060,
        },
        {
          speaker: 'Narrator',
          text: 'Jesus said to the servants: "Fill the jars with water."',
        },
        {
          speaker: 'Servant',
          text: 'We have filled them — all the way to the brim, master.',
        },
        {
          speaker: 'Narrator',
          text: '"Now draw some out and take it to the master of the banquet."',
        },
      ],
      onComplete: () => this.performMiracle(),
    });
  }

  private performMiracle() {
    // Flash holy light
    holyFlash(this, 400);

    // Re-render all jars as filled with wine (deep red)
    JAR_POSITIONS.forEach((pos, i) => {
      const g = this.jarObjects[i];
      g.clear();
      // Shadow
      g.fillStyle(0x5a4830, 0.4);
      g.fillEllipse(pos.x + 2, pos.y + 7, 14, 5);
      // Jar body — wine red
      g.fillStyle(0x8a2030);
      g.fillEllipse(pos.x, pos.y, 12, 16);
      g.fillStyle(0x7a1020);
      g.fillRect(pos.x - 3, pos.y - 9, 6, 4);
      g.fillStyle(0x6a1018);
      g.fillRect(pos.x - 4, pos.y - 11, 8, 3);
      g.fillStyle(0xffffff, 0.2);
      g.fillEllipse(pos.x - 2, pos.y - 2, 4, 6);
      // Wine surface
      g.fillStyle(0xff4466, 0.55);
      g.fillEllipse(pos.x, pos.y - 8, 5, 2);
    });

    this.time.delayedCall(500, () => {
      this.dialogue.start({
        lines: [
          {
            speaker: 'Master of Banquet',
            text: 'Everyone brings out the choice wine first... but you have saved the best till now!',
          },
          {
            speaker: 'Servant',
            text: 'It was water — I poured the water myself! Now it is wine!',
          },
          {
            speaker: 'Wedding Guest',
            text: 'Did you see that? What kind of man is this?',
          },
          {
            speaker: 'Mary',
            text: 'This is the beginning of the signs. Believe.',
            nameColor: 0xa07060,
          },
          {
            speaker: 'Narrator',
            text: 'What Jesus did here in Cana of Galilee was the first of the signs through which he revealed his glory. — John 2:11',
          },
        ],
        onComplete: () => this.completeScene(),
      });
    });
  }

  private completeScene() {
    let save = loadSave();
    save = completeEpisode(save, 'cana_wedding');
    save = unlockEpisode(save, 'paralytic_healing');
    writeSave(save);

    this.showXPPopup(20);

    // Queue the scroll room
    this.scrollRoomQueued = 'scroll_water_to_wine';
  }

  // -------------------------------------------------------------------------
  // NPC interaction
  // -------------------------------------------------------------------------

  private interactWith(npc: NPC) {
    if (npc.npcName === 'Mary') {
      if (!this.openingDialogueDone) return; // opening dialogue handles Mary first
      if (this.miracleTriggered) {
        this.dialogue.start({
          lines: [
            {
              speaker: 'Mary',
              text: 'His hour has come. Do you see what he has done?',
              nameColor: 0xa07060,
            },
          ],
        });
      } else if (this.jarsFound.size < 6) {
        this.dialogue.start({
          lines: [
            {
              speaker: 'Mary',
              text: `You have found ${this.jarsFound.size} of the six jars. Keep looking.`,
              nameColor: 0xa07060,
            },
          ],
        });
      }
    } else if (npc.npcName === 'Servant') {
      if (this.miracleTriggered) {
        this.dialogue.start({
          lines: [{ speaker: 'Servant', text: 'I will never doubt again. That was water — I know what I poured.' }],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Servant', text: 'We are running short of wine. The master will be humiliated.' }],
        });
      }
    } else if (npc.npcName === 'Bridegroom') {
      if (this.miracleTriggered) {
        this.dialogue.start({
          lines: [{ speaker: 'Bridegroom', text: 'This is the finest wine I have ever tasted. Where did it come from?' }],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Bridegroom', text: 'Welcome, friend! Come, eat and be merry — this is a day of joy!' }],
        });
      }
    } else if (npc.npcName === 'Wedding Guest') {
      this.dialogue.start({
        lines: [{ speaker: 'Wedding Guest', text: 'Seven days of feasting! May the Lord bless this union.' }],
      });
    }
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

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
    const label = this.add.text(160, 25, 'CANA — WEDDING FEAST', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#f5deb3', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 3000,
      duration: 800,
      onComplete: () => label.destroy(),
    });
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

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive;
    this.player.frozen = blocked;

    this.dialogue.update(delta);

    // Check NPC proximity
    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

    // Check jar proximity (only if opening dialogue done and miracle not yet fired)
    if (this.openingDialogueDone && !this.miracleTriggered) {
      this.checkJarProximity();
    }

    // Update jar label visibility
    this.updateJarLabels();

    const justZ     = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const justSpace = Phaser.Input.Keyboard.JustDown(this.spaceKey);

    if (this.dialogue.isActive) {
      if (justZ || justSpace) this.dialogue.advance();
      return;
    }

    // Scroll Room queued — trigger on next clear frame
    if (this.scrollRoomQueued) {
      const key = this.scrollRoomQueued;
      this.scrollRoomQueued = null;
      this.time.delayedCall(400, () => {
        this.scene.launch('ScrollRoomScene', { episodeKey: key });
        this.scene.pause();
        this.scene.get('ScrollRoomScene').events.once('shutdown', () => {
          // Return to Capernaum after scroll room
          fadeToScene(this, 'CapernaumScene');
        });
      });
      return;
    }

    // Interact with nearby NPC
    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }
  }
}
