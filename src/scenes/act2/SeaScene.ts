import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { NPC } from '../../entities/NPC';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { EncounterSystem, EncounterAction } from '../../systems/EncounterSystem';
import { applyEncounterChoice } from '../../systems/LOVESystem';
import { loadSave, writeSave, unlockEpisode, completeEpisode } from '../../systems/SaveSystem';
import { fadeIn, fadeToScene, holyFlash } from '../../utils/pixelTransition';
import { globalAudio } from '../../systems/AudioSystem';

const MAP_W = 320;
const MAP_H = 240;

// Fish positions on beach
const FISH_POSITIONS: Array<{ x: number; y: number; id: string }> = [
  { x: 40,  y: 75, id: 'fish0' },
  { x: 70,  y: 70, id: 'fish1' },
  { x: 110, y: 75, id: 'fish2' },
  { x: 50,  y: 65, id: 'fish3' },
  { x: 90,  y: 68, id: 'fish4' },
];

// Bread positions on beach
const BREAD_POSITIONS: Array<{ x: number; y: number; id: string }> = [
  { x: 130, y: 72, id: 'bread0' },
  { x: 145, y: 68, id: 'bread1' },
];

type FeedingPhase = 'collection' | 'blessing' | 'abundance' | 'complete';
type WaterPhase = 'idle' | 'walking_on_water' | 'sinking' | 'rescued' | 'success';

export class SeaScene extends Phaser.Scene {
  private player!: Player;
  private npcs: NPC[] = [];
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private dialogue!: DialogueSystem;
  private encounter!: EncounterSystem;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Item graphics for collectibles
  private itemGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private collectedItems: Set<string> = new Set();

  // Scene phases
  private feedingPhase: FeedingPhase = 'collection';
  private waterPhase: WaterPhase = 'idle';

  // Walking on water tracking
  private lastMovedTime = 0;
  private waterTargetGraphic?: Phaser.GameObjects.Graphics;
  private waterWallBody?: Phaser.GameObjects.Rectangle;

  // Sequence flags
  private feedingComplete = false;
  private scrollRoomQueued: string | null = null;
  private transitioning = false;

  // Peter NPC (added after feeding)
  private peterNPC?: NPC;

  constructor() {
    super({ key: 'SeaScene' });
  }

