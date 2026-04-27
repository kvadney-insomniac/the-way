import Phaser from 'phaser';

/**
 * Silence is a tool. The most sacred moments have no music.
 * The game trains you to associate silence with the presence of God.
 */

export type MusicTrack =
  | 'capernaum'
  | 'sea_of_galilee'
  | 'jerusalem'
  | 'upper_room'
  | 'gethsemane'
  | 'empty_tomb'
  | 'emmaus'
  | 'title';

export class AudioSystem {
  private scene: Phaser.Scene;
  private current: Phaser.Sound.BaseSound | null = null;
  private currentKey: string | null = null;
  private muted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  play(key: MusicTrack, fadeMs = 1500) {
    if (this.currentKey === key || this.muted) return;

    const prev = this.current;
    if (prev) {
      this.scene.tweens.add({
        targets: prev,
        volume: 0,
        duration: fadeMs,
        onComplete: () => prev.stop(),
      });
    }

    // Only play if the audio key exists in the cache
    if (!this.scene.cache.audio.exists(key)) return;

    const next = this.scene.sound.add(key, { loop: true, volume: 0 });
    next.play();
    this.scene.tweens.add({
      targets: next,
      volume: 0.4,
      duration: fadeMs,
    });

    this.current = next;
    this.currentKey = key;
  }

  /** Sacred silence — fade out everything */
  silence(fadeMs = 2000) {
    if (!this.current) return;
    const prev = this.current;
    this.scene.tweens.add({
      targets: prev,
      volume: 0,
      duration: fadeMs,
      onComplete: () => prev.stop(),
    });
    this.current = null;
    this.currentKey = null;
  }

  stop() {
    this.current?.stop();
    this.current = null;
    this.currentKey = null;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.silence(300);
  }
}
