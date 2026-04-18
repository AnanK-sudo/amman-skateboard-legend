export interface Challenge {
  id: string;
  zone: string;
  name: string;
  description: string;
  type: 'trick_count' | 'combo_score' | 'grind_distance' | 'speed' | 'zone_time';
  target: number;
  trickName?: string;
}

export class ChallengeManager {
  private challenges: Challenge[];
  private progress = new Map<string, number>();
  private completed = new Set<string>();

  constructor(challenges: Challenge[]) {
    this.challenges = challenges;
    for (const c of challenges) this.progress.set(c.id, 0);
  }

  getForZone(zone: string): Challenge[] { return this.challenges.filter(c => c.zone === zone); }
  getProgress(id: string): number { return this.progress.get(id) ?? 0; }
  isCompleted(id: string): boolean { return this.completed.has(id); }
  get completedIds(): string[] { return [...this.completed]; }

  loadCompleted(ids: string[]): void {
    for (const id of ids) {
      this.completed.add(id);
      const challenge = this.challenges.find(c => c.id === id);
      if (challenge) this.progress.set(id, challenge.target);
    }
  }

  onTrickLanded(trickName: string): void {
    for (const c of this.challenges) {
      if (this.completed.has(c.id)) continue;
      if (c.type === 'trick_count' && c.trickName === trickName) {
        const current = (this.progress.get(c.id) ?? 0) + 1;
        this.progress.set(c.id, current);
        if (current >= c.target) this.completed.add(c.id);
      }
    }
  }

  onComboCashed(score: number): void {
    for (const c of this.challenges) {
      if (this.completed.has(c.id)) continue;
      if (c.type === 'combo_score') {
        const current = Math.max(this.progress.get(c.id) ?? 0, score);
        this.progress.set(c.id, current);
        if (current >= c.target) this.completed.add(c.id);
      }
    }
  }

  onGrindDistance(distance: number): void {
    for (const c of this.challenges) {
      if (this.completed.has(c.id)) continue;
      if (c.type === 'grind_distance') {
        const current = Math.max(this.progress.get(c.id) ?? 0, distance);
        this.progress.set(c.id, current);
        if (current >= c.target) this.completed.add(c.id);
      }
    }
  }
}
