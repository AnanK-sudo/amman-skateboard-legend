import type { JointPose } from './mirror';

// Regular stance, character rest space (faces +Z, nose side +X). Sign guide:
//   x > 0 leans forward over the toes, y > 0 turns toward the nose, z < 0 bends toward the nose.
//   frontArm: z < 0 lowers it, y < 0 swings it in front of the chest. backArm: mirror (z > 0 lowers, y > 0 in front).
//   ForeArms bend toward the chest with frontForeArm y < 0, backForeArm y > 0.

export interface BasePose {
  joints: JointPose;
  /** Metres the hips sit below standing height; the leg IK turns this into bent knees */
  hipDrop: number;
}

export const POSES = {
  idle: {
    hipDrop: 0.06,
    joints: {
      spine: [4, 12, 0], spine1: [2, 8, 0], neck: [0, 12, 0], head: [4, 45, 0],
      frontArm: [0, -12, -72], frontForeArm: [0, -18, 0],
      backArm: [0, 12, 74], backForeArm: [0, 18, 0],
    },
  },
  ride: {
    hipDrop: 0.12,
    joints: {
      hips: [6, 0, 0], spine: [10, 18, 0], spine1: [6, 10, 0], neck: [0, 14, 0], head: [-4, 48, 0],
      frontArm: [0, -24, -38], frontForeArm: [0, -24, 0],
      backArm: [0, 18, 44], backForeArm: [0, 22, 0],
    },
  },
  push: {
    hipDrop: 0.2,
    joints: {
      hips: [10, 20, -6], spine: [16, 30, -6], spine1: [8, 14, 0], neck: [0, 10, 0], head: [-6, 30, 0],
      frontArm: [0, -34, -58], frontForeArm: [0, -30, 0],
      backArm: [0, 24, 62], backForeArm: [0, 26, 0],
    },
  },
  brake: {
    hipDrop: 0.18,
    joints: {
      hips: [-4, 0, 8], spine: [-6, 12, 10], spine1: [-2, 6, 0], neck: [0, 12, 0], head: [0, 50, 0],
      frontArm: [0, -46, -30], frontForeArm: [0, -30, 0],
      backArm: [0, 10, 30], backForeArm: [0, 20, 0],
    },
  },
  pop: {
    hipDrop: 0.34,
    joints: {
      hips: [14, 0, 0], spine: [24, 18, 0], spine1: [10, 6, 0], neck: [0, 10, 0], head: [10, 40, 0],
      frontArm: [0, -20, -30], frontForeArm: [0, -30, 0],
      backArm: [0, 20, 30], backForeArm: [0, 30, 0],
    },
  },
  air: {
    hipDrop: 0.3,
    joints: {
      hips: [12, 0, 0], spine: [18, 18, 0], spine1: [10, 6, 0], neck: [6, 10, 0], head: [16, 38, 0],
      frontArm: [0, -12, -14], frontForeArm: [0, -20, 0],
      backArm: [0, 12, 16], backForeArm: [0, 20, 0],
    },
  },
  land: {
    hipDrop: 0.32,
    joints: {
      hips: [14, 0, 0], spine: [22, 18, 0], spine1: [10, 8, 0], neck: [0, 12, 0], head: [6, 42, 0],
      frontArm: [0, -18, -48], frontForeArm: [0, -26, 0],
      backArm: [0, 16, 50], backForeArm: [0, 26, 0],
    },
  },
  grind: {
    hipDrop: 0.26,
    joints: {
      hips: [10, 10, 0], spine: [14, 22, 0], spine1: [8, 8, 0], neck: [4, 12, 0], head: [8, 44, 0],
      frontArm: [0, -8, -6], frontForeArm: [0, -14, 0],
      backArm: [0, 8, 8], backForeArm: [0, 14, 0],
    },
  },
  manual: {
    hipDrop: 0.16,
    joints: {
      hips: [-6, 0, 10], spine: [-4, 18, 12], spine1: [0, 8, 4], neck: [0, 10, 0], head: [6, 44, 0],
      frontArm: [0, -14, 8], frontForeArm: [0, -20, 0],
      backArm: [0, 14, -6], backForeArm: [0, 20, 0],
    },
  },
  bail: {
    hipDrop: 0.3,
    joints: {
      hips: [20, 0, 0], spine: [34, 0, 0], spine1: [14, 0, 0], neck: [-10, 0, 0], head: [-20, 10, 0],
      frontArm: [0, -70, -10], frontForeArm: [0, -10, 0],
      backArm: [0, 70, 10], backForeArm: [0, 10, 0],
    },
  },
} satisfies Record<string, BasePose>;

/** Added on top of ride when carving: lean toward the toe edge (or heel edge when negative) */
export const CARVE_TOE: JointPose = {
  hips: [8, 0, 0], spine: [10, 6, 0], spine1: [4, 0, 0], head: [-6, 8, 0],
  frontArm: [0, -14, 10], backArm: [0, 14, -10],
};
