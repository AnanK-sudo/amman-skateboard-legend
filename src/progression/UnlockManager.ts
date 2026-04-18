interface ZoneUnlockRule {
  zoneId: string;
  requiredChallengePrefix: string;
  requiredCount: number;
}

const ZONE_UNLOCK_RULES: ZoneUnlockRule[] = [
  { zoneId: 'street', requiredChallengePrefix: 'park_', requiredCount: 3 },
  { zoneId: 'old_amman', requiredChallengePrefix: 'street_', requiredCount: 5 },
];

export class UnlockManager {
  private completedChallenges: string[];

  constructor(completedChallenges: string[]) {
    this.completedChallenges = [...completedChallenges];
  }

  updateCompleted(challenges: string[]): void { this.completedChallenges = [...challenges]; }

  isZoneUnlocked(zoneId: string): boolean {
    if (zoneId === 'skate_park') return true;
    const rule = ZONE_UNLOCK_RULES.find(r => r.zoneId === zoneId);
    if (!rule) return false;
    const count = this.completedChallenges.filter(id => id.startsWith(rule.requiredChallengePrefix)).length;
    return count >= rule.requiredCount;
  }

  get unlockedZones(): string[] {
    const zones = ['skate_park'];
    for (const rule of ZONE_UNLOCK_RULES) {
      if (this.isZoneUnlocked(rule.zoneId)) zones.push(rule.zoneId);
    }
    return zones;
  }
}
