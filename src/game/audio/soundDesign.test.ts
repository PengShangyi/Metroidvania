import { describe, expect, it } from 'vitest';

import { AMBIENCE_PRESETS, TONE_PRESETS } from './soundDesign';

describe('procedural sound design', () => {
  it('defines a distinct positive ambience for all three regions', () => {
    expect(Object.keys(AMBIENCE_PRESETS)).toEqual(['vestibule', 'bioforge', 'reactor']);
    expect(new Set(Object.values(AMBIENCE_PRESETS).map((preset) => preset.fundamental)).size).toBe(
      3,
    );
    for (const preset of Object.values(AMBIENCE_PRESETS)) {
      expect(preset.fundamental).toBeGreaterThan(0);
      expect(preset.filterFrequency).toBeGreaterThan(preset.harmonic);
    }
  });

  it('keeps every effect short and safely below unity gain', () => {
    for (const preset of Object.values(TONE_PRESETS)) {
      expect(preset.duration).toBeGreaterThan(0);
      expect(preset.duration).toBeLessThanOrEqual(0.8);
      expect(preset.gain).toBeGreaterThan(0);
      expect(preset.gain).toBeLessThan(1);
    }
  });
});
