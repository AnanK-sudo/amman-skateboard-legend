import { TRICKS, GRAB_TICK_POINTS, SPIN_MULTIPLIER, spinTrick } from './tricks/catalog';

export interface LandedTrick {
  /** Catalog ids it counts as, for challenges and stats (a 360 kickflip is kickflip and spin_360) */
  ids: string[];
  name: string;
  points: number;
}

export interface AirSummary {
  airTricks: string[];
  halfTurns: number;
  grabTicks: number;
  ollied: boolean;
}

export class TrickSystem {
  private chain: LandedTrick[] = [];
  private landed: LandedTrick[] = [];

  get comboActive(): boolean { return this.chain.length > 0; }
  get comboMultiplier(): number { return this.chain.length; }
  get comboScore(): number { return this.chain.reduce((s, t) => s + t.points, 0) * this.comboMultiplier; }
  get comboChain(): string[] { return this.chain.map(t => t.name); }

  getBaseScore(id: string): number { return TRICKS[id]?.score ?? 0; }

  /** Adds a trick to the combo; a trick repeated in the same combo scores half each time */
  landTrick(id: string, opts: { name?: string; points?: number; extraIds?: string[] } = {}): LandedTrick {
    const repeats = this.chain.filter(t => t.ids[0] === id).length;
    const base = opts.points ?? this.getBaseScore(id);
    const trick: LandedTrick = {
      ids: [id, ...(opts.extraIds ?? [])],
      name: opts.name ?? TRICKS[id]?.name ?? id,
      points: Math.round(base * Math.pow(0.5, repeats)),
    };
    this.chain.push(trick);
    this.landed.push(trick);
    return trick;
  }

  /** Scores everything from one clean air: spins multiply and prefix the flips and grabs */
  landAir(air: AirSummary, fakie: boolean): LandedTrick[] {
    const spin = spinTrick(air.halfTurns);
    const mult = SPIN_MULTIPLIER[Math.min(Math.abs(air.halfTurns), 3)];
    const prefix = (fakie ? 'Fakie ' : '') + (spin ? `${spin.name} ` : '');
    const lastGrab = [...air.airTricks].reverse().find(id => TRICKS[id]?.family === 'grab');

    if (air.airTricks.length > 0) {
      return air.airTricks.map(id => {
        const ticks = id === lastGrab ? air.grabTicks * GRAB_TICK_POINTS : 0;
        return this.landTrick(id, {
          name: prefix + TRICKS[id].name,
          points: (this.getBaseScore(id) + ticks) * mult,
          extraIds: spin ? [spin.id] : [],
        });
      });
    }
    if (spin) return [this.landTrick(spin.id, { name: (fakie ? 'Fakie ' : '') + spin.name })];
    if (air.ollied) return [this.landTrick('ollie', { name: (fakie ? 'Fakie ' : '') + 'Ollie' })];
    return [];
  }

  consumeLanded(): LandedTrick[] {
    const l = this.landed;
    this.landed = [];
    return l;
  }

  bail(): number { this.reset(); return 0; }

  cashOut(): number {
    const score = this.comboScore;
    this.reset();
    return score;
  }

  private reset(): void {
    this.chain = [];
    this.landed = [];
  }
}
