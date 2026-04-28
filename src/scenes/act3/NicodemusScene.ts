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

export class NicodemusScene extends Phaser.Scene {
  constructor() { super({ key: 'NicodemusScene' }); }

  private player!: Player;
  private npcs: NPC[] = [];
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private dialogueTriggered = false;
  private transitioning = false;
  private scrollRoomQueued: string | null = null;

  create() {
    try {
      this.dialogueTriggered = false;
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

      this.drawLocationLabel();
      fadeIn(this, 800);
      globalAudio.silence(600);

      // suppress unused import warnings
      void holyFlash;
      void cosmicGlitch;
      void unlockEpisode;
      void completeEpisode;
      void writeSave;
      void applyEncounterChoice;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('NicodemusScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Sky — very dark blue, full map
    g.fillStyle(0x060810);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Stars — fixed positions for determinism, spread across first 60px height
    g.fillStyle(0xffffff);
    const starPositions = [
      [12,5],[30,12],[55,3],[78,18],[100,8],[125,15],[148,4],[165,10],
      [188,18],[205,6],[228,14],[250,3],[272,11],[295,7],[308,16],
      [20,25],[48,32],[70,22],[93,38],[115,28],[140,35],[162,24],
      [185,40],[210,30],[235,22],[258,36],[280,28],[300,38],[315,25],
    ];
    for (const [sx, sy] of starPositions) {
      g.fillRect(sx, sy, 1, 1);
    }

    // A few brighter stars (2x2)
    g.fillRect(42, 8, 2, 2);
    g.fillRect(180, 22, 2, 2);
    g.fillRect(260, 12, 2, 2);

    // Rooftop floor — stone
    g.fillStyle(0x1e1a14);
    g.fillRect(0, 100, MAP_W, MAP_H - 100);
    // Stone texture
    g.fillStyle(0x181410);
    for (let x = 0; x < MAP_W; x += 28) {
      for (let y = 102; y < MAP_H; y += 16) {
        g.fillRect(x + ((y % 32 === 0) ? 4 : 0), y, 24, 13);
      }
    }

    // Low walls at edges
    g.fillStyle(0x2a2418);
    g.fillRect(0, 96, 14, MAP_H - 96);    // left wall
    g.fillRect(MAP_W - 14, 96, 14, MAP_H - 96); // right wall
    g.fillRect(0, 94, MAP_W, 8);            // back parapet

    // Lantern — orange glow at (80, 110)
    g.fillStyle(0xff9020);
    g.fillCircle(80, 110, 8);
    g.fillStyle(0xffb040);
    g.fillCircle(80, 110, 4);
    // Lantern hook/post
    g.fillStyle(0x3a2a10);
    g.fillRect(78, 100, 4, 12);

    // Lantern pulsing tween
    const lanternGlow = this.add.graphics();
    lanternGlow.fillStyle(0xff8010, 0.3);
    lanternGlow.fillCircle(80, 110, 16);
    this.tweens.add({
      targets: lanternGlow,
      alpha: 0.6,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Second lantern
    g.fillStyle(0xff9020);
    g.fillCircle(240, 110, 6);
    g.fillStyle(0xffb040);
    g.fillCircle(240, 110, 3);
    g.fillStyle(0x3a2a10);
    g.fillRect(238, 102, 4, 10);

    // Potted plants — dark silhouettes
    g.fillStyle(0x0e1808);
    g.fillEllipse(30, 108, 14, 8);
    g.fillRect(26, 106, 8, 8);
    g.fillEllipse(290, 108, 14, 8);
    g.fillRect(286, 106, 8, 8);
    // Stems
    g.fillRect(29, 100, 2, 8);
    g.fillRect(289, 100, 2, 8);
    g.fillEllipse(30, 98, 8, 5);
    g.fillEllipse(290, 98, 8, 5);
  }

  private createPlayer() {
    this.player = new Player(this, 160, 150);
  }

  private createNPCs() {
    const nicodemus = new NPC(this, { key: 'nicodemus', name: 'Nicodemus', x: 80,  y: 130 });
    const jesus     = new NPC(this, { key: 'jesus',     name: 'Jesus',     x: 220, y: 130 });
    this.npcs = [nicodemus, jesus];
  }

  private drawLocationLabel() {
    const label = this.add.text(160, 52, 'NICODEMUS — NIGHT', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px', color: '#8898cc', resolution: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 3000,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  private triggerNicodemusDialogue() {
    if (this.dialogueTriggered) return;
    this.dialogueTriggered = true;
    this.player.frozen = true;

    this.dialogue.start({
      lines: [
        {
          speaker: 'Nicodemus',
          text: 'Rabbi, we know you are a teacher come from God, for no one can do these signs unless God is with him.',
        },
        {
          speaker: 'Jesus',
          text: '"Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God."',
          nameColor: 0xf0c840,
        },
        {
          speaker: 'Nicodemus',
          text: 'How can a man be born when he is old? Can he enter a second time into his mother\'s womb?',
        },
        {
          speaker: 'Jesus',
          text: '"The wind blows where it wishes, and you hear its sound, but you do not know where it comes from or where it goes. So it is with everyone who is born of the Spirit."',
          nameColor: 0xf0c840,
        },
        {
          speaker: 'Nicodemus',
          text: 'How can these things be?',
        },
        {
          speaker: 'Jesus',
          text: '"For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life."',
          nameColor: 0xf0c840,
        },
      ],
      onComplete: () => this.afterNicodemusDialogue(),
    });
  }

  private afterNicodemusDialogue() {
    // Wind effect — camera shake 400ms
    this.cameras.main.shake(400, 0.006);
    // Light intensity — brief flash
    this.time.delayedCall(200, () => {
      this.cameras.main.flash(300, 180, 200, 255, true);
    });

    this.time.delayedCall(800, () => {
      this.player.frozen = false;
      this.scrollRoomQueued = 'scroll_born_again';
    });
  }

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked || (this.dialogueTriggered && !this.dialogue.isActive && this.scrollRoomQueued !== null);

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

    // Trigger dialogue when player approaches Nicodemus
    if (!this.dialogueTriggered) {
      const nicodemus = this.npcs.find(n => n.npcName === 'Nicodemus');
      if (nicodemus && nicodemus.canInteract) {
        if (justZ || justSpace) {
          this.triggerNicodemusDialogue();
          return;
        }
      }
    }

    // Exits
    if (!this.transitioning) {
      // East edge → TempleScene
      if (this.player.x > 315) {
        this.transitioning = true;
        fadeToScene(this, 'TempleScene');
      }
      // South edge → JerusalemScene
      if (this.player.y > 175) {
        this.transitioning = true;
        fadeToScene(this, 'JerusalemScene');
      }
    }
  }
}