  create() {
    try {
      this.walls = this.physics.add.staticGroup();
      this.buildMap();
      this.spawnCollectibles();
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

      this.lastMovedTime = this.time.now;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('SeaScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Sky — warm gold gradient (top 0xe8c060, bottom 0x7ab8e0, 30px)
    g.fillGradientStyle(0xe8c060, 0xe8c060, 0x7ab8e0, 0x7ab8e0);
    g.fillRect(0, 0, MAP_W, 30);

    // Distant hills silhouette on horizon ~y=26
    g.fillStyle(0x4a6a3a);
    // Irregular hill heights across the horizon
    const hillPoints = [
      { x: 0,   h: 8 },
      { x: 30,  h: 14 },
      { x: 60,  h: 10 },
      { x: 90,  h: 16 },
      { x: 120, h: 12 },
      { x: 150, h: 18 },
      { x: 180, h: 11 },
      { x: 210, h: 15 },
      { x: 240, h: 9 },
      { x: 270, h: 13 },
      { x: 300, h: 10 },
      { x: 320, h: 7 },
    ];
    for (let i = 0; i < hillPoints.length - 1; i++) {
      const a = hillPoints[i];
      const b = hillPoints[i + 1];
      g.fillTriangle(a.x, 26, b.x, 26, (a.x + b.x) / 2, 26 - Math.max(a.h, b.h));
      g.fillRect(a.x, 26, b.x - a.x, b.h);
    }

    // Shore/beach — sandy (0xdcba7a), y=44 to y=88
    g.fillStyle(0xdcba7a);
    g.fillRect(0, 44, MAP_W, 44);
    // Sand texture
    g.fillStyle(0xc8a860);
    for (let x = 0; x < MAP_W; x += 20) {
      for (let y = 48; y < 86; y += 10) {
        g.fillRect(x + (y % 20 === 0 ? 6 : 0), y, 4, 1);
      }
    }

    // Water — deep blue (0x2a5fad) from y=80 to bottom
    g.fillStyle(0x2a5fad);
    g.fillRect(0, 80, MAP_W, MAP_H - 80);

    // Ripple rows
    g.fillStyle(0x3a6fbd);
    for (let y = 88; y < 240; y += 14) {
      g.fillRect(0, y, 320, 2);
    }

    // Fishing boat on water at (200, 140)
    g.fillStyle(0x7a5530);
    g.fillEllipse(200, 144, 50, 12); // hull
    g.fillStyle(0x6a4520);
    g.fillRect(198, 134, 4, 12);      // mast
    // Sail
    g.fillStyle(0xf5deb3);
    g.fillTriangle(200, 134, 218, 138, 200, 138);

    this.addWall(0, 88, MAP_W, 4); // water edge wall — blocks deep water initially
  }

  private spawnCollectibles() {
    // Fish items (circles 0x607090, 6px radius)
    for (const pos of FISH_POSITIONS) {
      const g = this.add.graphics();
      g.fillStyle(0x607090);
      g.fillCircle(pos.x, pos.y, 6);
      // Small shine
      g.fillStyle(0x8090b0);
      g.fillCircle(pos.x - 2, pos.y - 2, 2);
      g.setDepth(5);
      this.itemGraphics.set(pos.id, g);
    }

    // Bread items (rectangles 0xd4a870, 8×4px)
    for (const pos of BREAD_POSITIONS) {
      const g = this.add.graphics();
      g.fillStyle(0xd4a870);
      g.fillRect(pos.x - 4, pos.y - 2, 8, 4);
      g.fillStyle(0xb88850);
      g.fillRect(pos.x - 4, pos.y + 1, 8, 1);
      g.setDepth(5);
      this.itemGraphics.set(pos.id, g);
    }

    // Crowd suggestion: many small 2px dots on beach (y 50–85)
    const crowdG = this.add.graphics();
    crowdG.fillStyle(0x8a7060);
    const crowdDots = [
      160, 55, 170, 60, 180, 52, 190, 58, 200, 55,
      165, 68, 175, 72, 185, 65, 195, 70, 205, 66,
      155, 78, 162, 82, 172, 79, 182, 83, 192, 77,
      210, 60, 220, 54, 230, 62, 240, 57, 250, 65,
      215, 73, 225, 78, 235, 71, 245, 76, 255, 69,
      260, 58, 270, 63, 280, 56, 290, 61, 300, 55,
    ];
    for (let i = 0; i < crowdDots.length; i += 2) {
      crowdG.fillRect(crowdDots[i], crowdDots[i + 1], 2, 2);
    }
    crowdG.setDepth(4);
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    (r.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h);
    this.walls.add(r);
    return r;
  }

  private createPlayer() {
    this.player = new Player(this, 160, 72);
  }

  private createNPCs() {
    const jesus   = new NPC(this, { key: 'jesus',    name: 'Jesus',    x: 160, y: 90 });
    const peter   = new NPC(this, { key: 'peter',    name: 'Peter',    x: 80,  y: 75 });
    const disciple1 = new NPC(this, { key: 'villager', name: 'Disciple', x: 40,  y: 80 });
    const disciple2 = new NPC(this, { key: 'villager', name: 'Disciple', x: 100, y: 78 });

    this.npcs = [jesus, peter, disciple1, disciple2];
  }

  // ─── Feeding of the 5000 sequence ───────────────────────────────────────────

  private checkItemCollection() {
    if (this.feedingPhase !== 'collection') return;

    const allItems = [...FISH_POSITIONS, ...BREAD_POSITIONS];
    for (const pos of allItems) {
      if (this.collectedItems.has(pos.id)) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
      if (dist < 12) {
        this.collectItem(pos.id, pos.x, pos.y);
      }
    }

    // All 7 items collected?
    if (this.collectedItems.size >= 7 && this.feedingPhase === 'collection') {
      this.feedingPhase = 'blessing';
      this.time.delayedCall(200, () => this.startBlessingSequence());
    }
  }

  private collectItem(id: string, x: number, y: number) {
    this.collectedItems.add(id);

    // Destroy item graphic
    const g = this.itemGraphics.get(id);
    if (g) {
      g.destroy();
      this.itemGraphics.delete(id);
    }

    // Sparkle effect
    const sparkle = this.add.graphics();
    sparkle.fillStyle(0xffd700);
    sparkle.fillCircle(x, y, 5);
    sparkle.setDepth(20);
    this.tweens.add({
      targets: sparkle,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 400,
      ease: 'Power2',
      onComplete: () => sparkle.destroy(),
    });
  }

  private startBlessingSequence() {
    this.player.frozen = true;
    this.dialogue.start({
      lines: [
        { speaker: 'Boy', text: "Here — five loaves and two fish. It's all I have." },
        { speaker: 'Jesus', text: '"Bring them here to me."', nameColor: '0xf0c840' },
      ],
      onComplete: () => {
        holyFlash(this);
        this.cameras.main.flash(1000, 240, 200, 100);
        this.time.delayedCall(1000, () => this.playAbundanceAnimation());
      },
    });
  }

  private playAbundanceAnimation() {
    // 20 golden rectangle "baskets" fan out from center
    const cx = 160, cy = 80;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const basket = this.add.graphics();
      basket.fillStyle(0xd4a82a);
      basket.fillRect(-6, -4, 12, 8);
      basket.fillStyle(0xb88820);
      basket.fillRect(-6, 3, 12, 1);
      basket.setPosition(cx, cy);
      basket.setDepth(30);

      const targetX = cx + Math.cos(angle) * (40 + Math.random() * 40);
      const targetY = cy + Math.sin(angle) * (20 + Math.random() * 20);

      this.tweens.add({
        targets: basket,
        x: targetX,
        y: targetY,
        alpha: { from: 1, to: 0.8 },
        duration: 800 + i * 30,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: basket,
            alpha: 0,
            delay: 1500,
            duration: 600,
            onComplete: () => basket.destroy(),
          });
        },
      });
    }

    this.time.delayedCall(1200, () => {
      this.dialogue.start({
        lines: [
          {
            speaker: 'Jesus',
            text: '"Gather up the fragments left over, that nothing may be lost."',
            nameColor: '0xf0c840',
          },
        ],
        onComplete: () => this.completeFeedingEpisode(),
      });
    });
  }

  private completeFeedingEpisode() {
    let save = loadSave();
    save = unlockEpisode(save, 'feeding_5000');
    save = completeEpisode(save, 'feeding_5000');
    writeSave(save);

    this.feedingPhase = 'complete';
    this.feedingComplete = true;
    this.player.frozen = false;

    this.scrollRoomQueued = 'scroll_feeding';
  }

  // ─── Walking on Water sequence ───────────────────────────────────────────────

  private startWalkingOnWaterSequence() {
    // Move boat position and reveal Peter
    this.showPeterAtBoat();
  }

  private showPeterAtBoat() {
    // Peter NPC appears at boat position
    this.peterNPC = new NPC(this, { key: 'peter', name: 'Peter', x: 180, y: 160 });
    this.npcs.push(this.peterNPC);

    this.time.delayedCall(800, () => {
      this.dialogue.start({
        lines: [
          {
            speaker: 'Peter',
            text: 'Lord, if it is you, command me to come to you on the water.',
          },
          { speaker: 'Jesus', text: '"Come."', nameColor: '0xf0c840' },
        ],
        onComplete: () => this.beginWalkOnWater(),
      });
    });
  }

  private beginWalkOnWater() {
    this.waterPhase = 'walking_on_water';

    // Remove the shore wall so player can step onto water
    this.walls.clear(true, true);

    // Move player to water start
    this.player.setPosition(180, 100);
    this.player.frozen = false;
    this.lastMovedTime = this.time.now;

    // Show glowing target point at boat
    this.waterTargetGraphic = this.add.graphics();
    this.waterTargetGraphic.fillStyle(0xffd700);
    this.waterTargetGraphic.fillCircle(180, 160, 5);
    this.waterTargetGraphic.lineStyle(1, 0xffffff, 0.7);
    this.waterTargetGraphic.strokeCircle(180, 160, 8);
    this.waterTargetGraphic.setDepth(25);

    // Hint message
    const hint = this.add.text(160, 30, 'Keep moving! Don\'t stop!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px', color: '#ffd700', resolution: 3,
      backgroundColor: '#00000099',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2500,
      duration: 600,
      onComplete: () => hint.destroy(),
    });
  }

  private triggerSinking() {
    if (this.waterPhase !== 'walking_on_water') return;
    this.waterPhase = 'sinking';
    this.player.frozen = true;

    // Screen darkens
    const darkOverlay = this.add.graphics().setScrollFactor(0).setDepth(150);
    darkOverlay.fillStyle(0x000033, 0.5);
    darkOverlay.fillRect(0, 0, MAP_W, MAP_H);
    this.tweens.add({
      targets: darkOverlay,
      alpha: { from: 0, to: 1 },
      duration: 600,
    });

    this.time.delayedCall(400, () => {
      this.dialogue.start({
        lines: [
          { speaker: 'Peter', text: 'Lord, save me!' },
          {
            speaker: 'Jesus',
            text: '"O you of little faith, why did you doubt?"',
            nameColor: '0xf0c840',
          },
        ],
        onComplete: () => {
          this.tweens.add({
            targets: darkOverlay,
            alpha: 0,
            duration: 800,
            onComplete: () => darkOverlay.destroy(),
          });
          this.waterPhase = 'rescued';
          this.player.frozen = false;
          this.completeWalkingEpisode();
        },
      });
    });
  }

  private triggerWaterSuccess() {
    if (this.waterPhase !== 'walking_on_water') return;
    this.waterPhase = 'success';
    this.player.frozen = true;

    if (this.waterTargetGraphic) {
      this.waterTargetGraphic.destroy();
      this.waterTargetGraphic = undefined;
    }

    // Import cosmicGlitch dynamically or inline glitch effect
    import('../../utils/pixelTransition').then(({ cosmicGlitch }) => {
      cosmicGlitch(this);
    });

    this.time.delayedCall(500, () => {
      this.dialogue.start({
        lines: [
          { speaker: 'Disciple', text: 'Truly, you are the Son of God.' },
        ],
        onComplete: () => {
          this.player.frozen = false;
          this.completeWalkingEpisode();
        },
      });
    });
  }

  private completeWalkingEpisode() {
    let save = loadSave();
    save = unlockEpisode(save, 'walking_water');
    save = completeEpisode(save, 'walking_water');
    writeSave(save);

    this.scrollRoomQueued = 'scroll_walk_water';
  }

  // ─── HUD & Labels ────────────────────────────────────────────────────────────

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
    const label = this.add.text(160, 25, 'SEA OF GALILEE', {
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

  // ─── Update loop ─────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    const blocked = this.dialogue.isActive || this.encounter.isActive;
    this.player.frozen = blocked || this.waterPhase === 'sinking';

    this.dialogue.update(delta);

    // NPC proximity checks
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

    // ScrollRoom queued
    if (this.scrollRoomQueued) {
      const key = this.scrollRoomQueued;
      this.scrollRoomQueued = null;

      // After feeding complete, kick off walking on water
      if (key === 'scroll_feeding') {
        this.time.delayedCall(300, () => {
          this.scene.launch('ScrollRoomScene', { episodeKey: key });
          this.scene.pause();
          this.scene.resume('SeaScene');
          this.time.delayedCall(100, () => this.startWalkingOnWaterSequence());
        });
        return;
      }

      this.time.delayedCall(300, () => {
        this.scene.launch('ScrollRoomScene', { episodeKey: key });
        this.scene.pause();
      });
      return;
    }

    // Collectible picking (feeding phase)
    if (this.feedingPhase === 'collection') {
      this.checkItemCollection();
    }

    // Walking on water mechanics
    if (this.waterPhase === 'walking_on_water') {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const isMoving = Math.abs(body.velocity.x) > 5 || Math.abs(body.velocity.y) > 5;

      if (isMoving) {
        this.lastMovedTime = this.time.now;
      } else if (this.time.now - this.lastMovedTime > 1500) {
        // Player stopped too long — sink!
        this.triggerSinking();
        return;
      }

      // Check if player reached boat position
      const distToBoat = Phaser.Math.Distance.Between(this.player.x, this.player.y, 180, 160);
      if (distToBoat < 14) {
        this.triggerWaterSuccess();
        return;
      }
    }

    // NPC interaction
    if (justZ || justSpace) {
      const nearby = this.npcs.find(n => n.canInteract);
      if (nearby) this.interactWith(nearby);
    }

    // West exit → MountainScene
    if (!this.transitioning && this.player.x < 5) {
      this.transitioning = true;
      fadeToScene(this, 'MountainScene');
    }
  }

  private interactWith(npc: NPC) {
    if (npc.npcName === 'Jesus') {
      this.dialogue.start({
        lines: [
          {
            speaker: 'Jesus',
            text: '"I am the bread of life; whoever comes to me shall not hunger, and whoever believes in me shall never thirst."',
            nameColor: '0xf0c840',
          },
        ],
      });
    } else if (npc.npcName === 'Peter') {
      if (!this.feedingComplete) {
        this.dialogue.start({
          lines: [{ speaker: 'Peter', text: "There's so many people... We don't have enough food for all of them." }],
        });
      } else {
        this.dialogue.start({
          lines: [{ speaker: 'Peter', text: 'I saw it. He fed them all — five loaves, two fish. Nothing is impossible with him.' }],
        });
      }
    } else {
      // Disciple generic lines
      const lines = [
        [{ speaker: 'Disciple', text: 'Five thousand men, and He fed them all. I saw it myself.' }],
        [{ speaker: 'Disciple', text: 'The wind picked up after sunset. The master told us to go ahead to the other shore.' }],
      ];
      this.dialogue.start({ lines: lines[Math.floor(Math.random() * lines.length)] });
    }
  }
}
