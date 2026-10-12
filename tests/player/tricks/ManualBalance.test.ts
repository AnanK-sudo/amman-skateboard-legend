import { describe, it, expect } from 'vitest';
import { ManualBalance } from '@/player/tricks/ManualBalance';

const still = () => 0.5; // no noise

describe('ManualBalance', () => {
  it('drifts away from centre on its own and fails without input', () => {
    const b = new ManualBalance(still);
    b.nudge(0.05);
    let failed = false;
    for (let i = 0; i < 600 && !failed; i++) failed = b.update(1 / 60, 0);
    expect(failed).toBe(true);
  });

  it('can be held by leaning against the drift', () => {
    const b = new ManualBalance(still);
    b.nudge(0.05);
    for (let i = 0; i < 300; i++) {
      expect(b.update(1 / 60, b.value > 0 ? -1 : 1)).toBe(false);
    }
  });

  it('gets less stable the longer it is held', () => {
    const drift = (warm: number) => {
      const b = new ManualBalance(still);
      for (let i = 0; i < warm * 60; i++) b.update(1 / 60, b.value > 0 ? -1 : 1);
      b.reset(0.1);
      b.update(0.1, 0);
      return Math.abs(b.value) - 0.1;
    };
    expect(drift(4)).toBeGreaterThan(drift(0));
  });
});
