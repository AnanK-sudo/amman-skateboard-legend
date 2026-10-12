import type { TrickAnim } from '../Skater';
import type { JointPose, Joint, Vec3 } from './mirror';

/** Board motion for regular stance; the model flips signs for goofy */
export interface BoardPose {
  /** Turns around the board's long axis */
  flip: number;
  /** Turns around the vertical axis (shove-it) */
  shove: number;
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

export interface TrickDef {
  keys: TrickKey[];
  board: (t: number) => Partial<BoardPose>;
  /** Turns of the whole body and board */
  spin?: (t: number) => number;
  cameraMoment: boolean;
}

export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const arc = (t: number): number => Math.sin(Math.PI * Math.min(Math.max(t, 0), 1));

const flipKeys = (lift: number, kickArm: Vec3): TrickKey[] => [
  { t: 0, hipDrop: 0.06 },
  { t: 0.18, frontLift: lift, backLift: lift * 0.8, hipDrop: 0.04, joints: { spine: [10, 0, 0], frontArm: kickArm, head: [14, -6, 0] } },
  { t: 0.7, frontLift: lift * 0.9, backLift: lift * 0.8, joints: { spine: [8, 0, 0], head: [12, -6, 0] } },
  { t: 1 },
];

export const TRICKS: Record<Exclude<TrickAnim, 'none'>, TrickDef> = {
  ollie: {
    cameraMoment: false,
    keys: [
      { t: 0, hipDrop: 0.08 },
      { t: 0.15, frontLift: 0.12, hipDrop: -0.06, joints: { spine: [-6, 0, 0], frontArm: [0, 0, 12], backArm: [0, 0, -12] } },
      { t: 0.5, frontLift: 0.08, backLift: 0.08, hipDrop: 0.08 },
      { t: 1 },
    ],
    board: t => ({ pitch: 0.38 * arc(t / 0.4), lift: 0.06 * arc(t) }),
  },
  kickflip: {
    cameraMoment: true,
    keys: flipKeys(0.24, [0, -10, 16]),
    board: t => ({ flip: easeInOut(t), lift: 0.12 * arc(t) }),
  },
  heelflip: {
    cameraMoment: true,
    keys: flipKeys(0.24, [0, 10, 16]),
    board: t => ({ flip: -easeInOut(t), lift: 0.12 * arc(t) }),
  },
  tre_flip: {
    cameraMoment: true,
    keys: flipKeys(0.28, [0, -10, 20]),
    board: t => ({ flip: easeInOut(t), shove: easeInOut(t), lift: 0.15 * arc(t) }),
  },
  spin: {
    cameraMoment: true,
    keys: [
      { t: 0, joints: { frontArm: [0, 30, 10], backArm: [0, -30, -10], head: [0, -10, 0] } },
      { t: 0.3, frontLift: 0.1, backLift: 0.1, joints: { frontArm: [0, -30, 30], backArm: [0, 20, -30], head: [0, 25, 0], spine: [0, 15, 0] } },
      { t: 0.8, frontLift: 0.08, backLift: 0.08, joints: { frontArm: [0, -10, 20], backArm: [0, 10, -20], head: [0, 15, 0] } },
      { t: 1 },
    ],
    board: () => ({}),
    spin: t => easeInOut(t),
  },
  grab: {
    cameraMoment: true,
    keys: [
      { t: 0 },
      { t: 0.25, frontLift: 0.32, backLift: 0.3, hipDrop: 0.06, joints: { spine: [36, 0, 0], spine1: [14, 0, 0], frontArm: [0, -36, -70], frontForeArm: [0, -12, 0], head: [10, -10, 0] } },
      { t: 0.75, frontLift: 0.32, backLift: 0.3, hipDrop: 0.06, joints: { spine: [36, 0, 0], spine1: [14, 0, 0], frontArm: [0, -36, -70], frontForeArm: [0, -12, 0], head: [10, -10, 0] } },
      { t: 1 },
    ],
    board: t => ({ lift: 0.26 * Math.min(1, arc(t) * 1.6), roll: -0.15 * arc(t) }),
  },
  manual: {
    cameraMoment: false,
    keys: [
      { t: 0 },
      { t: 0.2, frontLift: 0.05, joints: { spine: [-6, 0, 8] } },
      { t: 0.8, frontLift: 0.05, joints: { spine: [-6, 0, 8] } },
      { t: 1 },
    ],
    board: t => ({ pitch: 0.3 * Math.min(1, arc(t) * 1.8) }),
  },
};

export interface TrickSample {
  joints: JointPose;
  frontLift: number;
  backLift: number;
  hipDrop: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function sampleTrick(def: TrickDef, t: number): TrickSample {
  const keys = def.keys;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const u = smooth(Math.min(Math.max((t - a.t) / Math.max(b.t - a.t, 1e-6), 0), 1));
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
