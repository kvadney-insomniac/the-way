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
const MAP_H = 200;

// Row of 6 stone water jars, y=140, evenly spaced
const JAR_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 62,  y: 140 },
  { x: 86,  y: 140 },
  { x: 110, y: 140 },
  { x: 134, y: 140 },
  { x: 158, y: 140 },
  { x: 182, y: 140 },
];

export class CanaScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private zKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Jar state
  private filledJars: Set<number> = new Set();
  private jarGraphics: Phaser.GameObjects.Graphics[] = [];

  // Scene state flags
  private maryEncounterDone = false;
  private miracleTriggered = false;
  private scrollRoomQueued: string | null = null;

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

      this.dialogue  = new DialogueSystem(this);
      this.encounter = new EncounterSystem(this);

      this.zKey       = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
      this.spaceKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.cursorKeys = this.input.keyboard!.createCursorKeys();
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
      globalAudio.play('capernaum', 1500);
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

  // ---------------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------------

  private buildMap() {
    const g = this.add.graphics();

    // Sky — bright warm gradient (30px tall)
    g.fillGradientStyle(0x7ec8f0, 0x7ec8f0, 0xe8d890, 0xe8d890);
    g.fillRect(0, 0, MAP_W, 30);

    // Ground — warm stone courtyard
    g.fillStyle(0xc8b890);
    g.fillRect(0, 30, MAP_W, 130); // 30 to 160

    // Subtle stone tile texture
    g.lineStyle(1, 0xb8a880, 0.4);
    for (let x = 0; x < MAP_W; x += 24) {
      g.lineBetween(x, 30, x, 160);
    }
    for (let y = 30; y < 160; y += 20) {
      g.lineBetween(0, y, MAP_W, y);
    }

    // Left stone building
    g.fillStyle(0x9a8868);
    g.fillRect(0, 30, 50, 130);
    // Left building window accents
    g.fillStyle(0x7a6848);
    g.fillRect(10, 50, 14, 10);
    g.fillRect(10, 80, 14, 10);
    g.fillStyle(0x88aacc, 0.7);
    g.fillRect(11, 51, 12, 8);
    g.fillRect(11, 81, 12, 8);

    // Right stone building
    g.fillStyle(0x9a8868);
    g.fillRect(270, 30, 50, 130);
    // Right building window accents
    g.fillStyle(0x7a6848);
    g.fillRect(296, 50, 14, 10);
    g.fillRect(296, 80, 14, 10);
    g.fillStyle(0x88aacc, 0.7);
    g.fillRect(297, 51, 12, 8);
    g.fillRect(297, 81, 12, 8);

    // Back wall with archway
    g.fillStyle(0xb0996a);
    g.fillRect(50, 30, 220, 20);
    // Archway opening
    g.fillStyle(0xc8b890); // ground color to "clear" arch shape
    g.fillRect(130, 30, 60, 20);
    // Arch pillars
    g.fillStyle(0x8a7848);
    g.fillRect(126, 30, 10, 22);
    g.fillRect(184, 30, 10, 22);
    // Arch lintel
    g.fillRect(126, 28, 68, 6);
    // Keystone
    g.fillStyle(0x6a5830);
    g.fillRect(155, 28, 10, 6);

    // Wedding tables — center area, long rectangle
    // Main banquet table
    g.fillStyle(0x9a7850);
    g.fillRect(60, 85, 200, 22);
    // Table edge highlight
    g.fillStyle(0xb08a60);
    g.fillRect(60, 85, 200, 3);
    // Table cloth
    g.fillStyle(0xf0e0c0, 0.75);
    g.fillRect(62, 86, 196, 18);

    // People sitting at table — small sprite-like rectangles
    const personColors = [0xe8c8a0, 0xd4a878, 0xc89060, 0xe0b890];
    const personPositions = [75, 100, 125, 155, 180, 205, 230];
    personPositions.forEach((px, idx) => {
      const col = personColors[idx % personColors.length];
      // Head
      g.fillStyle(col);
      g.fillCircle(px, 84, 4);
      // Body (above table — shown as upper torso)
      g.fillStyle(col - 0x101010 < 0 ? col : col - 0x101010);
      g.fillRect(px - 4, 78, 8, 7);
    });

    // Second smaller table — back
    g.fillStyle(0x9a7850);
    g.fillRect(80, 60, 160, 14);
    g.fillStyle(0xb08a60);
    g.fillRect(80, 60, 160, 2);
    g.fillStyle(0xf0e0c0, 0.6);
    g.fillRect(82, 61, 156, 11);

    // Food items on main table
    this.drawFoodItems(g, 90, 91);
    this.drawFoodItems(g, 160, 91);
    this.drawFoodItems(g, 220, 91);

    // Decorative vines along top
    g.fillStyle(0x4a7a2a);
    for (let x = 55; x < 270; x += 16) {
      g.fillEllipse(x, 35, 10, 7);
    }
    g.fillStyle(0x3a6a1a);
    for (let x = 63; x < 268; x += 16) {
      g.fillCircle(x, 37, 2);
    }

    // Hanging cloth banners
    g.fillStyle(0xc04030);
    g.fillTriangle(70, 30, 90, 30, 80, 46);
    g.fillStyle(0x4050a0);
    g.fillTriangle(115, 30, 125, 30, 120, 44);
    g.fillStyle(0xc09020);
    g.fillTriangle(195, 30, 205, 30, 200, 44);
    g.fillStyle(0xc04030);
    g.fillTriangle(230, 30, 250, 30, 240, 46);

    // Oil lamps
    this.drawLamp(g, 56, 55);
    this.drawLamp(g, 264, 55);
    this.drawLamp(g, 56, 120);
    this.drawLamp(g, 264, 120);

    // Southern exit path / ground continuation
    g.fillStyle(0xd0c8a0);
    g.fillRect(110, 160, 100, 40);

    // Collision: left building wall
    this.addWall(0, 30, 50, 130);
    // Collision: right building wall
    this.addWall(270, 30, 50, 130);
    // Collision: back wall left of arch
    this.addWall(50, 30, 76, 22);
    // Collision: back wall right of arch
    this.addWall(194, 30, 76, 22);
    // Collision: main banquet table
    this.addWall(60, 85, 200, 22);
    // Collision: back table
    this.addWall(80, 60, 160, 14);
    // Collision: north edge
    this.addWall(0, 0, MAP_W, 30);
    // Collision: left/right edges south
    this.addWall(0, 160, 110, 40);
    this.addWall(210, 160, 110, 40);

    this.walls.refresh();
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    (r.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
    this.walls.add(r);
  }

  private drawFoodItems(g: Phaser.GameObjects.Graphics, startX: number, y: number) {
    // Bread loaves
    g.fillStyle(0xd4a060);
    g.fillEllipse(startX,      y, 10, 6);
    g.fillEllipse(startX + 12, y, 8, 5);
    // Grapes
    g.fillStyle(0x6a2880);
    g.fillCircle(startX + 26, y,     3);
    g.fillCircle(startX + 31, y,     3);
    g.fillCircle(startX + 28, y - 4, 3);
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x9a7840);
    g.fillEllipse(x, y + 4, 8, 5);
    g.fillRect(x - 1, y, 2, 5);
    g.fillStyle(0xffcc44);
    g.fillTriangle(x - 2, y, x + 2, y, x, y - 5);
    g.fillStyle(0xff8820);
    g.fillTriangle(x - 1, y, x + 1, y, x, y - 3);
  }

  // ---------------------------------------------------------------------------
  // Jars
  // ---------------------------------------------------------------------------

  private drawJars() {
    JAR_POSITIONS.forEach((pos, i) => {
      const g = this.add.graphics().setDepth(pos.y + 1);
      this.renderJar(g, pos.x, pos.y, false);
      this.jarGraphics[i] = g;
    });
  }

  private renderJar(g: Phaser.GameObjects.Graphics, x: number, y: number, wine: boolean) {
    g.clear();
    // Shadow
    g.fillStyle(0x5a4028, 0.4);
    g.fillEllipse(x + 2, y + 7, 12, 4);
    // Body — 8×12 ellipse
    g.fillStyle(wine ? 0x8a2020 : 0x8a9090);
    g.fillEllipse(x, y, 8, 12);
    // Neck
    g.fillStyle(wine ? 0x6a1818 : 0x7a8080);
    g.fillRect(x - 2, y - 7, 4, 3);
    // Mouth
    g.fillStyle(wine ? 0x5a1010 : 0x6a7070);
    g.fillRect(x - 3, y - 9, 6, 3);
    // Highlight
    g.fillStyle(0xffffff, 0.2);
    g.fillEllipse(x - 1, y - 1, 3, 5);
    if (wine) {
      // Wine surface shimmer
      g.fillStyle(0xcc4444, 0.55);
      g.fillEllipse(x, y - 7, 4, 2);
    }
  }

  private animateJarsToWine() {
    JAR_POSITIONS.forEach((pos, i) => {
      this.time.delayedCall(i * 120, () => {
        this.renderJar(this.jarGraphics[i], pos.x, pos.y, true);
        this.filledJars.add(i);
        // Brief scale pulse
        this.tweens.add({
          targets: this.jarGraphics[i],
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 120,
          yoyo: true,
          ease: 'Power2',
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Player & NPCs
  // ---------------------------------------------------------------------------

  private createPlayer() {
    this.player = new Player(this, 160, 150);
  }

  private createNPCs() {
    const mary = new NPC(this, {
      key: 'nicodemus',
      name: 'woman',
      x: 160,
      y: 80,
      tint: 0xa07060,
      interactRadius: 26,
    });

    const jesus = new NPC(this, {
      key: 'peter',
      name: 'jesus',
      x: 200,
      y: 70,
      tint: 0xf5e0a0,
      interactRadius: 24,
    });

    const villager1 = new NPC(this, { key: 'andrew', name: 'villager', x: 80,  y: 100 });
    const villager2 = new NPC(this, { key: 'andrew', name: 'villager', x: 240, y: 100 });
    const villager3 = new NPC(this, { key: 'andrew', name: 'villager', x: 120, y: 120 });

    this.npcs = [mary, jesus, villager1, villager2, villager3];
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  private interactWith(npc: NPC) {
    if (npc.npcName === 'woman') {
      this.triggerMaryEncounter();
    } else if (npc.npcName === 'jesus') {
      if (this.miracleTriggered) {
        this.dialogue.start({
          lines: [
            { speaker: 'Jesus', text: 'The hour is coming when you will know the Father more fully.', nameColor: '0xfff4cc' },
          ],
        });
      } else {
        this.dialogue.start({
          lines: [
            { speaker: 'Jesus', text: 'My hour has not yet come.', nameColor: '0xfff4cc' },
          ],
        });
      }
    } else {
      // Villager ambient lines
      const lines = [
        [{ speaker: 'Villager', text: 'What a wonderful wedding! The best I have attended in years.' }],
        [{ speaker: 'Villager', text: 'Seven days of feasting — God bless this couple!' }],
        [{ speaker: 'Villager', text: 'Have you tried the bread? Freshly baked this morning.' }],
      ];
      this.dialogue.start({ lines: lines[Math.floor(Math.random() * lines.length)] });
    }
  }

  private triggerMaryEncounter() {
    if (this.maryEncounterDone) {
      this.dialogue.start({
        lines: [
          { speaker: 'Mary', text: 'Whatever he tells you, do it.', nameColor: '0xa07060' },
        ],
      });
      return;
    }

    // Determine intro lines — act1Data may not have water_to_wine_intro yet
    type DialogueLine = { speaker: string; text: string; nameColor?: string };
    const act1Any = act1Data as unknown as Record<string, DialogueLine[]>;
    const introLines: DialogueLine[] = act1Any.water_to_wine_intro
      ? act1Any.water_to_wine_intro
      : [{ speaker: 'Mary', text: 'They have no wine.', nameColor: '0xa07060' }];

    this.dialogue.start({
      lines: introLines,
      onComplete: () => {
        const save = loadSave();
        this.encounter.start(
          {
            npcName: 'Mary',
            situation: 'The wedding has run out of wine. The servants look to you.',
            onChoice: (action: EncounterAction) => {
              let currentSave = loadSave();
              currentSave = applyEncounterChoice(currentSave, action);
              this.maryEncounterDone = true;
              this.handleEncounterChoice(action, currentSave);
            },
          },
          save,
        );
      },
    });
  }

  private handleEncounterChoice(action: EncounterAction, save: ReturnType<typeof loadSave>) {
    switch (action) {
      case 'serve':
        this.dialogue.start({
          lines: [
            { speaker: 'Jesus', text: 'Fill the jars with water.', nameColor: '0xfff4cc' },
          ],
          onComplete: () => {
            this.animateJarsToWine();
            this.time.delayedCall(800, () => {
              this.dialogue.start({
                lines: [
                  { speaker: 'Jesus', text: 'Draw some out now and take it to the master of the feast.', nameColor: '0xfff4cc' },
                ],
                onComplete: () => this.performMiracle(save),
              });
            });
          },
        });
        break;

      case 'listen':
        this.dialogue.start({
          lines: [
            { speaker: 'Jesus', text: 'My hour has not yet come.', nameColor: '0xfff4cc' },
          ],
          onComplete: () => {
            this.animateJarsToWine();
            this.performMiracle(save);
          },
        });
        break;

      case 'pray':
        this.animateJarsToWine();
        this.performMiracle(save);
        break;

      case 'pass':
      default:
        this.dialogue.start({
          lines: [
            { speaker: 'Mary', text: 'Whatever he tells you, do it.', nameColor: '0xa07060' },
          ],
          onComplete: () => {
            this.animateJarsToWine();
            this.performMiracle(save);
          },
        });
        break;
    }
  }

  private performMiracle(save: ReturnType<typeof loadSave>) {
    if (this.miracleTriggered) return;
    this.miracleTriggered = true;

    this.cameras.main.flash(800, 255, 255, 220);

    // Save progress
    let updatedSave = completeEpisode(save, 'cana_wedding');
    updatedSave = unlockEpisode(updatedSave, 'paralytic_healing');
    writeSave(updatedSave);

    // Queue ScrollRoom launch
    this.scrollRoomQueued = 'scroll_water_to_wine';
  }

  private launchScrollRoom(episodeKey: string) {
    this.scene.launch('ScrollRoomScene', { episodeKey });
    this.scene.pause();
    this.scene.get('ScrollRoomScene').events.once('scroll-complete', () => {
      this.scene.resume();
    });
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
      delay: 2800,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked;

    this.dialogue.update(delta);

    // NPC proximity checks
    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

    const justZ     = Phaser.Input.Keyboard.JustDown(this.zKey);
    const justSpace = Phaser.Input.Keyboard.JustDown(this.spaceKey);

    if (this.dialogue.isActive) {
      if (justZ || justSpace) this.dialogue.advance();
      return;
    }

    if (this.encounter.isActive) {
      const up   = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);
      const down = Phaser.Input.Keyboard.JustDown(this.cursorKeys.down!);
      this.encounter.handleInput({
        up,
        down,
        space: justSpace,
        enter: Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!),
      });
      return;
    }

    // Scroll Room queued — launch on a clear frame
    if (this.scrollRoomQueued) {
      const key = this.scrollRoomQueued;
      this.scrollRoomQueued = null;
      this.time.delayedCall(350, () => this.launchScrollRoom(key));
      return;
    }

    // Return to Capernaum — walk south off map
    if (this.player.y > 195) {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CapernaumScene');
      });
      return;
    }

    // NPC interaction
    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }
  }
}
