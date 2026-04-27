import Phaser from 'phaser';

export interface NPCConfig {
  key: string;
  name: string;
  x: number;
  y: number;
  tint?: number;
  interactRadius?: number;
}

export class NPC extends Phaser.Physics.Arcade.Sprite {
  public npcName: string;
  public interactRadius: number;
  private indicator!: Phaser.GameObjects.Text;
  public canInteract = false;

  constructor(scene: Phaser.Scene, config: NPCConfig) {
    super(scene, config.x, config.y, config.key);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.npcName = config.name;
    this.interactRadius = config.interactRadius ?? 24;
    this.setDepth(5);
    if (config.tint) this.setTint(config.tint);

    this.indicator = scene.add.text(config.x, config.y - 12, '!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#c9a84c',
      resolution: 4,
    }).setOrigin(0.5).setDepth(15).setVisible(false);
  }

  checkProximity(playerX: number, playerY: number) {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    this.canInteract = dist <= this.interactRadius;
    this.indicator.setVisible(this.canInteract);
    // Bounce the indicator
    if (this.canInteract) {
      const bounce = Math.sin(this.scene.time.now * 0.006) * 2;
      this.indicator.setY(this.y - 12 + bounce);
    }
  }
}
