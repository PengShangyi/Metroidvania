import type { BiomeId } from '../world/types';
import { AMBIENCE_PRESETS, TONE_PRESETS, type AudioCue } from './soundDesign';

interface AmbientVoice {
  gain: GainNode;
  oscillators: OscillatorNode[];
}

export class ProceduralAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: AmbientVoice;
  private desiredBiome?: BiomeId;
  private currentBiome?: BiomeId;
  private volume = 0.65;
  private paused = false;
  private armed = false;
  private disabled = false;
  private unlocking?: Promise<void>;
  private readonly unlockHandler = (): void => {
    void this.unlock();
  };

  public arm(): void {
    if (this.armed || this.disabled) return;
    this.armed = true;
    window.addEventListener('pointerdown', this.unlockHandler, { capture: true });
    window.addEventListener('keydown', this.unlockHandler, { capture: true });
  }

  public setBiome(biome: BiomeId): void {
    this.desiredBiome = biome;
    if (this.context && this.context.state === 'running') this.startAmbience(biome);
  }

  public stopAmbience(): void {
    this.desiredBiome = undefined;
    this.currentBiome = undefined;
    this.fadeOutAmbience();
  }

  public play(cue: AudioCue): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || context.state !== 'running' || this.disabled) return;
    try {
      const preset = TONE_PRESETS[cue];
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = preset.wave;
      oscillator.frequency.setValueAtTime(preset.startFrequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(preset.endFrequency, now + preset.duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + preset.duration + 0.02);
    } catch {
      // Audio is optional; a refused or exhausted browser audio graph remains silent.
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyMasterGain();
  }

  public destroy(): void {
    this.disarm();
    this.fadeOutAmbience(true);
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = undefined;
    this.master = undefined;
  }

  private unlock(): Promise<void> {
    if (this.unlocking) return this.unlocking;
    this.unlocking = this.tryUnlock();
    return this.unlocking;
  }

  private async tryUnlock(): Promise<void> {
    if (this.disabled) return;
    try {
      this.context ??= new AudioContext();
      this.master ??= this.context.createGain();
      this.master.connect(this.context.destination);
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.context.state !== 'running') throw new Error('audio context refused');
      this.applyMasterGain();
      this.disarm();
      if (this.desiredBiome) this.startAmbience(this.desiredBiome);
    } catch {
      this.disabled = true;
      this.disarm();
    }
  }

  private startAmbience(biome: BiomeId): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.currentBiome === biome) return;
    this.fadeOutAmbience();
    try {
      const preset = AMBIENCE_PRESETS[biome];
      const now = context.currentTime;
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      const low = context.createOscillator();
      const harmonic = context.createOscillator();
      const pulse = context.createOscillator();
      const pulseDepth = context.createGain();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset.filterFrequency, now);
      low.type = 'sine';
      low.frequency.setValueAtTime(preset.fundamental, now);
      harmonic.type = biome === 'bioforge' ? 'triangle' : 'sine';
      harmonic.frequency.setValueAtTime(preset.harmonic, now);
      pulse.type = 'sine';
      pulse.frequency.setValueAtTime(preset.pulseRate, now);
      pulseDepth.gain.setValueAtTime(0.009, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.55);

      low.connect(filter);
      harmonic.connect(filter);
      filter.connect(gain).connect(master);
      pulse.connect(pulseDepth).connect(gain.gain);
      low.start(now);
      harmonic.start(now);
      pulse.start(now);
      this.ambience = { gain, oscillators: [low, harmonic, pulse] };
      this.currentBiome = biome;
    } catch {
      this.ambience = undefined;
      this.currentBiome = undefined;
    }
  }

  private fadeOutAmbience(immediate = false): void {
    if (!this.ambience || !this.context) return;
    const voice = this.ambience;
    const now = this.context.currentTime;
    const end = now + (immediate ? 0.01 : 0.35);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const oscillator of voice.oscillators) oscillator.stop(end + 0.02);
    this.ambience = undefined;
  }

  private applyMasterGain(): void {
    if (!this.master || !this.context) return;
    const target = this.volume * (this.paused ? 0.16 : 0.42);
    this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.04);
  }

  private disarm(): void {
    if (!this.armed) return;
    window.removeEventListener('pointerdown', this.unlockHandler, { capture: true });
    window.removeEventListener('keydown', this.unlockHandler, { capture: true });
    this.armed = false;
  }
}
