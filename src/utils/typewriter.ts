/**
 * Typewriter utility — steps through a string char by char.
 * Used by DialogueSystem for Undertale-style text reveal.
 */
export class Typewriter {
  private full = '';
  private revealed = 0;
  private accumMs = 0;
  private msPerChar: number;

  constructor(msPerChar = 30) {
    this.msPerChar = msPerChar;
  }

  start(text: string) {
    this.full = text;
    this.revealed = 0;
    this.accumMs = 0;
  }

  update(deltaMs: number): string {
    if (this.revealed >= this.full.length) return this.full;
    this.accumMs += deltaMs;
    const chars = Math.floor(this.accumMs / this.msPerChar);
    if (chars > 0) {
      this.accumMs -= chars * this.msPerChar;
      this.revealed = Math.min(this.full.length, this.revealed + chars);
    }
    return this.full.slice(0, this.revealed);
  }

  complete(): string {
    this.revealed = this.full.length;
    return this.full;
  }

  get isDone() { return this.revealed >= this.full.length; }
  get current() { return this.full.slice(0, this.revealed); }
}
