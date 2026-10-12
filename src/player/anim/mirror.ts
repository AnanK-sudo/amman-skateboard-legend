export type Stance = 'regular' | 'goofy';

export type Joint =
  | 'hips' | 'spine' | 'spine1' | 'spine2' | 'neck' | 'head'
  | 'frontArm' | 'frontForeArm' | 'backArm' | 'backForeArm';

export type Vec3 = [number, number, number];

/**
 * Joint rotations in degrees (Euler XYZ) in character rest space: the character faces +Z,
 * +X is its left, +Y is up. Authored for regular stance, where the front (nose) side is +X.
 */
export type JointPose = Partial<Record<Joint, Vec3>>;

export const JOINTS: Joint[] = [
  'hips', 'spine', 'spine1', 'spine2', 'neck', 'head',
  'frontArm', 'frontForeArm', 'backArm', 'backForeArm',
];

/** Turns the body sideways on the board: regular faces the right of travel, goofy the left */
export const STANCE_YAW: Record<Stance, number> = { regular: -Math.PI / 2, goofy: Math.PI / 2 };

/** +1 regular, -1 goofy: flips board rotations that are authored for regular */
export function stanceSign(stance: Stance): number {
  return stance === 'regular' ? 1 : -1;
}

const CENTER: Partial<Record<Joint, string>> = {
  hips: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2', neck: 'Neck', head: 'Head',
};

function side(limb: 'front' | 'back', stance: Stance): 'Left' | 'Right' {
  return (limb === 'front') === (stance === 'regular') ? 'Left' : 'Right';
}

export function boneName(joint: Joint, stance: Stance): string {
  const center = CENTER[joint];
  if (center) return `mixamorig${center}`;
  const limb = joint.startsWith('front') ? 'front' : 'back';
  const part = joint.endsWith('ForeArm') ? 'ForeArm' : 'Arm';
  return `mixamorig${side(limb, stance)}${part}`;
}

export function legBoneNames(limb: 'front' | 'back', stance: Stance): { upper: string; lower: string; foot: string } {
  const s = side(limb, stance);
  return { upper: `mixamorig${s}UpLeg`, lower: `mixamorig${s}Leg`, foot: `mixamorig${s}Foot` };
}

/** Mirror across the body's sagittal plane; front/back joints already swap sides through boneName */
export function mirrorPose(pose: JointPose): JointPose {
  const out: JointPose = {};
  for (const j of Object.keys(pose) as Joint[]) {
    const [x, y, z] = pose[j]!;
    out[j] = [x, -y, -z];
  }
  return out;
}
