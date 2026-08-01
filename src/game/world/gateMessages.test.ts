import { describe, expect, it } from 'vitest';

import { exitRequirementMessage, pickupRequirementMessage } from './gateMessages';
import { RoomRepository } from './RoomRepository';
import type { GateRequirement } from './types';

const GATED: GateRequirement[] = ['phaseDash', 'magneticGrip', 'dualAbility', 'bossDefeated'];

describe('gate messages', () => {
  it('stays silent for ungated content', () => {
    expect(exitRequirementMessage('none')).toBe('');
    expect(pickupRequirementMessage('none')).toBe('');
  });

  it('explains every gated exit', () => {
    for (const requirement of GATED) {
      expect(exitRequirementMessage(requirement).length).toBeGreaterThan(0);
    }
  });

  it('explains every gated pickup instead of silently skipping it', () => {
    // 回归：health-depot 需要磁附跃迁，旧实现走到跟前什么提示都没有。
    for (const requirement of GATED) {
      expect(pickupRequirementMessage(requirement).length).toBeGreaterThan(0);
    }
  });

  it('covers every requirement actually used by the world', () => {
    const requirements = new Set<GateRequirement>();
    for (const room of new RoomRepository().all()) {
      for (const exit of room.exits) requirements.add(exit.requirement);
      for (const pickup of room.pickups) requirements.add(pickup.requirement);
    }

    for (const requirement of requirements) {
      if (requirement === 'none') continue;
      expect(exitRequirementMessage(requirement).length).toBeGreaterThan(0);
      expect(pickupRequirementMessage(requirement).length).toBeGreaterThan(0);
    }
  });
});
