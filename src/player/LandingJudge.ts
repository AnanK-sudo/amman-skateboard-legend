export type BailReason = 'unfinished' | 'grab' | 'crooked' | 'drop' | 'wall' | 'manual';

export interface LandingSnapshot {
  /** Progress of the flip in the air, or null when none was thrown */
  flipProgress: number | null;
  grabHeld: boolean;
  /** Degrees between the body and the nearest half turn */
  spinResidualDeg: number;
  /** Metres from the highest point of the air to the ground landed on */
  dropHeight: number;
  /** Space held at touchdown */
  crouched: boolean;
}

const FLIP_DONE = 0.85;
const CROOKED_DEG = 30;
const DROP_SAFE = 2.5;
const DROP_CROUCHED = 6;
const WALL_SPEED = 9;
const WALL_KEPT = 0.3;

export function judgeLanding(s: LandingSnapshot): { clean: true } | { clean: false; reason: BailReason } {
  if (s.flipProgress !== null && s.flipProgress < FLIP_DONE) return { clean: false, reason: 'unfinished' };
  if (s.grabHeld) return { clean: false, reason: 'grab' };
  if (Math.abs(s.spinResidualDeg) > CROOKED_DEG) return { clean: false, reason: 'crooked' };
  if (s.dropHeight > (s.crouched ? DROP_CROUCHED : DROP_SAFE)) return { clean: false, reason: 'drop' };
  return { clean: true };
}

export function judgeWallHit(speedBefore: number, speedAfter: number): BailReason | null {
  return speedBefore > WALL_SPEED && speedAfter < speedBefore * WALL_KEPT ? 'wall' : null;
}
