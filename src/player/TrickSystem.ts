export type TrickName =
  | 'ollie' | 'kickflip' | 'heelflip' | 'tre_flip'
  | 'fifty_fifty' | 'nosegrind' | 'tailslide' | 'boardslide'
  | 'grab' | 'spin_180' | 'spin_360' | 'spin_540'
  | 'manual';

const TRICK_SCORES: Record<TrickName, number> = {
  ollie: 50, kickflip: 200, heelflip: 200, tre_flip: 400,
  fifty_fifty: 500, nosegrind: 600, tailslide: 550, boardslide: 500,
  grab: 300, spin_180: 250, spin_360: 400, spin_540: 600, manual: 100,
};

export class TrickSystem {
  private chain: TrickName[] = [];
  private baseTotal = 0;
  private _lastTrickName: TrickName | null = null;

  get comboActive(): boolean { return this.chain.length > 0; }
  get comboMultiplier(): number { return this.chain.length; }
  get comboScore(): number { return this.baseTotal * this.comboMultiplier; }
  get comboChain(): TrickName[] { return [...this.chain]; }
  get lastTrick(): TrickName | null { return this._lastTrickName; }

  getBaseScore(name: TrickName): number { return TRICK_SCORES[name]; }

  landTrick(name: TrickName): boolean {
    // Only prevent consecutive repeats, not all repeats
    if (this.chain.length > 0 && this.chain[this.chain.length - 1] === name) return false;
    this.chain.push(name);
    this.baseTotal += TRICK_SCORES[name];
    this._lastTrickName = name;
    return true;
  }

  bail(): number { this.reset(); return 0; }

  cashOut(): number {
    const score = this.comboScore;
    this.reset();
    return score;
  }

  private reset(): void {
    this.chain = [];
    this.baseTotal = 0;
    this._lastTrickName = null;
  }
}
