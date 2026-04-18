import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager, GameSave } from '@/progression/SaveManager';

describe('SaveManager', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns default save when nothing is stored', () => {
    const save = SaveManager.load();
    expect(save.highScore).toBe(0);
    expect(save.unlockedZones).toEqual(['skate_park']);
    expect(save.unlockedBoards).toEqual(['default']);
    expect(save.unlockedOutfits).toEqual(['default']);
    expect(save.completedChallenges).toEqual([]);
  });

  it('saves and loads data', () => {
    const save: GameSave = {
      highScore: 5000,
      unlockedZones: ['skate_park', 'street'],
      unlockedBoards: ['default', 'graffiti'],
      unlockedOutfits: ['default', 'hoodie'],
      completedChallenges: ['park_grind_rail'],
      equippedBoard: 'graffiti',
      equippedOutfit: 'hoodie',
    };
    SaveManager.save(save);
    const loaded = SaveManager.load();
    expect(loaded.highScore).toBe(5000);
    expect(loaded.unlockedZones).toContain('street');
    expect(loaded.equippedBoard).toBe('graffiti');
  });

  it('exports save as JSON string', () => {
    SaveManager.save({ ...SaveManager.load(), highScore: 999 });
    const json = SaveManager.exportSave();
    const parsed = JSON.parse(json);
    expect(parsed.highScore).toBe(999);
  });

  it('imports save from JSON string', () => {
    const json = JSON.stringify({
      highScore: 1234,
      unlockedZones: ['skate_park', 'street', 'old_amman'],
      unlockedBoards: ['default'],
      unlockedOutfits: ['default'],
      completedChallenges: ['park_ollie'],
      equippedBoard: 'default',
      equippedOutfit: 'default',
    });
    SaveManager.importSave(json);
    const loaded = SaveManager.load();
    expect(loaded.highScore).toBe(1234);
    expect(loaded.unlockedZones).toContain('old_amman');
  });
});
