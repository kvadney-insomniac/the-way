import Phaser from 'phaser';

const SPEED = 60;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  public facing: 'up' | 'down' | 'left' | 'right' = 'down';
  public frozen = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(10);
    // Smaller hitbox than sprite
    (this.body as Phaser.Physics.Arcade.Body).setSize(10, 8).setOffset(3, 8);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (this.frozen) {
      this.setVelocity(0, 0);
      this.anims.stop();
      return;
    }

    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    let vx = 0, vy = 0;
    if (left)  { vx = -SPEED; this.facing = 'left'; }
    if (right) { vx =  SPEED; this.facing = 'right'; }
    if (up)    { vy = -SPEED; this.facing = 'up'; }
    if (down)  { vy =  SPEED; this.facing = 'down'; }

    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    this.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      this.playAnim(`walk_${this.facing}`);
    } else {
      this.playAnim(`idle_${this.facing}`);
    }
  }

  private playAnim(key: string) {
    if (this.scene.anims.exists(key) && this.anims.currentAnim?.key !== key) {
      this.play(key, true);
    }
  }
}
