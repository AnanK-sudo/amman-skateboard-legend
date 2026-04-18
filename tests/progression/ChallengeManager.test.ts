import { describe, it, expect, beforeEach } from 'vitest';
import { ChallengeManager, Challenge } from '@/progression/ChallengeManager';

describe('ChallengeManager', () => {
  let mgr: ChallengeManager;

  const challenges: Challenge[] = [
    { id: 'park_grind_rail', zone: 'skate_park', name: 'Grind the full rail', type: 'grind_distance', target: 6, description: 'Grind the center rail end to end' },
    { id: 'park_ollie_3', zone: 'skate_park', name: 'Ollie 3 times', type: 'trick_count', target: 3, description: 'Land 3 ollies', trickName: 'ollie' },
    { id: 'park_combo_2k', zone: 'skate_park', name: '2K Combo', type: 'combo_score', target: 2000, description: 'Land a 2000+ point combo' },
  ];

  beforeEach(() => { mgr = new ChallengeManager(challenges); });

  it('lists challenges for a zone', () => {
    expect(mgr.getForZone('skate_park').length).toBe(3);
  });

  it('tracks progress on trick_count challenge', () => {
    mgr.onTrickLanded('ollie');
    expect(mgr.getProgress('park_ollie_3')).toBe(1);
    mgr.onTrickLanded('ollie');
    mgr.onTrickLanded('ollie');
    expect(mgr.isCompleted('park_ollie_3')).toBe(true);
  });

  it('tracks progress on combo_score challenge', () => {
    mgr.onComboCashed(1500);
    expect(mgr.isCompleted('park_combo_2k')).toBe(false);
    mgr.onComboCashed(2500);
    expect(mgr.isCompleted('park_combo_2k')).toBe(true);
  });

  it('returns completed challenge IDs', () => {
    mgr.onTrickLanded('ollie');
    mgr.onTrickLanded('ollie');
    mgr.onTrickLanded('ollie');
    expect(mgr.completedIds).toContain('park_ollie_3');
  });

  it('can load completed state from save', () => {
    mgr.loadCompleted(['park_grind_rail']);
    expect(mgr.isCompleted('park_grind_rail')).toBe(true);
  });
});
