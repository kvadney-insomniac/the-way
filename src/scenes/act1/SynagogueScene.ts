import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode } from '../../systems/SaveSystem';
import { fadeIn } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';
import _act1Data from '../../data/dialogue/act1.json';

const MAP_W = 320;
const MAP_H = 200;

export class SynagogueScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private sequenceDone = false;
  private exitTriggered = false;

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
      fadeIn(this, 600);
      globalAudio.play('capernaum', 1500);

      // Auto-trigger teaching sequence after 2 seconds
      this.time.delayedCall(2000, () => {
        this.startTeachingSequence();
      });
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

  // ---------------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------------

  private buildMap() {
    const g = this.add.graphics();

    // Background — very dark stone
    g.fillStyle(0x1a1610);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Floor — dark stone tiles
    g.fillStyle(0x2a2420);
    g.fillRect(0, 30, MAP_W, 150);

    // Floor texture — subtle stone lines
    g.fillStyle(0x221e18);
    for (let x = 0; x < MAP_W; x += 20) {
      g.fillRect(x, 30, 1, 150);
    }
    for (let y = 30; y < 180; y += 16) {
      g.fillRect(0, y, MAP_W, 1);
    }

    // Left wall
    g.fillStyle(0x1e1a14);
    g.fillRect(0, 0, 20, MAP_H);

    // Right wall
    g.fillStyle(0x1e1a14);
    g.fillRect(300, 0, 20, MAP_H);

    // Back wall
    g.fillStyle(0x1e1a14);
    g.fillRect(0, 0, MAP_W, 36);

    // Archway hint at center of back wall (brighter rectangle)
    g.fillStyle(0x2e2820);
    g.fillRect(120, 0, 80, 36);

    // Torah Ark — centered back wall
    g.fillStyle(0x8b6914);
    g.fillRect(130, 4, 60, 32);
    g.fillStyle(0x1a0800);
    g.fillRect(136, 8, 48, 24);

    // Bimah — raised reading platform, center of room
    g.fillStyle(0x3a2a18);
    g.fillRect(120, 80, 80, 20);
    // Slightly raised appearance — lighter top, darker bottom edge
    g.fillStyle(0x4a3a28);
    g.fillRect(120, 80, 80, 2);
    g.fillStyle(0x2a1a08);
    g.fillRect(120, 98, 80, 2);

    // Stone benches — left side
    g.fillStyle(0x2a2218);
    g.fillRect(25, 100, 60, 10);
    g.fillRect(25, 130, 60, 10);
    g.fillRect(25, 160, 60, 10);

    // Stone benches — right side
    g.fillStyle(0x2a2218);
    g.fillRect(235, 100, 60, 10);
    g.fillRect(235, 130, 60, 10);
    g.fillRect(235, 160, 60, 10);

    // Torches — 4 sconces on walls
    const torchPositions: Array<[number, number]> = [
      [25, 50], [25, 130], [295, 50], [295, 130],
    ];
    torchPositions.forEach(([tx, ty]) => {
      // Sconce bracket
      g.fillStyle(0x5a4a2a);
      g.fillRect(tx - 3, ty - 6, 6, 10);
      // Torch flame (orange glow)
      g.fillStyle(0xff8820);
      g.fillCircle(tx, ty, 5);
      // Inner bright flame
      g.fillStyle(0xffcc44);
      g.fillCircle(tx, ty + 1, 2);
    });

    // Exit — southern doorway
    g.fillStyle(0x3a3020);
    g.fillRect(130, 190, 60, 12);
    // Bright opening hint
    g.fillStyle(0x5a5040);
    g.fillRect(132, 191, 56, 10);

    // Collision walls
    this.addWall(0,   0,   20,    MAP_H); // left wall
    this.addWall(300, 0,   20,    MAP_H); // right wall
    this.addWall(0,   0,   MAP_W, 36);   // back wall
    this.addWall(120, 80,  80,    20);   // bimah
    this.addWall(25,  100, 60,    10);   // bench left 1
    this.addWall(25,  130, 60,    10);   // bench left 2
    this.addWall(25,  160, 60,    10);   // bench left 3
    this.addWall(235, 100, 60,    10);   // bench right 1
    this.addWall(235, 130, 60,    10);   // bench right 2
    this.addWall(235, 160, 60,    10);   // bench right 3
    this.walls.refresh();

    // Animated torch glow — added after static map drawn
    torchPositions.forEach(([tx, ty]) => {
      this.addTorchGlow(tx, ty);
    });
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    (r.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
    this.walls.add(r);
  }

  private addTorchGlow(x: number, y: number) {
    const glow = this.add.graphics().setDepth(5);
    this.tweens.addCounter({
      from: 0, to: 100, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const raw = tween.getValue();
        const v = raw ?? 0;
        glow.clear();
        glow.fillStyle(0xff8820, 0.04 + v * 0.0008);
        glow.fillCircle(x, y, 20 + v * 0.1);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Player & NPCs
  // ---------------------------------------------------------------------------

  private createPlayer() {
    this.player = new Player(this, 160, 150);
  }

  private createNPCs() {
    const nicodemus = new NPC(this, { key: 'nicodemus', name: 'Nicodemus',     x: 160, y: 50 });
    const jesus     = new NPC(this, { key: 'jesus',     name: 'Jesus',         x: 160, y: 75 });
    const crowd1    = new NPC(this, { key: 'villager',  name: 'Villager',      x: 60,  y: 120 });
    const crowd2    = new NPC(this, { key: 'villager',  name: 'Villager',      x: 100, y: 110 });
    const crowd3    = new NPC(this, { key: 'villager',  name: 'Villager',      x: 220, y: 115 });
    const crowd4    = new NPC(this, { key: 'villager',  name: 'Villager',      x: 260, y: 120 });
    const afflicted = new NPC(this, {
      key: 'villager', name: 'Afflicted Man', x: 90, y: 100, interactRadius: 20,
    });

    this.npcs = [nicodemus, jesus, crowd1, crowd2, crowd3, crowd4, afflicted];
  }

  // ---------------------------------------------------------------------------
  // Encounter sequence
  // ---------------------------------------------------------------------------

  private startTeachingSequence() {
    // Step 1 — Jesus teaches (auto-trigger)
    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"The Spirit of the Lord is upon me, because he has anointed me to proclaim good news to the poor."',
          nameColor: '0xf0c840',
        },
      ],
      onComplete: () => this.triggerAfflictedManCryOut(),
    });
  }

  private triggerAfflictedManCryOut() {
    // Step 2 — Afflicted man cries out
    this.dialogue.start({
      lines: [
        {
          speaker: 'Afflicted Man',
          text: 'What have you to do with us, Jesus of Nazareth? Have you come to destroy us? I know who you are — the Holy One of God!',
        },
      ],
      onComplete: () => this.triggerExorcismEncounter(),
    });
  }

  private triggerExorcismEncounter() {
    // Step 3 — Encounter triggers automatically
    const save = loadSave();
    this.encounter.start(
      {
        npcName: 'Afflicted Man',
        situation: 'A man with an unclean spirit cries out in the synagogue. The crowd goes silent.',
        onChoice: (action: EncounterAction) => {
          this.handleEncounterChoice(action);
        },
      },
      save,
    );
  }

  private handleEncounterChoice(action: EncounterAction) {
    let save = loadSave();
    save = applyEncounterChoice(save, action);
    writeSave(save);

    if (action === 'pass') {
      // PASS path — crowd dialogue only
      this.dialogue.start({
        lines: [
          { speaker: 'Crowd', text: 'What is this? A new teaching — with authority!' },
        ],
        onComplete: () => this.finishSequence(),
      });
    } else {
      // Any other choice — dramatic silence, then Jesus commands, then camera shake
      this.time.delayedCall(800, () => {
        this.dialogue.start({
          lines: [
            {
              speaker: 'Jesus',
              text: '"Be silent, and come out of him!"',
              nameColor: '0xf0c840',
            },
          ],
          onComplete: () => {
            this.cameras.main.shake(600, 0.02);
            this.time.delayedCall(300, () => {
              this.dialogue.start({
                lines: [
                  { speaker: 'Afflicted Man', text: '...' },
                ],
                onComplete: () => {
                  // Launch ScrollRoom, then finish when it shuts down
                  this.scene.launch('ScrollRoomScene', { episodeKey: 'scroll_authority' });
                  this.scene.pause();
                  this.scene.get('ScrollRoomScene').events.once('shutdown', () => {
                    this.scene.resume();
                    this.finishSequence();
                  });
                },
              });
            });
          },
        });
      });
    }
  }

  private finishSequence() {
    if (this.sequenceDone) return;
    this.sequenceDone = true;

    let save = loadSave();
    save = unlockEpisode(save, 'cana_wedding');
    writeSave(save);

    // Show location label fade
    this.drawLocationLabel();
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
    const label = this.add.text(160, 25, 'SYNAGOGUE OF CAPERNAUM', {
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

  // ---------------------------------------------------------------------------
  // Player NPC interaction (manual)
  // ---------------------------------------------------------------------------

  private interactWithNPC(npc: NPC) {
    if (npc.npcName === 'Jesus') {
      this.dialogue.start({
        lines: [
          { speaker: 'Jesus', text: 'Come, follow me.', nameColor: '0xf0c840' },
        ],
      });
    } else if (npc.npcName === 'Nicodemus') {
      this.dialogue.start({
        lines: [
          { speaker: 'Nicodemus', text: 'He speaks with authority unlike any teacher I have known. This troubles me greatly.' },
        ],
      });
    } else if (npc.npcName === 'Afflicted Man') {
      this.dialogue.start({
        lines: [
          { speaker: 'Afflicted Man', text: '...' },
        ],
      });
    } else {
      this.dialogue.start({
        lines: [
          { speaker: 'Villager', text: 'Have you ever heard teaching like this? Even the unclean spirits obey him.' },
        ],
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked;

    this.dialogue.update(delta);

    this.npcs.forEach(npc => npc.checkProximity(this.player.x, this.player.y));

    // Exit trigger — player reaches southern doorway
    if (!this.exitTriggered && this.player.y > 188) {
      this.exitTriggered = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CapernaumScene');
      });
      return;
    }

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

    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWithNPC(nearby);
    }
  }
}
