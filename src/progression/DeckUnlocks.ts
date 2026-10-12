import { DECKS, type DeckUnlock } from '@/world/decks';

export interface DeckProgress {
  completed: string[];
  allChallenges: string[];
  bestCombo: number;
  owned: string[];
}

const ZONE_PREFIXES = ['park_', 'street_', 'amman_'];

function earned(rule: DeckUnlock, p: DeckProgress): boolean {
  switch (rule.kind) {
    case 'owned': return true;
    case 'challenges': return p.completed.filter(id => id.startsWith(rule.prefix)).length >= rule.count;
    case 'combo': return p.bestCombo >= rule.points;
    case 'zoneComplete':
      return ZONE_PREFIXES.some(prefix => {
        const zone = p.allChallenges.filter(id => id.startsWith(prefix));
        return zone.length > 0 && zone.every(id => p.completed.includes(id));
      });
  }
}

/** Decks earned but not yet owned, in catalog order; safe to call after every combo */
export function newlyUnlocked(p: DeckProgress): string[] {
  return DECKS.filter(d => !p.owned.includes(d.id) && earned(d.unlock, p)).map(d => d.id);
}
