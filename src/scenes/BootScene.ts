import Phaser from 'phaser';

/**
 * BootScene: Generates all placeholder pixel art sprites programmatically.
 * When real sprite sheets are added to public/assets/sprites/, swap the
 * texture keys here and remove the programmatic generation.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.createLoadingScreen();
    // Kenney CC0 asset packs (downloaded to public/assets/sprites/)
    // tilemap_packed.png = zero gap between tiles (192 = 12×16 exactly)
    this.load.spritesheet('kenney-town', 'assets/sprites/tiny-town/Tilemap/tilemap_packed.png', {
      frameWidth: 16, frameHeight: 16,
    });
    // roguelikeChar has 1px spacing between tiles (918 = 54×16 + 54×1)
    this.load.spritesheet('kenney-chars', 'assets/sprites/roguelike-chars/Spritesheet/roguelikeChar_transparent.png', {
      frameWidth: 16, frameHeight: 16, spacing: 1,
    });
  }

  create() {
    this.generateSprites();
    this.createAnimations();
    const devScene = new URLSearchParams(window.location.search).get('scene');
    this.scene.start(devScene ?? 'TitleScene');
  }

  private createLoadingScreen() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2 - 10, 'THE WAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#c9a84c',
      resolution: 3,
    }).setOrigin(0.5);

    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x1a120a);
      bar.fillRect(width / 2 - 50, height / 2 + 8, 100, 6);
      bar.fillStyle(0xc9a84c);
      bar.fillRect(width / 2 - 50, height / 2 + 8, 100 * v, 6);
    });
  }

  private generateSprites() {
    this.generatePlayerTexture();
    // Each NPC gets distinct robes + hair — EarthBound-style pixel art
    this.generateNPCTexture('andrew',    0x8b5e3c, 0x3a2010); // brown robe, dark hair
    this.generateNPCTexture('peter',     0x3a6090, 0x6a3a10); // blue robe, auburn
    this.generateNPCTexture('jesus',     0xf0ebe0, 0x5a3a18); // cream robe, light brown
    this.generateNPCTexture('woman',     0x9b4a8a, 0x3a2010); // purple robe, dark hair
    this.generateNPCTexture('nicodemus', 0x1a3a5c, 0x909090); // navy robe, gray hair
    this.generateNPCTexture('judas',     0x4a6a30, 0x2a1a08); // green robe, black hair
    this.generateNPCTexture('mary',      0x3a6a9a, 0x2a1a08); // blue robe
    this.generateNPCTexture('child',     0xc8a850, 0x5a3a10); // yellow tunic, brown hair
    this.generateNPCTexture('pharisee',  0x4a4a4a, 0x909090); // dark robes, gray
    this.generateNPCTexture('villager',  0xa07840, 0x3a2010); // tan robe
    this.generateTileset();
  }

  private generatePlayerTexture() {
    const fw = 16, fh = 16;
    const totalW = fw * 12;
    // Use add.graphics so it renders correctly in WebGL context
    const g = this.add.graphics();
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((_, di) => {
      for (let frame = 0; frame < 3; frame++) {
        const fx = (di * 3 + frame) * fw;
        const fy = 0;
        g.fillStyle(0xc4955a); g.fillRect(fx + 4, fy + 6, 8, 7);
        g.fillStyle(0xd4b896); g.fillRect(fx + 4, fy + 1, 8, 6);
        g.fillStyle(0x3a2010);
        if (di === 0) { g.fillRect(fx + 5, fy + 3, 2, 1); g.fillRect(fx + 9, fy + 3, 2, 1); }
        if (di === 1) { g.fillRect(fx + 4, fy + 3, 2, 1); }
        if (di === 2) { g.fillRect(fx + 10, fy + 3, 2, 1); }
        g.fillStyle(0x6b4c2a);
        if (frame === 0) {
          g.fillRect(fx + 5, fy + 13, 3, 3); g.fillRect(fx + 8, fy + 13, 3, 3);
        } else if (frame === 1) {
          g.fillRect(fx + 4, fy + 12, 3, 4); g.fillRect(fx + 9, fy + 14, 3, 2);
        } else {
          g.fillRect(fx + 4, fy + 14, 3, 2); g.fillRect(fx + 9, fy + 12, 3, 4);
        }
      }
    });
    g.generateTexture('player', totalW, fh);
    g.destroy();
    // Split the generated atlas into per-frame crops
    this.splitAtlas('player', fw, fh, 12);
  }

  private generateNPCTexture(key: string, bodyColor: number, hairColor: number) {
    const g   = this.add.graphics();
    const sk  = 0xd4a070;                                        // skin
    const dk  = 0x2a1a08;                                        // dark detail
    const sh  = Math.max(0, bodyColor - 0x222222);               // shadow robe
    const ft  = 0x4a2a10;                                        // feet/sandals

    // --- hair (row 0, full width) ---
    g.fillStyle(hairColor);
    g.fillRect(3, 0, 10, 2);

    // --- head (rows 1-6) ---
    g.fillStyle(sk);
    g.fillRect(3, 1, 10, 6);

    // --- eyes ---
    g.fillStyle(dk);
    g.fillRect(5, 3, 2, 1);
    g.fillRect(9, 3, 2, 1);

    // --- nose dot ---
    g.fillStyle(0xb07840);
    g.fillRect(7, 4, 2, 1);

    // --- shoulders (slightly wider than body for silhouette) ---
    g.fillStyle(bodyColor);
    g.fillRect(2, 7, 12, 1);

    // --- body/robe (rows 8-11) ---
    g.fillRect(3, 8, 10, 4);

    // --- belt / sash accent ---
    g.fillStyle(sh);
    g.fillRect(3, 10, 10, 1);

    // --- lower robe / legs (rows 12-13) ---
    g.fillStyle(bodyColor);
    g.fillRect(4, 12, 3, 2);
    g.fillRect(9, 12, 3, 2);

    // --- sandals / feet (rows 14-15) ---
    g.fillStyle(ft);
    g.fillRect(4, 14, 3, 2);
    g.fillRect(9, 14, 3, 2);

    // --- Jesus: cream robe highlight + gold glow border ---
    if (key === 'jesus') {
      g.fillStyle(0xfff8f0);
      g.fillRect(5, 8, 6, 3);          // robe highlight stripe
      g.fillStyle(0xf0c840);
      g.fillRect(3, 10, 10, 1);        // gold belt
      g.lineStyle(1, 0xfff4cc, 0.85);
      g.strokeRect(2, 0, 12, 16);      // glow outline
    }

    // --- Nicodemus: scholar cap ---
    if (key === 'nicodemus') {
      g.fillStyle(0x1a1a3a);
      g.fillRect(3, 0, 10, 2);         // dark cap over hair
    }

    // --- Pharisee: white stripe on dark robe ---
    if (key === 'pharisee') {
      g.fillStyle(0xffffff);
      g.fillRect(3, 8, 2, 4);          // tzitzit stripe
    }

    g.generateTexture(key, 16, 16);
    g.destroy();
  }

  /** Register numbered frames on an atlas texture so animations can reference them */
  private splitAtlas(key: string, fw: number, fh: number, count: number) {
    const tex = this.textures.get(key);
    // Remove the auto-created full-width frame 0 and replace with correct crops
    tex.remove('0');
    for (let i = 0; i < count; i++) {
      tex.add(i, 0, i * fw, 0, fw, fh);
    }
  }

  private generateTileset() {
    const g = this.add.graphics();
    const ts = 16;

    // Tile 0: sand/ground
    g.fillStyle(0xc8a870); g.fillRect(0, 0, ts, ts);
    g.fillStyle(0xb8986a); g.fillRect(2, 3, 3, 2); g.fillRect(9, 8, 4, 2); g.fillRect(5, 12, 3, 2);

    // Tile 1: water
    g.fillStyle(0x2a5fad); g.fillRect(ts, 0, ts, ts);
    g.fillStyle(0x3a7fcd); g.fillRect(ts+2, 4, 5, 2); g.fillRect(ts+9, 8, 4, 2);

    // Tile 2: stone path
    g.fillStyle(0x9a8870); g.fillRect(ts*2, 0, ts, ts);
    g.lineStyle(1, 0x8a7860); g.strokeRect(ts*2+2, 2, 6, 6); g.strokeRect(ts*2+9, 8, 5, 5);

    // Tile 3: grass
    g.fillStyle(0x5a8a3a); g.fillRect(ts*3, 0, ts, ts);
    g.fillStyle(0x4a7a2a); g.fillRect(ts*3+3, 5, 1, 4); g.fillRect(ts*3+7, 3, 1, 5); g.fillRect(ts*3+11, 6, 1, 3);

    // Tile 4: wall (stone)
    g.fillStyle(0x7a6a5a); g.fillRect(ts*4, 0, ts, ts);
    g.fillStyle(0x6a5a4a);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      g.fillRect(ts*4 + c*8 + 1, r*8 + 1, 6, 6);
    }

    // Tile 5: dock/wood
    g.fillStyle(0x7a5530); g.fillRect(ts*5, 0, ts, ts);
    g.fillStyle(0x6a4520);
    for (let i = 0; i < 4; i++) g.fillRect(ts*5, i*4, ts, 1);

    g.generateTexture('tileset', ts * 6, ts);
    g.destroy();
  }

  private createAnimations() {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir, i) => {
      const base = i * 3;
      this.anims.create({
        key: `walk_${dir}`,
        frames: this.anims.generateFrameNumbers('player', { frames: [base, base+1, base+2, base+1] }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `idle_${dir}`,
        frames: this.anims.generateFrameNumbers('player', { frames: [base] }),
        frameRate: 1,
        repeat: -1,
      });
    });
  }
}
