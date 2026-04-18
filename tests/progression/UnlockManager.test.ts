import { describe, it, expect } from 'vitest';
import { UnlockManager } from '@/progression/UnlockManager';

describe('UnlockManager', () => {
  it('skate_park is always unlocked', () => {
    const mgr = new UnlockManager([]);
    expect(mgr.isZoneUnlocked('skate_park')).toBe(true);
  });

  it('street unlocks after 3 park challenges', () => {
    const mgr = new UnlockManager([]);
    expect(mgr.isZoneUnlocked('street')).toBe(false);
    mgr.updateCompleted(['park_1', 'park_2', 'park_3']);
    expect(mgr.isZoneUnlocked('street')).toBe(true);
  });

  it('old_amman unlocks after 5 street challenges', () => {
    const mgr = new UnlockManager(['park_1', 'park_2', 'park_3']);
    expect(mgr.isZoneUnlocked('old_amman')).toBe(false);
    mgr.updateCompleted([
      'park_1', 'park_2', 'park_3',
      'street_1', 'street_2', 'street_3', 'street_4', 'street_5',
    ]);
    expect(mgr.isZoneUnlocked('old_amman')).toBe(true);
  });

  it('returns list of unlocked zones', () => {
    const mgr = new UnlockManager(['park_1', 'park_2', 'park_3']);
    expect(mgr.unlockedZones).toContain('skate_park');
    expect(mgr.unlockedZones).toContain('street');
    expect(mgr.unlockedZones).not.toContain('old_amman');
  });
});
