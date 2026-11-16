// Web Audio API Sound & Ambient Track Synthesizer for Vidu AI
// Bypasses external media asset issues and handles browser autoplay restrictions cleanly.

class TerminalSoundEngine {
  private ctx: AudioContext | null = null;
  private isAmbientPlaying = false;
  private sfxEnabled = true;
  private ambientInterval: number | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  public getSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public getAmbientState(): boolean {
    return this.isAmbientPlaying;
  }

  public toggleAmbientTrack(): boolean {
    if (this.isAmbientPlaying) {
      this.stopAmbientTrack();
      return false;
    } else {
      this.startAmbientTrack();
      return true;
    }
  }

  public startAmbientTrack(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isAmbientPlaying) return;

    this.isAmbientPlaying = true;

    // Deep sub-bass terminal drone (D2 + A2 fifth interval)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 1.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, ctx.currentTime);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(73.42, ctx.currentTime); // D2
    osc2.frequency.setValueAtTime(110.0, ctx.currentTime); // A2

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.droneOsc1 = osc1;
    this.droneOsc2 = osc2;
    this.droneGain = masterGain;

    // Sequenced cyberpunk terminal arpeggio pulse
    const notes = [146.83, 174.61, 220.0, 261.63, 220.0, 174.61, 293.66, 220.0]; // D minor pentatonic
    let step = 0;

    this.ambientInterval = window.setInterval(() => {
      if (!this.isAmbientPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      const arpFilter = this.ctx.createBiquadFilter();

      arpOsc.type = 'sine';
      arpOsc.frequency.setValueAtTime(notes[step % notes.length], now);

      arpFilter.type = 'bandpass';
      arpFilter.frequency.setValueAtTime(600, now);

      arpGain.gain.setValueAtTime(0.001, now);
      arpGain.gain.exponentialRampToValueAtTime(0.035, now + 0.04);
      arpGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);

      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      arpGain.connect(this.ctx.destination);

      arpOsc.start(now);
      arpOsc.stop(now + 0.35);
      step++;
    }, 380);
  }

  public stopAmbientTrack(): void {
    this.isAmbientPlaying = false;
    if (this.ambientInterval !== null) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.ctx && this.droneGain) {
      try {
        const now = this.ctx.currentTime;
        this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      } catch {
        // Ignore cleanup errors
      }
    }
    setTimeout(() => {
      try {
        this.droneOsc1?.stop();
        this.droneOsc2?.stop();
        this.droneOsc1?.disconnect();
        this.droneOsc2?.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.droneOsc1 = null;
      this.droneOsc2 = null;
      this.droneGain = null;
    }, 320);
  }

  // Mechanical terminal key / button click
  public playClick(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.045);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Ascending data dispatch chirp on message send
  public playSend(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.16);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  // Harmonic dual-tone confirmation when AI response arrives
  public playReceive(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [587.33, 880]; // D5 -> A5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.075;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.19);
    });
  }
}

export const soundEngine = new TerminalSoundEngine();
