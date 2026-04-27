import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, completeEpisode, unlockEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene, holyFlash } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

const MAP_W = 320;
const MAP_H = 180;

// Column x-positions (top-to-bottom pairs, two rows flanking the nave)
const COLUMN_XS = [60, 120, 180, 240];

export class SynagogueScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private scrollRoomQueued: string | null = null;

  // Scene-state flags
  private teachingDone = false;
  private encounterDone = false;
  private crowdAmazedDone = false;

  // NPC refs we need later
  private uncleanManNPC!: NPC;

  constructor() {
    super({ key: 'SynagogueScene' });
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
      fadeIn(this, 700);
      globalAudio.play('capernaum', 1000);

      // Auto-trigger the teaching after player settles in
      this.time.delayedCall(1600, () => this.playTeachingDialogue());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('SynagogueScene.create error:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Map — stone synagogue interior
  // -------------------------------------------------------------------------

  private buildMap() {
    const g = this.add.graphics();

    // Deep stone floor
    g.fillStyle(0x5a4a3a);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Floor tile texture
    g.fillStyle(0x4e4030);
    for (let x = 0; x < MAP_W; x += 24) {
      for (let y = 0; y < MAP_H; y += 24) {
        g.fillRect(x, y, 23, 23);
      }
    }
    // Grout lines
    g.fillStyle(0x3a3020);
    for (let x = 0; x < MAP_W; x += 24) g.fillRect(x, 0, 1, MAP_H);
    for (let y = 0; y < MAP_H; y += 24) g.fillRect(0, y, MAP_W, 1);

    // Central nave — slightly lighter stone
    g.fillStyle(0x564438);
    g.fillRect(70, 0, 180, MAP_H);

    // Outer wall borders (thick)
    g.fillStyle(0x2a2010);
    g.fillRect(0, 0, MAP_W, 10);   // top
    g.fillRect(0, MAP_H - 10, MAP_W, 10); // bottom
    g.fillRect(0, 0, 10, MAP_H);   // left
    g.fillRect(MAP_W - 10, 0, 10, MAP_H); // right

    // Wall inner face highlight
    g.fillStyle(0x4a3c2c);
    g.fillRect(10, 10, MAP_W - 20, 4);
    g.fillRect(10, 10, 4, MAP_H - 20);
    g.fillRect(MAP_W - 14, 10, 4, MAP_H - 20);
    g.fillRect(10, MAP_H - 14, MAP_W - 20, 4);

    // Torah / bimah platform at the top-center
    this.drawBimah(g);

    // Torah ark — back wall, center
    this.drawTorahArk(g);

    // Columns — two rows flanking the nave
    const columnYs = [38, 82, 126];
    COLUMN_XS.forEach(cx => {
      columnYs.forEach(cy => {
        this.drawColumn(g, cx, cy);
      });
    });

    // Stone benches — along the side aisles
    // Left benches
    this.drawBench(g, 14, 40, 44, 10);
    this.drawBench(g, 14, 70, 44, 10);
    this.drawBench(g, 14, 100, 44, 10);
    this.drawBench(g, 14, 130, 44, 10);
    // Right benches
    this.drawBench(g, 262, 40, 44, 10);
    this.drawBench(g, 262, 70, 44, 10);
    this.drawBench(g, 262, 100, 44, 10);
    this.drawBench(g, 262, 130, 44, 10);

    // Hanging oil lamps (pairs between columns)
    this.drawHangingLamp(g, 90,  30);
    this.drawHangingLamp(g, 160, 30);
    this.drawHangingLamp(g, 230, 30);

    // Scroll alcoves on side walls
    this.drawScrollAlcove(g, 14,  50);
    this.drawScrollAlcove(g, 14,  110);
    this.drawScrollAlcove(g, 292, 50);
    this.drawScrollAlcove(g, 292, 110);

    // Entrance arch — bottom center
    this.drawEntryArch(g);

    // Shadow overlay — top & sides for depth
    g.fillStyle(0x000000, 0.18);
    g.fillRect(0, 0, 70, MAP_H);
    g.fillRect(250, 0, 70, MAP_H);
    g.fillStyle(0x000000, 0.12);
    g.fillRect(0, 0, MAP_W, 20);

    // Collision walls
    this.addWall(0,   0,   MAP_W, 10); // top
    this.addWall(0,   MAP_H - 10, MAP_W, 10); // bottom (except door)
    this.addWall(0,   0,   10, MAP_H); // left
    this.addWall(MAP_W - 10, 0, 10, MAP_H); // right
    // Bench colliders (left)
    this.addWall(14, 40,  44, 10);
    this.addWall(14, 70,  44, 10);
    this.addWall(14, 100, 44, 10);
    this.addWall(14, 130, 44, 10);
    // Bench colliders (right)
    this.addWall(262, 40,  44, 10);
    this.addWall(262, 70,  44, 10);
    this.addWall(262, 100, 44, 10);
    this.addWall(262, 130, 44, 10);
    // Bimah / ark area
    this.addWall(90, 10, 140, 28);

    this.walls.refresh();
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    (r.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
    this.walls.add(r);
  }

  private drawBimah(g: Phaser.GameObjects.Graphics) {
    // Raised platform
    g.fillStyle(0x4a3820);
    g.fillRect(90, 10, 140, 30);
    // Platform edge highlight
    g.fillStyle(0x6a5030);
    g.fillRect(90, 10, 140, 3);
    g.fillRect(90, 10, 3, 30);
    g.fillRect(227, 10, 3, 30);
    // Reading stand
    g.fillStyle(0x7a6040);
    g.fillRect(148, 16, 24, 18);
    g.fillStyle(0x9a8060);
    g.fillRect(148, 16, 24, 3);
    // Open scroll on stand
    g.fillStyle(0xf5e8c0);
    g.fillRect(151, 20, 18, 11);
    // Scroll text lines
    g.fillStyle(0x4a3820);
    g.fillRect(153, 22, 14, 1);
    g.fillRect(153, 25, 14, 1);
    g.fillRect(153, 28, 10, 1);
    // Scroll handles
    g.fillStyle(0x8a6040);
    g.fillRect(149, 19, 3, 13);
    g.fillRect(168, 19, 3, 13);
    // Menorah
    this.drawMenorah(g, 230, 24);
    this.drawMenorah(g, 90,  24);
  }

  private drawMenorah(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0xd4a820);
    // Base
    g.fillRect(x - 5, y + 8, 10, 2);
    g.fillRect(x - 2, y + 6, 4, 3);
    // Center shaft
    g.fillRect(x - 1, y - 4, 2, 11);
    // Arms
    g.fillRect(x - 6, y + 2, 6, 1);
    g.fillRect(x + 1,  y + 2, 6, 1);
    g.fillRect(x - 5, y - 2, 1, 5);
    g.fillRect(x + 5,  y - 2, 1, 5);
    g.fillRect(x - 3, y,     1, 3);
    g.fillRect(x + 3,  y,    1, 3);
    // Flames
    g.fillStyle(0xffcc44);
    const flameXs = [x - 5, x - 3, x - 1, x + 1, x + 3, x + 5, x];
    flameXs.forEach(fx => {
      g.fillTriangle(fx - 1, y - 2, fx + 1, y - 2, fx, y - 5);
    });
  }

  private drawTorahArk(g: Phaser.GameObjects.Graphics) {
    // Ark niche in top wall
    g.fillStyle(0x3a2c1a);
    g.fillRect(128, 10, 64, 22);
    // Ark doors
    g.fillStyle(0x7a5a2a);
    g.fillRect(130, 11, 28, 20);
    g.fillRect(162, 11, 28, 20);
    // Door panels
    g.fillStyle(0x9a7a4a);
    g.fillRect(132, 13, 24, 16);
    g.fillRect(164, 13, 24, 16);
    // Star of David on doors
    g.fillStyle(0xd4a820);
    g.fillTriangle(140, 14, 148, 14, 144, 20);
    g.fillTriangle(140, 22, 148, 22, 144, 16);
    g.fillTriangle(172, 14, 180, 14, 176, 20);
    g.fillTriangle(172, 22, 180, 22, 176, 16);
    // Ark crown
    g.fillStyle(0xd4a820);
    g.fillRect(126, 10, 68, 3);
  }

  private drawColumn(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Column shadow
    g.fillStyle(0x1a1408, 0.5);
    g.fillEllipse(x + 3, y + 13, 12, 5);
    // Column shaft
    g.fillStyle(0x6a5840);
    g.fillRect(x - 4, y, 8, 14);
    // Column highlight
    g.fillStyle(0x8a7860);
    g.fillRect(x - 4, y, 3, 14);
    // Capital (top)
    g.fillStyle(0x7a6850);
    g.fillRect(x - 6, y - 3, 12, 4);
    g.fillStyle(0x8a7860);
    g.fillRect(x - 6, y - 3, 12, 1);
    // Base
    g.fillStyle(0x5a4830);
    g.fillRect(x - 5, y + 13, 10, 3);
  }

  private drawBench(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Bench shadow
    g.fillStyle(0x1a1408, 0.4);
    g.fillRect(x + 2, y + h, w, 3);
    // Bench top
    g.fillStyle(0x4a3820);
    g.fillRect(x, y, w, h);
    // Bench highlight
    g.fillStyle(0x6a5030);
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y, 2, h);
  }

  private drawHangingLamp(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Chain
    g.lineStyle(1, 0x8a7050);
    g.lineBetween(x, 10, x, y);
    // Lamp bowl
    g.fillStyle(0xc09040);
    g.fillEllipse(x, y + 6, 12, 8);
    g.fillStyle(0xa07030);
    g.fillRect(x - 6, y + 4, 12, 3);
    // Flame
    g.fillStyle(0xffcc44);
    g.fillTriangle(x - 2, y + 4, x + 2, y + 4, x, y - 1);
    g.fillStyle(0xff8820, 0.7);
    g.fillTriangle(x - 1, y + 4, x + 1, y + 4, x, y + 1);
    // Glow
    g.fillStyle(0xffee88, 0.15);
    g.fillCircle(x, y + 2, 10);
  }

  private drawScrollAlcove(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Niche
    g.fillStyle(0x2a2010);
    const w = x < 100 ? 14 : -14;
    const ax = x < 100 ? x + 2 : x - 16;
    g.fillRect(ax, y, 14, 20);
    // Scroll silhouette
    g.fillStyle(0xd4c090);
    g.fillRect(ax + 2, y + 2, 10, 16);
    g.fillStyle(0xa09060);
    g.fillRect(ax + 2, y + 2, 3, 16);
    g.fillRect(ax + 9, y + 2, 3, 16);
    void w; // suppress unused warning
  }

  private drawEntryArch(g: Phaser.GameObjects.Graphics) {
    // Clear bottom wall section for doorway
    g.fillStyle(0x5a4a3a);
    g.fillRect(130, MAP_H - 10, 60, 10);
    // Arch pillars
    g.fillStyle(0x3a2c1a);
    g.fillRect(126, MAP_H - 28, 12, 28);
    g.fillRect(182, MAP_H - 28, 12, 28);
    // Lintel
    g.fillRect(126, MAP_H - 28, 68, 8);
    // Keystone
    g.fillStyle(0x6a5030);
    g.fillRect(154, MAP_H - 28, 12, 8);
    // Door frame accent
    g.lineStyle(1, 0x8a7050, 0.8);
    g.strokeRect(127, MAP_H - 27, 66, 27);
  }

  // -------------------------------------------------------------------------
  // NPCs
  // -------------------------------------------------------------------------

  private createPlayer() {
    // Player enters from the bottom, stands in the nave
    this.player = new Player(this, 160, 148);
  }

  private createNPCs() {
    // Synagogue Leader — near the bimah/front
    const leader = new NPC(this, {
      key: 'nicodemus', name: 'Synagogue Leader', x: 130, y: 50,
      interactRadius: 24,
    });

    // Pharisee — left aisle, watchful
    const pharisee = new NPC(this, {
      key: 'nicodemus', name: 'Pharisee', x: 40, y: 80,
      interactRadius: 22,
    });

    // Scribe — right aisle, seated with scroll
    const scribe = new NPC(this, {
      key: 'nicodemus', name: 'Scribe', x: 280, y: 80,
      interactRadius: 22,
    });

    // Man with unclean spirit — center nave, disheveled
    this.uncleanManNPC = new NPC(this, {
      key: 'andrew', name: 'Unclean Man', x: 160, y: 100,
      interactRadius: 28,
    });

    this.npcs = [leader, pharisee, scribe, this.uncleanManNPC];
  }

  // -------------------------------------------------------------------------
  // Dialogue events — Teaching
  // -------------------------------------------------------------------------

  private playTeachingDialogue() {
    this.dialogue.start({
      lines: [
        {
          speaker: 'Narrator',
          text: 'The Sabbath. Jesus entered the synagogue at Capernaum and began to teach.',
        },
        {
          speaker: 'Synagogue Leader',
          text: 'All are gathered. The teacher from Nazareth will speak today.',
        },
        {
          speaker: 'Jesus',
          text: '"The time has come. The kingdom of God has come near. Repent and believe the good news!"',
        },
        {
          speaker: 'Pharisee',
          text: '(whispering) He teaches as one who has authority — not as the teachers of the law.',
        },
        {
          speaker: 'Scribe',
          text: '(muttering) I have never heard it said this way. Who gave him this authority?',
        },
        {
          speaker: 'Jesus',
          text: '"You have heard it said — but I say to you..."',
        },
        {
          speaker: 'Narrator',
          text: 'The crowd is hushed. A man in the congregation begins to stir...',
        },
      ],
      onComplete: () => {
        this.teachingDone = true;
        this.time.delayedCall(600, () => this.triggerUncleanSpirit());
      },
    });
  }

  // -------------------------------------------------------------------------
  // Encounter — Man with unclean spirit
  // -------------------------------------------------------------------------

  private triggerUncleanSpirit() {
    this.dialogue.start({
      lines: [
        {
          speaker: 'Unclean Man',
          text: '"What do you want with us, Jesus of Nazareth?! Have you come to destroy us?!"',
        },
        {
          speaker: 'Unclean Man',
          text: '"I know who you are — the Holy One of God!"',
        },
        {
          speaker: 'Narrator',
          text: 'The congregation recoils. The man convulses. A choice stands before you.',
        },
      ],
      onComplete: () => this.startUncleanEncounter(),
    });
  }

  private startUncleanEncounter() {
    const save = loadSave();
    this.encounter.start(
      {
        npcName: this.uncleanManNPC.npcName,
        situation: 'A man cries out, tormented. The synagogue is afraid. What do you do?',
        onChoice: (action: EncounterAction) => {
          let s = applyEncounterChoice(save, action);

          let lines: Array<{ speaker: string; text: string }>;
          if (action === 'pray') {
            lines = [
              { speaker: 'Jesus', text: '"Be quiet! Come out of him!"' },
              { speaker: 'Narrator', text: 'The man shook violently and cried out with a loud voice — then was still.' },
              { speaker: 'Jesus', text: '"Peace."' },
            ];
          } else {
            lines = [
              { speaker: 'Narrator', text: 'You step back. The crowd murmurs. Jesus speaks.' },
              { speaker: 'Jesus', text: '"Be quiet! Come out of him!"' },
              { speaker: 'Narrator', text: 'The man shook violently and fell silent.' },
            ];
          }

          this.dialogue.start({
            lines,
            onComplete: () => {
              s = completeEpisode(s, 'call_of_peter'); // reuse placeholder episode slot
              writeSave(s);
              this.encounterDone = true;
              this.showXPPopup(action === 'pray' ? 18 : 8);
              this.time.delayedCall(500, () => this.playCrowdAmazed());
            },
          });
        },
      },
      save,
    );
  }

  private playCrowdAmazed() {
    holyFlash(this, 300);

    this.dialogue.start({
      lines: [
        {
          speaker: 'Synagogue Leader',
          text: 'What is this? A new teaching — and with authority!',
        },
        {
          speaker: 'Synagogue Leader',
          text: 'He even gives orders to impure spirits and they obey him!',
        },
        {
          speaker: 'Pharisee',
          text: '(troubled) News of this will spread through the whole region of Galilee...',
        },
        {
          speaker: 'Scribe',
          text: 'I have studied the scrolls my whole life. This man speaks differently than all of us.',
        },
        {
          speaker: 'Narrator',
          text: 'Mark 1:27 — "The people were all so amazed that they asked each other, \'What is this?\'"',
        },
      ],
      onComplete: () => {
        this.crowdAmazedDone = true;
        let save = loadSave();
        save = unlockEpisode(save, 'paralytic_healing');
        writeSave(save);
        this.scrollRoomQueued = 'scroll_authority';
      },
    });
  }

  // -------------------------------------------------------------------------
  // NPC interaction
  // -------------------------------------------------------------------------

  private interactWith(npc: NPC) {
    if (npc.npcName === 'Synagogue Leader') {
      if (!this.teachingDone) {
        this.dialogue.start({
          lines: [{ speaker: 'Synagogue Leader', text: 'Silence. The teacher is about to speak. Take your place.' }],
        });
      } else if (this.crowdAmazedDone) {
        this.dialogue.start({
          lines: [
            { speaker: 'Synagogue Leader', text: 'I have led this synagogue for twenty years. I have never seen anything like what happened today.' },
          ],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Synagogue Leader', text: 'I... I do not know what to think.' }],
        });
      }
    } else if (npc.npcName === 'Pharisee') {
      if (this.crowdAmazedDone) {
        this.dialogue.start({
          lines: [
            { speaker: 'Pharisee', text: 'He quotes no rabbi, cites no authority but his own. This is... troubling.' },
            { speaker: 'Pharisee', text: 'Or perhaps...' },
          ],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Pharisee', text: 'The law is clear. We follow the tradition of the elders.' }],
        });
      }
    } else if (npc.npcName === 'Scribe') {
      if (this.crowdAmazedDone) {
        this.dialogue.start({
          lines: [{ speaker: 'Scribe', text: 'I am copying down everything I remember of what he said. Every word.' }],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Scribe', text: 'Every word of the Torah is known to me. Yet he speaks as though he wrote it.' }],
        });
      }
    } else if (npc.npcName === 'Unclean Man') {
      if (this.encounterDone) {
        this.dialogue.start({
          lines: [
            { speaker: 'Unclean Man', text: '...I am free. I do not fully understand it. But I am free.' },
          ],
        });
      } else if (this.teachingDone) {
        // The encounter should auto-trigger; if player somehow reaches him
        this.dialogue.start({
          lines: [
            { speaker: 'Unclean Man', text: '"What do you want with us?! I know who you are!"' },
          ],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Unclean Man', text: 'The man sits in the shadows, trembling, muttering to himself.' }],
        });
      }
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
    const label = this.add.text(160, 25, 'SYNAGOGUE — CAPERNAUM', {
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
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked;

    this.dialogue.update(delta);

    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

    const justZ     = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const justSpace = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const justUp    = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up!);
    const justDown  = Phaser.Input.Keyboard.JustDown(this.cursorKeys.down!);

    if (this.dialogue.isActive) {
      if (justZ || justSpace) this.dialogue.advance();
      return;
    }

    if (this.encounter.isActive) {
      this.encounter.handleInput({ up: justUp, down: justDown, space: justSpace, enter: justUp });
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
