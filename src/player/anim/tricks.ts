import { TRICKS, type TrickDef } from '../tricks/catalog';
import type { JointPose, Joint, Vec3 } from './mirror';

/** Board motion for regular stance; the model flips signs for goofy */
export interface BoardPose {
  /** Turns around the board's long axis */
  flip: number;
  /** Turns around the vertical axis (shove-it) */
  shove: number;
  /** Turns end over end around the back foot (impossible) */
  wrap: number;
  /** Radians, nose up */
  pitch: number;
  /** Metres above its riding height */
  lift: number;
  /** Radians, toe edge down */
  roll: number;
}

export interface TrickKey {
  t: number;
  /** Added on top of the base pose */
  joints?: JointPose;
  frontLift?: number;
  backLift?: number;
  hipDrop?: number;
}

export interface TrickAnimDef {
  keys: TrickKey[];
  board: (t: number) => Partial<BoardPose>;
  cameraMoment: boolean;
}

export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);
const arc = (t: number): number => Math.sin(Math.PI * clamp01(t));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

// Flip phases over the trick's progress
const POP_END = 0.18;
const CATCH = 0.8;

/** Board rotation share: nothing during the pop, fast out of it, easing into the catch, locked after */
function rotation(t: number): number {
  return easeOutCubic((t - POP_END) / (CATCH - POP_END));
}

function flipAnim(def: TrickDef): TrickAnimDef {
  const m = def.flip!;
  const lift = 0.22 + 0.04 * (Math.abs(m.flip) + Math.abs(m.shove) + m.wrap);
  // Shove-its counter-rotate the shoulders against the board
  const shoulders = -m.shove * 18;
  const kickArm: Vec3 = m.flip < 0 ? [0, 10, 18] : [0, -10, 18];
  return {
    cameraMoment: true,
    keys: [
      // Wind-up: crouch, shoulders load
      { t: 0, hipDrop: 0.08, joints: { spine: [6, -shoulders * 0.5, 0] } },
      // Pop: tail snaps, front foot slides up the board, body extends
      { t: 0.12, frontLift: 0.1, hipDrop: -0.04, joints: { spine: [-4, 0, 0], frontArm: [0, 0, 14], backArm: [0, 0, -14] } },
      // Trick: feet clear of the board, head watches it, shoulders counter the shove
      { t: 0.3, frontLift: lift, backLift: lift * 0.85, hipDrop: 0.06, joints: { spine: [12, shoulders, 0], frontArm: kickArm, head: [26, -10, 0], neck: [10, 0, 0] } },
      { t: 0.7, frontLift: lift * 0.9, backLift: lift * 0.8, hipDrop: 0.06, joints: { spine: [10, shoulders * 0.6, 0], head: [22, -8, 0], neck: [8, 0, 0] } },
      // Catch: legs reach down to meet the board
      { t: CATCH, frontLift: 0.02, backLift: 0.02, hipDrop: 0.02, joints: { spine: [8, 0, 0], head: [6, 0, 0] } },
      { t: 1, hipDrop: 0.06 },
    ],
    board: t => ({
      flip: m.flip * rotation(t),
      shove: m.shove * rotation(t),
      wrap: m.wrap * rotation(t),
      pitch: 0.42 * arc(t / (POP_END * 2)),
      lift: 0.14 * arc((t - 0.08) / 0.8),
    }),
  };
}

const GRAB_REACH: Record<string, JointPose> = {
  'front:heel': { spine: [18, 0, -6], spine1: [8, 0, 0], frontArm: [0, 44, -72], frontForeArm: [0, 8, 0], head: [14, -10, 0] },
  'front:nose': { spine: [22, 8, -14], spine1: [10, 0, 0], frontArm: [0, -8, -82], frontForeArm: [0, -4, 0], head: [18, 6, 0] },
  'back:toe':   { spine: [26, -10, 0], spine1: [10, 0, 0], backArm: [0, 56, 70], backForeArm: [0, 10, 0], head: [16, -16, 0] },
  'back:tail':  { spine: [20, -6, 14], spine1: [8, 0, 0], backArm: [0, 14, 78], backForeArm: [0, 6, 0], head: [14, -20, 0] },
  'back:heel':  { spine: [16, 6, 6], spine1: [8, 0, 0], backArm: [0, -46, 70], backForeArm: [0, -6, 0], head: [14, -14, 0] },
};

