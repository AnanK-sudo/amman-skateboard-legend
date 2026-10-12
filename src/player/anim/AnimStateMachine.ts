import type { TrickAnim } from '../Skater';
import type { PushPhase } from './PushCycle';
import { JOINTS, mirrorPose, type Joint, type JointPose, type Stance, type Vec3 } from './mirror';
import { POSES, CARVE_TOE } from './poses';
import { TRICKS, sampleTrick, type BoardPose } from './tricks';

export type BaseState = 'idle' | 'push' | 'ride' | 'carve' | 'brake' | 'pop' | 'air' | 'land' | 'grind' | 'manual' | 'bail';

export interface AnimInput {
  speed: number;
  maxSpeed: number;
  grounded: boolean;
  pushPhase: PushPhase;
  /** +1 left, -1 right */
  turn: number;
  braking: boolean;
  grinding: boolean;
  bailing: boolean;
  bailProgress: number;
  trick: TrickAnim;
  trickProgress: number;
  /** Landing impact 0 to 1 */
  shock: number;
  stance: Stance;
}

export interface PoseFrame {
  state: BaseState;
  /** Stance-correct (already mirrored for goofy) */
  joints: JointPose;
  hipDrop: number;
  /** Metres each foot rises off the deck */
  frontLift: number;
  backLift: number;
  /** Authored for regular; the model applies the stance sign */
  board: BoardPose;
  /** Radians the whole body pitches forward (bails) */
  pivotPitch: number;
  /** Turns of the whole body and board */
  spin: number;
  cameraMoment: boolean;
  /** 0 to 1, how far the body has turned toward the push stance */
  pushWeight: number;
}

const POP_TIME  = 0.12;
const LAND_TIME = 0.25;
const MOVING    = 0.5;

const approach = (cur: number, target: number, rate: number, dt: number): number =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

function addInto(out: Record<Joint, Vec3>, pose: JointPose, weight = 1): void {
  for (const j of Object.keys(pose) as Joint[]) {
    const v = pose[j]!;
    out[j] = [out[j][0] + v[0] * weight, out[j][1] + v[1] * weight, out[j][2] + v[2] * weight];
  }
}

function zeroPose(): Record<Joint, Vec3> {
  const p = {} as Record<Joint, Vec3>;
  for (const j of JOINTS) p[j] = [0, 0, 0];
  return p;
}

export class AnimStateMachine {
  private airTime  = 0;
  private landTime = Infinity;
  private wasGrounded = true;
  private time = 0;

  private joints = zeroPose();
  private hipDrop = POSES.idle.hipDrop;
  private frontLift = 0;
  private backLift = 0;
  private roll = 0;
  private pitch = 0;
  private pushWeight = 0;

  update(dt: number, inp: AnimInput): PoseFrame {
    this.time += dt;
    if (inp.grounded) {
      if (!this.wasGrounded) this.landTime = 0;
      else this.landTime += dt;
      this.airTime = 0;
    } else {
      this.airTime = this.wasGrounded ? 0 : this.airTime + dt;
    }
    this.wasGrounded = inp.grounded;

    const state = this.pickState(inp);
    const speedRatio = Math.min(inp.speed / inp.maxSpeed, 1);
    const toeSide = inp.stance === 'regular' ? -inp.turn : inp.turn;

    // ── Target pose ──
    const baseKey = state === 'carve' ? 'ride' : state;
    const target = zeroPose();
    addInto(target, POSES[baseKey].joints);
    let hipDrop = POSES[baseKey].hipDrop;
    let frontLift = 0, backLift = 0;

    if (state === 'ride' || state === 'carve' || state === 'idle') hipDrop += speedRatio * 0.08;
    if (state === 'carve') addInto(target, CARVE_TOE, toeSide);
    if (state === 'land') hipDrop += inp.shock * 0.12;
    if (state === 'push') {
      // Arms counter-swing against the pushing leg
      const swing = inp.pushPhase === 'contact' ? 1 : inp.pushPhase === 'reach' ? -1 : 0;
      addInto(target, { frontArm: [0, -18 * swing, 0], backArm: [0, -22 * swing, 0], spine: [4 * swing, 0, 0] });
    }
    if (state === 'grind' || state === 'manual') {
      const sway = Math.sin(this.time * 3.1) * (state === 'grind' ? 6 : 8);
      addInto(target, { spine: [0, 0, sway], frontArm: [0, 0, sway * 1.5], backArm: [0, 0, sway * 1.5] });
    }
    if (state === 'idle') hipDrop += Math.sin(this.time * 1.4) * 0.01;

    const trickDef = inp.trick !== 'none' && state !== 'grind' && state !== 'bail' ? TRICKS[inp.trick] : null;
    const board: BoardPose = { flip: 0, shove: 0, pitch: 0, lift: 0, roll: 0 };
    let spin = 0;
    if (trickDef) {
      const s = sampleTrick(trickDef, inp.trickProgress);
      addInto(target, s.joints);
      frontLift += s.frontLift;
      backLift += s.backLift;
      hipDrop += s.hipDrop;
      Object.assign(board, trickDef.board(inp.trickProgress));
      spin = trickDef.spin?.(inp.trickProgress) ?? 0;
    }

    // ── Smooth toward target ──
    const rate = trickDef || state === 'pop' || state === 'land' || state === 'bail' ? 22 : 10;
    for (const j of JOINTS) {
      const c = this.joints[j], t = target[j];
      this.joints[j] = [approach(c[0], t[0], rate, dt), approach(c[1], t[1], rate, dt), approach(c[2], t[2], rate, dt)];
    }
    this.hipDrop   = approach(this.hipDrop, hipDrop, rate, dt);
    this.frontLift = approach(this.frontLift, frontLift, 20, dt);
    this.backLift  = approach(this.backLift, backLift, 20, dt);
    this.roll      = approach(this.roll, state === 'carve' ? toeSide * 0.18 : 0, 8, dt);
    this.pitch     = approach(this.pitch, state === 'brake' ? -0.08 : 0, 8, dt);
    this.pushWeight = approach(this.pushWeight, state === 'push' ? 1 : 0, 8, dt);

    board.roll += this.roll;
    board.pitch += this.pitch;

    const joints: JointPose = { ...this.joints };
    return {
      state,
      joints: inp.stance === 'regular' ? joints : mirrorPose(joints),
      hipDrop: this.hipDrop,
      frontLift: this.frontLift,
      backLift: this.backLift,
      board,
      pivotPitch: state === 'bail' ? bailPitch(inp.bailProgress) : 0,
      spin,
      cameraMoment: inp.grinding || (trickDef?.cameraMoment ?? false),
      pushWeight: this.pushWeight,
    };
  }

  private pickState(inp: AnimInput): BaseState {
    if (inp.bailing) return 'bail';
    if (inp.grinding) return 'grind';
    if (!inp.grounded) return this.airTime < POP_TIME ? 'pop' : 'air';
    if (this.landTime < LAND_TIME) return 'land';
    if (inp.pushPhase !== 'none') return 'push';
    if (inp.trick === 'manual') return 'manual';
    if (inp.braking && inp.speed > MOVING) return 'brake';
    if (inp.turn !== 0 && inp.speed > MOVING) return 'carve';
    if (inp.speed > MOVING) return 'ride';
    return 'idle';
  }
}

/** Falls forward to lying flat, stays down, then rises; matches the skater's bail phases */
function bailPitch(p: number): number {
  const FALL = 0.23, DOWN = 0.67;
  if (p < FALL) return (p / FALL) * 1.3;
  if (p < DOWN) return 1.3;
  return 1.3 * (1 - (p - DOWN) / (1 - DOWN));
}
