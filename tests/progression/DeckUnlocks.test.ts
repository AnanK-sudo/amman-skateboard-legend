import { describe, it, expect } from 'vitest';
import { newlyUnlocked } from '@/progression/DeckUnlocks';

const all = ['park_a', 'park_b', 'park_c', 'park_d', 'street_a', 'street_b', 'street_c', 'amman_a', 'amman_b', 'amman_c', 'amman_d', 'amman_e', 'amman_f'];
const base = { completed: [] as string[], allChallenges: all, bestCombo: 0, owned: ['default'] };

describe('newlyUnlocked', () => {
  it('starts with only the starter deck', () => {
    expect(newlyUnlocked(base)).toEqual([]);
  });

  it('unlocks Citadel at 3 park challenges and Rainbow Street at 3 street challenges', () => {
    expect(newlyUnlocked({ ...base, completed: ['park_a', 'park_b'] })).toEqual([]);
    expect(newlyUnlocked({ ...base, completed: ['park_a', 'park_b', 'park_c'] })).toEqual(['citadel']);
    expect(newlyUnlocked({ ...base, completed: ['street_a', 'street_b', 'street_c'] })).toContain('rainbow');
  });

  it('unlocks Jasmine with a 1500-point combo and Desert Sun with 5 Old Amman challenges', () => {
    expect(newlyUnlocked({ ...base, bestCombo: 1499 })).toEqual([]);
    expect(newlyUnlocked({ ...base, bestCombo: 1500 })).toEqual(['jasmine']);
    expect(newlyUnlocked({ ...base, completed: ['amman_a', 'amman_b', 'amman_c', 'amman_d', 'amman_e'] })).toEqual(['desert']);
  });

  it('unlocks Graffiti once every challenge in one zone is done', () => {
    // Street has exactly 3 challenges, so finishing them completes the zone
    expect(newlyUnlocked({ ...base, completed: ['street_a', 'street_b', 'street_c'] })).toEqual(['rainbow', 'graffiti']);
  });

  it('never reports a deck that is already owned', () => {
    expect(newlyUnlocked({ ...base, bestCombo: 2000, owned: ['default', 'jasmine'] })).toEqual([]);
  });
});