function grabAnim(def: TrickDef): TrickAnimDef {
  const reach = GRAB_REACH[`${def.grab!.hand}:${def.grab!.spot}`];
  // Method tweaks the board up behind the back
  const tweak = def.id === 'method' ? 1 : 0;
  // Knees come up first (0 to 0.15), then the hand reaches (to 0.25); 0.25 to 0.75 is the hold
  return {
    cameraMoment: true,
    keys: [
      { t: 0 },
      { t: 0.15, hipDrop: 0.02, joints: { spine: [10, 0, 0] } },
      { t: 0.25, hipDrop: 0.02, joints: reach },
      { t: 0.75, hipDrop: 0.02, joints: reach },
      { t: 1 },
    ],
    board: t => {
      const up = Math.min(1, arc(t) * 1.6);
      return { lift: 0.36 * up, roll: (-0.15 - 0.45 * tweak) * up, pitch: 0.12 * tweak * up };
    },
  };
}

const ANIMS: Record<string, TrickAnimDef> = {
  ollie: {
    cameraMoment: false,
    keys: [
      { t: 0, hipDrop: 0.08 },
      { t: 0.15, frontLift: 0.12, hipDrop: -0.06, joints: { spine: [-6, 0, 0], frontArm: [0, 0, 12], backArm: [0, 0, -12] } },
      { t: 0.5, frontLift: 0.08, backLift: 0.08, hipDrop: 0.1 },
      { t: 1 },
    ],
    board: t => ({ pitch: 0.38 * arc(t / 0.4), lift: 0.06 * arc(t) }),
  },
  manual: {
    cameraMoment: false,
    keys: [{ t: 0 }, { t: 0.2, frontLift: 0.05, joints: { spine: [-6, 0, 8] } }, { t: 0.8, frontLift: 0.05, joints: { spine: [-6, 0, 8] } }, { t: 1 }],
    board: t => ({ pitch: 0.3 * Math.min(1, arc(t) * 1.8) }),
  },
  nose_manual: {
    cameraMoment: false,
    keys: [{ t: 0 }, { t: 0.2, backLift: 0.05, joints: { spine: [12, 0, -10], hips: [6, 0, -6] } }, { t: 0.8, backLift: 0.05, joints: { spine: [12, 0, -10], hips: [6, 0, -6] } }, { t: 1 }],
    board: t => ({ pitch: -0.3 * Math.min(1, arc(t) * 1.8) }),
  },
};

for (const def of Object.values(TRICKS)) {
  if (def.family === 'flip') ANIMS[def.id] = flipAnim(def);
  if (def.family === 'grab') ANIMS[def.id] = grabAnim(def);
}

export function animFor(id: string): TrickAnimDef | null {
  return ANIMS[id] ?? null;
}

export interface TrickSample {
  joints: JointPose;
  frontLift: number;
  backLift: number;
  hipDrop: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function sampleTrick(def: TrickAnimDef, t: number): TrickSample {
  const keys = def.keys;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const u = smooth(clamp01((t - a.t) / Math.max(b.t - a.t, 1e-6)));
  const mix = (x = 0, y = 0) => x + (y - x) * u;

  const joints: JointPose = {};
  const names = new Set([...Object.keys(a.joints ?? {}), ...Object.keys(b.joints ?? {})]) as Set<Joint>;
  for (const j of names) {
    const ja = a.joints?.[j] ?? [0, 0, 0];
    const jb = b.joints?.[j] ?? [0, 0, 0];
    joints[j] = [mix(ja[0], jb[0]), mix(ja[1], jb[1]), mix(ja[2], jb[2])];
  }
  return { joints, frontLift: mix(a.frontLift, b.frontLift), backLift: mix(a.backLift, b.backLift), hipDrop: mix(a.hipDrop, b.hipDrop) };
}
