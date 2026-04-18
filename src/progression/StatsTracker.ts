// Tracks session stats and personal bests per zone

export interface ZoneBest {
  highScore: number;
  bestCombo: number;
  bestTrickCount: number;
}

export interface SessionStats {
  totalTricks: number;
  bestCombo: number;
  totalScore: number;
  timePlayedMs: number;
  bails: number;
  tricksLanded: Record<string, number>; // trick name → count
}

export class StatsTracker {
  private session: SessionStats = {
    totalTricks: 0,
    bestCombo: 0,
    totalScore: 0,
    timePlayedMs: 0,
    bails: 0,
    tricksLanded: {},
  };

  private zoneBests: Record<string, ZoneBest> = {};
  private startTime = Date.now();
  private static BESTS_KEY = 'anan_skate_zone_bests';

  constructor() {
    this.loadBests();
  }

  // --- Session tracking ---

  onTrickLanded(trickName: string): void {
    this.session.totalTricks++;
    this.session.tricksLanded[trickName] = (this.session.tricksLanded[trickName] || 0) + 1;
  }

  onComboCashed(score: number, trickCount: number): void {
    this.session.totalScore += score;
    if (score > this.session.bestCombo) {
      this.session.bestCombo = score;
    }
  }

  onBail(): void {
    this.session.bails++;
  }

  getSession(): SessionStats {
    return {
      ...this.session,
      timePlayedMs: Date.now() - this.startTime,
    };
  }

  // --- Zone personal bests ---

  checkZoneBest(zoneId: string, score: number, comboScore: number, trickCount: number): boolean {
    if (!this.zoneBests[zoneId]) {
      this.zoneBests[zoneId] = { highScore: 0, bestCombo: 0, bestTrickCount: 0 };
    }

    const best = this.zoneBests[zoneId];
    let isNewBest = false;

    if (score > best.highScore) {
      best.highScore = score;
      isNewBest = true;
    }
    if (comboScore > best.bestCombo) {
      best.bestCombo = comboScore;
      isNewBest = true;
    }
    if (trickCount > best.bestTrickCount) {
      best.bestTrickCount = trickCount;
      isNewBest = true;
    }

    if (isNewBest) this.saveBests();
    return isNewBest;
  }

  getZoneBest(zoneId: string): ZoneBest {
    return this.zoneBests[zoneId] || { highScore: 0, bestCombo: 0, bestTrickCount: 0 };
  }

  private loadBests(): void {
    try {
      const raw = localStorage.getItem(StatsTracker.BESTS_KEY);
      if (raw) this.zoneBests = JSON.parse(raw);
    } catch { /* ignore corrupt data */ }
  }

  private saveBests(): void {
    localStorage.setItem(StatsTracker.BESTS_KEY, JSON.stringify(this.zoneBests));
  }

  // Format time for display
  static formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
