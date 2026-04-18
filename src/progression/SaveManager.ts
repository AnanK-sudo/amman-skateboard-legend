const SAVE_KEY = 'anan_skate_save';

export interface GameSave {
  highScore: number;
  unlockedZones: string[];
  unlockedBoards: string[];
  unlockedOutfits: string[];
  completedChallenges: string[];
  equippedBoard: string;
  equippedOutfit: string;
}

const DEFAULT_SAVE: GameSave = {
  highScore: 0,
  unlockedZones: ['skate_park'],
  unlockedBoards: ['default'],
  unlockedOutfits: ['default'],
  completedChallenges: [],
  equippedBoard: 'default',
  equippedOutfit: 'default',
};

export class SaveManager {
  static load(): GameSave {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    try { return { ...DEFAULT_SAVE, ...JSON.parse(raw) }; }
    catch { return { ...DEFAULT_SAVE }; }
  }

  static save(data: GameSave): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static exportSave(): string {
    return localStorage.getItem(SAVE_KEY) ?? JSON.stringify(DEFAULT_SAVE);
  }

  static importSave(json: string): void {
    const parsed = JSON.parse(json);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, ...parsed }));
  }

  static reset(): void { localStorage.removeItem(SAVE_KEY); }
}
