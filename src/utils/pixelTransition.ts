import Phaser from 'phaser';

/** Pixel dissolve fade-out, then fade-in for scene transitions */
export function fadeToScene(scene: Phaser.Scene, targetKey: string, data?: object) {
  scene.cameras.main.fadeOut(400, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start(targetKey, data);
  });
}

/** Warm golden fade-in on scene start */
export function fadeIn(scene: Phaser.Scene, duration = 600) {
  scene.cameras.main.fadeIn(duration, 13, 10, 7);
}

/** Flash white — for miracles, cosmic moments */
export function holyFlash(scene: Phaser.Scene, duration = 200) {
  scene.cameras.main.flash(duration, 255, 255, 240, true);
}

/** Glitch effect for Transfiguration / Resurrection */
export function cosmicGlitch(scene: Phaser.Scene) {
  let count = 0;
  const timer = scene.time.addEvent({
    delay: 60,
    repeat: 6,
    callback: () => {
      count++;
      if (count % 2 === 0) {
        scene.cameras.main.setRotation(Phaser.Math.FloatBetween(-0.015, 0.015));
        scene.cameras.main.setZoom(Phaser.Math.FloatBetween(0.97, 1.03));
      } else {
        scene.cameras.main.setRotation(0);
        scene.cameras.main.setZoom(1);
      }
      if (count >= 7) {
        scene.cameras.main.setRotation(0);
        scene.cameras.main.setZoom(1);
        timer.destroy();
      }
    },
  });
}
