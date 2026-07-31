import type { BiomeId } from '../world/types';

export type AudioCue =
  | 'blaster'
  | 'blade'
  | 'enemyHit'
  | 'shieldBlock'
  | 'shieldOpen'
  | 'reflect'
  | 'hurt'
  | 'pickup'
  | 'terminal'
  | 'bossHit'
  | 'bossDefeat';

export interface TonePreset {
  startFrequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
}

export interface AmbiencePreset {
  fundamental: number;
  harmonic: number;
  pulseRate: number;
  filterFrequency: number;
}

export const AUDIO_EVENT = 'star-echo:audio-cue';

export const AMBIENCE_PRESETS: Record<BiomeId, AmbiencePreset> = {
  vestibule: { fundamental: 44, harmonic: 66, pulseRate: 0.07, filterFrequency: 310 },
  bioforge: { fundamental: 54, harmonic: 81, pulseRate: 0.12, filterFrequency: 420 },
  reactor: { fundamental: 38, harmonic: 76, pulseRate: 0.18, filterFrequency: 560 },
};

export const TONE_PRESETS: Record<AudioCue, TonePreset> = {
  blaster: {
    startFrequency: 480,
    endFrequency: 920,
    duration: 0.08,
    gain: 0.1,
    wave: 'square',
  },
  blade: {
    startFrequency: 230,
    endFrequency: 78,
    duration: 0.13,
    gain: 0.12,
    wave: 'sawtooth',
  },
  enemyHit: {
    startFrequency: 180,
    endFrequency: 96,
    duration: 0.07,
    gain: 0.07,
    wave: 'square',
  },
  shieldBlock: {
    startFrequency: 920,
    endFrequency: 360,
    duration: 0.06,
    gain: 0.08,
    wave: 'triangle',
  },
  shieldOpen: {
    startFrequency: 130,
    endFrequency: 720,
    duration: 0.16,
    gain: 0.11,
    wave: 'sawtooth',
  },
  reflect: {
    startFrequency: 360,
    endFrequency: 1_120,
    duration: 0.11,
    gain: 0.11,
    wave: 'triangle',
  },
  hurt: {
    startFrequency: 105,
    endFrequency: 52,
    duration: 0.18,
    gain: 0.14,
    wave: 'square',
  },
  pickup: {
    startFrequency: 520,
    endFrequency: 1_040,
    duration: 0.22,
    gain: 0.1,
    wave: 'sine',
  },
  terminal: {
    startFrequency: 330,
    endFrequency: 660,
    duration: 0.3,
    gain: 0.08,
    wave: 'triangle',
  },
  bossHit: {
    startFrequency: 92,
    endFrequency: 46,
    duration: 0.18,
    gain: 0.13,
    wave: 'sawtooth',
  },
  bossDefeat: {
    startFrequency: 150,
    endFrequency: 22,
    duration: 0.8,
    gain: 0.18,
    wave: 'sawtooth',
  },
};
