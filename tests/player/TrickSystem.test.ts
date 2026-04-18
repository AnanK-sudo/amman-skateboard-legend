import { describe, it, expect, beforeEach } from 'vitest';
import { TrickSystem, TrickName } from '@/player/TrickSystem';

describe('TrickSystem', () => {
  let tricks: TrickSystem;

  beforeEach(() => {
    tricks = new TrickSystem();
  });

  it('starts with no active combo', () => {
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
    expect(tricks.comboMultiplier).toBe(0);
  });

  it('landing a trick starts a combo', () => {
    tricks.landTrick('kickflip');
    expect(tricks.comboActive).toBe(true);
    expect(tricks.comboMultiplier).toBe(1);
    expect(tricks.comboScore).toBe(200);
  });

  it('chaining tricks increases multiplier', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('fifty_fifty');
    expect(tricks.comboMultiplier).toBe(2);
    expect(tricks.comboScore).toBe(1400);
  });

  it('rejects duplicate tricks in same combo', () => {
    tricks.landTrick('kickflip');
    const result = tricks.landTrick('kickflip');
    expect(result).toBe(false);
    expect(tricks.comboMultiplier).toBe(1);
  });

  it('bail resets combo and returns 0', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('fifty_fifty');
    const score = tricks.bail();
    expect(score).toBe(0);
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
  });

  it('cash out returns final score and resets', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('fifty_fifty');
    const score = tricks.cashOut();
    expect(score).toBe(1400);
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
  });

  it('combo chain list tracks trick names', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('nosegrind');
    expect(tricks.comboChain).toEqual(['kickflip', 'nosegrind']);
  });

  it('all defined tricks have base scores', () => {
    const allTricks: TrickName[] = [
      'ollie', 'kickflip', 'heelflip', 'tre_flip',
      'fifty_fifty', 'nosegrind', 'tailslide', 'boardslide',
      'grab', 'spin_180', 'spin_360', 'spin_540', 'manual',
    ];
    for (const name of allTricks) {
      expect(tricks.getBaseScore(name)).toBeGreaterThan(0);
    }
  });
});
