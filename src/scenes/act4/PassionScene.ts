import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { DialogueSystem } from '../../systems/DialogueSystem';
import { fadeToScene } from '../../utils/pixelTransition';

// No music — silence IS the sound here.

const MAP_W = 320;
const MAP_H = 180;

export class PassionScene extends Phaser.Scene {
  constructor() { super({ key: 'PassionScene' }); }

  private player!: Player;
  private dialogue!: DialogueSystem;
  private cross!: Phaser.GameObjects.Graphics;
  private crossBrightTimer = 0;
  private crossBright = false;

  create() {
    try {
      this.buildMap();
      this.createPlayer();

      // Player is frozen throughout — invisible cinematic
      this.player.frozen = true;
      this.player.setAlpha(0);

      this.dialogue = new DialogueSystem(this);

      // No input captured — this is a pure cinematic

      this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
      this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

      // Start fully black
      this.cameras.main.setAlpha(0);

      // Begin the cinematic sequence
      this.runCinematic();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message + '\n' + (err.stack ?? '') : String(err);
      this.add.text(160, 90, 'SCENE ERROR:\n' + msg, {
        fontFamily: 'monospace', fontSize: '5px', color: '#ff4444',
        wordWrap: { width: 300 }, resolution: 3,
        backgroundColor: '#000000',
      }).setDepth(999).setOrigin(0.5).setScrollFactor(0);
      console.error('PassionScene.create error:', err);
    }
  }

  private buildMap() {
    const g = this.add.graphics();

    // Background — very dark brown-black
    g.fillStyle(0x080604);
    g.fillRect(0, 0, MAP_W, MAP_H);

    // Hill silhouette (Golgotha) — simple triangle/polygon centered
    g.fillStyle(0x100c08);
    // Triangle: base at y=MAP_H, peak at roughly (160, 80)
    const hillPoints = [
      { x: 60,    y: MAP_H },
      { x: 260,   y: MAP_H },
      { x: 200,   y: 95 },
      { x: 160,   y: 78 },
      { x: 120,   y: 95 },
    ];
    g.fillPoints(hillPoints, true);

    // Ground — black
    g.fillStyle(0x050302);
    g.fillRect(0, MAP_H - 10, MAP_W, 10);

    // One faint star remaining in sky
    g.fillStyle(0x403848, 0.6);
    g.fillRect(60, 20, 1, 1);

    // The Cross — drawn via graphics, stored in this.cross for animation
    this.cross = this.add.graphics();
    this.drawCross(false);
  }

  private drawCross(bright: boolean) {
    this.cross.clear();
    const baseColor = bright ? 0x5a3c28 : 0x4a3020;

    // Vertical beam: 4px wide, 60px tall, centered at x=160, base at y=135
    this.cross.fillStyle(baseColor);
    this.cross.fillRect(158, 75, 4, 60);

    // Horizontal beam: 40px wide, 4px tall, at y=92
    this.cross.fillStyle(baseColor);
    this.cross.fillRect(140, 92, 40, 4);
  }

  private runCinematic() {
    // Step 1: Screen fully black (already set in create). After 500ms, slow fade in.
    this.time.delayedCall(500, () => {
      this.cameras.main.fadeIn(3000, 8, 6, 4);
    });

    // Step 2: After 2000ms total — first word from the cross
    this.time.delayedCall(2000, () => {
      this.dialogue.start({
        lines: [
          {
            speaker: 'Jesus',
            text: '"Father, forgive them, for they know not what they do."',
            nameColor: '0xf0c840',
          },
        ],
        onComplete: () => {
          // Silence after first word
          this.time.delayedCall(3000, () => {
            this.speakFinalWord();
          });
        },
      });
    });
  }

  private speakFinalWord() {
    this.dialogue.start({
      lines: [
        {
          speaker: 'Jesus',
          text: '"It is finished."',
          nameColor: '0xf0c840',
        },
      ],
      onComplete: () => {
        // Screen shakes gently
        this.cameras.main.shake(1000, 0.008);

        // Begin fadeout after 2 seconds
        this.time.delayedCall(2000, () => {
          this.cameras.main.fadeOut(4000, 0, 0, 0);
        });

        // After fadeout: 5 seconds of pure black, then slow white fade, then TombScene
        this.cameras.main.once('camerafadeoutcomplete', () => {
          // Pure black for 5 seconds of silence
          this.time.delayedCall(5000, () => {
            // Very slow fade in of white
            this.cameras.main.fadeIn(3000, 255, 255, 255);
            this.cameras.main.once('camerafadeincomplete', () => {
              // Brief beat, then transition
              this.time.delayedCall(500, () => {
                fadeToScene(this, 'TombScene');
              });
            });
          });
        });
      },
    });
  }

  private createPlayer() {
    // Player exists but is invisible — cinematic only
    this.player = new Player(this, 160, 160);
  }

  update(_time: number, delta: number) {
    this.dialogue.update(delta);

    // Cross subtle pixel animation: every 2 seconds, briefly 1px brighter
    this.crossBrightTimer += delta;
    if (this.crossBrightTimer >= 2000 && !this.crossBright) {
      this.crossBright = true;
      this.crossBrightTimer = 0;
      this.drawCross(true);
      // Return to dim after 120ms
      this.time.delayedCall(120, () => {
        this.crossBright = false;
        this.drawCross(false);
      });
    }
  }
}
