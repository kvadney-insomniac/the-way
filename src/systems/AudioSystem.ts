/**
 * Procedural ambient music via Web Audio API.
 * Silence is sacred — the most holy moments use silence(), not music.
 * No audio files required: everything is synthesised at runtime.
 */

export type MusicTrack = 'title' | 'capernaum' | 'sea' | 'jerusalem' | 'gethsemane' | 'emmaus';

interface TrackConfig {
  bpm: number;
  scale: number[];   // frequencies (Hz) of the scale
  bassNote: number;  // Hz
  waveform: OscillatorType;
  reverbWet: number; // 0–1
  volume: number;
}

const TRACKS: Record<MusicTrack, TrackConfig> = {
  title: {
    bpm: 52, scale: [196, 220, 246, 262, 294, 330, 370, 392],
    bassNote: 98, waveform: 'sine', reverbWet: 0.6, volume: 0.22,
  },
  capernaum: {
    bpm: 88, scale: [220, 247, 277, 294, 330, 370, 392, 440],
    bassNote: 110, waveform: 'triangle', reverbWet: 0.3, volume: 0.28,
  },
  sea: {
    bpm: 60, scale: [196, 220, 262, 294, 330, 392, 440, 494],
    bassNote: 98, waveform: 'sine', reverbWet: 0.7, volume: 0.24,
  },
  jerusalem: {
    bpm: 72, scale: [220, 233, 262, 294, 311, 370, 392, 440],
    bassNote: 110, waveform: 'sawtooth', reverbWet: 0.4, volume: 0.20,
  },
  gethsemane: {
    bpm: 40, scale: [185, 196, 220, 233, 262, 294, 311, 330],
    bassNote: 82, waveform: 'sine', reverbWet: 0.85, volume: 0.15,
  },
  emmaus: {
    bpm: 66, scale: [196, 220, 247, 262, 294, 330, 349, 392],
    bassNote: 98, waveform: 'triangle', reverbWet: 0.5, volume: 0.30,
  },
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTrack: MusicTrack | null = null;
  private stopCallbacks: Array<() => void> = [];
  private muted = false;
  private scheduledTime = 0;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private stepIndex = 0;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 1;
    }
    return this.ctx;
  }

  play(key: MusicTrack, fadeMs = 1500) {
    if (this.muted || this.currentTrack === key) return;
    this.stop(fadeMs * 0.5);
    this.currentTrack = key;
    const cfg = TRACKS[key];
    this._startTrack(cfg, fadeMs);
  }

  private _startTrack(cfg: TrackConfig, fadeMs: number) {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0, ctx.currentTime);
    trackGain.gain.linearRampToValueAtTime(cfg.volume, ctx.currentTime + fadeMs / 1000);
    trackGain.connect(this.masterGain!);

    // Convolution reverb (simple impulse)
    const reverb = this._makeReverb(ctx, 1.8, cfg.reverbWet);
    trackGain.connect(reverb);
    reverb.connect(this.masterGain!);

    // Drone bass
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = cfg.bassNote;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.5;
    bass.connect(bassGain);
    bassGain.connect(trackGain);
    bass.start();

    // Pad chord (slow-attack)
    const padNotes = [cfg.scale[0], cfg.scale[2], cfg.scale[4]];
    const padOscs = padNotes.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = cfg.waveform;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.08;
      osc.connect(g);
      g.connect(trackGain);
      osc.start();
      return osc;
    });

    // Arpeggio melody
    const beatSec = 60 / cfg.bpm;
    let stepIdx = 0;
    const arpPattern = [0, 2, 4, 5, 4, 2, 3, 1, 0, 3, 5, 7];
    this.scheduledTime = ctx.currentTime + 0.1;

    const scheduleStep = () => {
      while (this.scheduledTime < ctx.currentTime + 0.3) {
        const noteIdx = arpPattern[stepIdx % arpPattern.length];
        const freq = cfg.scale[noteIdx % cfg.scale.length];
        this._playNote(ctx, trackGain, freq, this.scheduledTime, beatSec * 0.8, cfg.waveform);
        this.scheduledTime += beatSec;
        stepIdx++;
      }
    };

    this.stepTimer = setInterval(scheduleStep, 100);
    scheduleStep();

    const cleanup = () => {
      clearInterval(this.stepTimer!);
      bass.stop();
      padOscs.forEach(o => o.stop());
    };
    this.stopCallbacks.push(cleanup);
  }

  private _playNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
  ) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.12, start + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private _makeReverb(ctx: AudioContext, duration: number, wet: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const len = rate * duration;
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const channel = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }
    convolver.buffer = impulse;
    const wetGain = ctx.createGain();
    wetGain.gain.value = wet;
    convolver.connect(wetGain);
    // Return convolver input, chain: input → convolver → wetGain → (caller connects wetGain)
    return convolver;
  }

  /** Sacred silence — fade out all music */
  silence(fadeMs = 2000) {
    if (!this.masterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    setTimeout(() => {
      this._clearCallbacks();
      if (this.masterGain) this.masterGain.gain.value = 1;
    }, fadeMs + 50);
    this.currentTrack = null;
  }

  stop(fadeMs = 800) {
    this.silence(fadeMs);
  }

  private _clearCallbacks() {
    this.stopCallbacks.forEach(fn => { try { fn(); } catch { /* ignore */ } });
    this.stopCallbacks = [];
    if (this.stepTimer) { clearInterval(this.stepTimer); this.stepTimer = null; }
    this.currentTrack = null;
    this.stepIndex = 0;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.silence(300);
  }
}

// Singleton so music persists across scene transitions
export const globalAudio = new AudioSystem();
