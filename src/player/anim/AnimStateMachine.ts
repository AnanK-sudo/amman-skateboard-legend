import type { TrickAnim } from '../Skater';
import type { PushPhase } from './PushCycle';
import type { Mode } from '../RiderMode';
import type { BailReason } from '../LandingJudge';
import { TRICKS } from '../tricks/catalog';
import { JOINTS, mirrorPose, type Joint, type JointPose, type Stance, type Vec3 } from './mirror';
import { POSES, CARVE_TOE } from './poses';
import { animFor, sampleTrick, type BoardPose } from './tricks';

export type BaseState =
  | 'idle' | 'charge' | 'push' | 'ride' | 'carve' | 'brake' | 'pop' | 'air' | 'land'
  | 'grind' | 'manual' | 'bail' | 'getup' | 'walk' | 'mount';

export interface AnimInput {
  mode: Mode;
  speed: number;
  maxSpeed: number;
  grounded: boolean;
  pushPhase: PushPhase;
  /** +1 left, -1 right */
  turn: number;
  braking: boolean;
  grinding: boolean;
  grindType: string | null;
  bailReason: BailReason | null;
  bailProgress: number;
  mountProgress: number;
  walkSpeed: number;
  /** Radians through the walk cycle */
  stridePhase: number;
  trick: TrickAnim;
  trickProgress: number;
  /** Landing impact 0 to 1 */
  shock: number;
  /** Space held: 0 to 1 */
  crouch: number;
  /** Manual needle -1 (back) to 1 (front), or null */
  manualBalance: number | null;
  /** Effective stance: fakie riding passes the mirrored stance */
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
  /** Turns of body and board around the vertical while grinding (boardslides) */
  grindYaw: number;
  /** Radians the body tips forward and sideways (bails) */
  pivotPitch: number;
  pivotRoll: number;
  cameraMoment: boolean;
  /** 0 to 1, how far the body has turned toward the push stance */
  pushWeight: number;
  /** Radians the body turns from sideways toward travel (regular sense) */
  bodyYaw: number;
  /** Extra radians the front foot turns toward the nose */
  frontFootYaw: number;
  /** 1 riding sideways, 0 facing the way the body moves (walking, falling) */
  stand: number;
}

const POP_TIME  = 0.12;
const LAND_TIME = 0.25;
const MOVING    = 0.5;
const PUSH_BODY_YAW = 65 * Math.PI / 180;
const PUSH_FOOT_YAW = 25 * Math.PI / 180;
// Bail phases, matching RiderMode's 1.6 s: fall, lie, then get up over the last 0.6 s
const BAIL_FALL = 0.22;
const BAIL_GETUP = 0.625;

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

/** Fall angle over the bail, back to upright through the get-up */
function bailCurve(p: number, peak: number): number {
  if (p < BAIL_FALL) return (p / BAIL_FALL) * peak;
  if (p < BAIL_GETUP) return peak;
  return peak * (1 - (p - BAIL_GETUP) / (1 - BAIL_GETUP));
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
  private stand = 1;

  update(dt: number, inp: AnimInput): PoseFrame {
    this.time += dt;
    const riding = inp.mode === 'riding';
    if (riding && inp.grounded) {
      if (!this.wasGrounded) this.landTime = 0;
      else this.landTime += dt;
      this.airTime = 0;
    } else if (riding) {
      this.airTime = this.wasGrounded ? 0 : this.airTime + dt;
    }
    this.wasGrounded = !riding || inp.grounded;

    const state = this.pickState(inp);
    const speedRatio = Math.min(inp.speed / inp.maxSpeed, 1);
    const toeSide = inp.stance === 'regular' ? -inp.turn : inp.turn;

    // ── Target pose ──
    const baseKey = state === 'carve' ? 'ride' : state === 'getup' ? 'walk' : state;
    const target = zeroPose();
    addInto(target, POSES[baseKey].joints);
    let hipDrop = POSES[baseKey].hipDrop;
    let frontLift = 0, backLift = 0;
    let pivotPitch = 0, pivotRoll = 0;
    let standTarget = 1;

    if (state === 'ride' || state === 'carve' || state === 'idle') hipDrop += speedRatio * 0.08;
    if (state === 'carve') addInto(target, CARVE_TOE, toeSide);
    if (state === 'land') hipDrop += inp.shock * 0.12;
    if (state === 'charge') hipDrop = 0.12 + 0.22 * inp.crouch;
    if (state === 'push') {
      // Arms counter-swing against the pushing leg
      const swing = inp.pushPhase === 'contact' ? 1 : inp.pushPhase === 'reach' ? -1 : 0;
      addInto(target, { frontArm: [0, -24 * swing, 0], backArm: [0, -24 * swing, 0], spine: [4 * swing, 0, 0] });
    }
    if (state === 'grind') {
      const sway = Math.sin(this.time * 3.1) * 6;
      addInto(target, { spine: [0, 0, sway], frontArm: [0, 0, sway * 1.5], backArm: [0, 0, sway * 1.5] });
    }
    if (state === 'manual') {
      // The body leans with the balance needle, arms flail against it
      const lean = (inp.manualBalance ?? 0) * 14;
      addInto(target, { spine: [lean, 0, -lean * 0.5], frontArm: [0, 0, -lean * 1.4], backArm: [0, 0, -lean * 1.4] });
    }
    if (state === 'idle') hipDrop += Math.sin(this.time * 1.4) * 0.01;
    if (state === 'walk' || state === 'getup' || state === 'mount' || state === 'bail') standTarget = 0;
    if (state === 'walk') {
      const swing = Math.sin(inp.stridePhase) * Math.min(inp.walkSpeed / 1.6, 1.4) * 22;
      addInto(target, { frontArm: [0, swing, 0], backArm: [0, swing, 0], spine: [0, swing * 0.15, 0] });
    }
    if (state === 'bail' || state === 'getup') {
      const p = inp.bailProgress;
      if (inp.bailReason === 'crooked') { pivotRoll = bailCurve(p, 1.25); pivotPitch = bailCurve(p, 0.35); }
      else if (inp.bailReason === 'drop') { pivotPitch = bailCurve(Math.max(0, p - 0.08), 1.2); hipDrop = p < 0.12 ? 0.45 : hipDrop; }
      else pivotPitch = bailCurve(p, 1.4);
    }

    const trickDef = riding && inp.trick !== 'none' && state !== 'grind' ? animFor(inp.trick) : null;
    const board: BoardPose = { flip: 0, shove: 0, wrap: 0, pitch: 0, lift: 0, roll: 0 };
    if (trickDef) {
      const s = sampleTrick(trickDef, inp.trickProgress);
      addInto(target, s.joints);
      frontLift += s.frontLift;
      backLift += s.backLift;
      hipDrop += s.hipDrop;
      Object.assign(board, trickDef.board(inp.trickProgress));
    }
    let grindYaw = 0;
    if (state === 'grind' && inp.grindType) {
      const g = TRICKS[inp.grindType]?.grind;
      if (g) { board.pitch += g.pitch; board.roll += g.roll; grindYaw = g.yaw; }
    }

    // ── Smooth toward target ──
    const fast = trickDef || state === 'pop' || state === 'land' || state === 'bail' || state === 'charge';
    const rate = fast ? 22 : 10;
    for (const j of JOINTS) {
      const c = this.joints[j], t = target[j];
      this.joints[j] = [approach(c[0], t[0], rate, dt), approach(c[1], t[1], rate, dt), approach(c[2], t[2], rate, dt)];
    }
    this.hipDrop   = approach(this.hipDrop, hipDrop, rate, dt);
    this.frontLift = approach(this.frontLift, frontLift, 20, dt);
    this.backLift  = approach(this.backLift, backLift, 20, dt);
    this.roll      = approach(this.roll, state === 'carve' ? toeSide * 0.18 : 0, 8, dt);
    this.pitch     = approach(this.pitch, state === 'brake' ? -0.08 : 0, 8, dt);
    // The turn toward travel builds while the foot reaches, and the pivot back to sideways takes about 0.3 s
    this.pushWeight = approach(this.pushWeight, state === 'push' ? 1 : 0, state === 'push' ? 9 : 7, dt);
    this.stand = state === 'mount' ? inp.mountProgress : approach(this.stand, standTarget, state === 'bail' ? 14 : 8, dt);

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
      grindYaw,
      pivotPitch,
      pivotRoll,
      cameraMoment: riding && (inp.grinding || (trickDef?.cameraMoment ?? false)),
      pushWeight: this.pushWeight,
      bodyYaw: this.pushWeight * PUSH_BODY_YAW,
      frontFootYaw: this.pushWeight * PUSH_FOOT_YAW,
      stand: this.stand,
    };
  }

  private pickState(inp: AnimInput): BaseState {
    if (inp.mode === 'bailing') return inp.bailProgress < BAIL_GETUP ? 'bail' : 'getup';
    if (inp.mode === 'walking') return 'walk';
    if (inp.mode === 'mounting') return 'mount';
    if (inp.grinding) return 'grind';
    if (!inp.grounded) return this.airTime < POP_TIME ? 'pop' : 'air';
    if (this.landTime < LAND_TIME) return 'land';
    if (inp.pushPhase !== 'none') return 'push';
    if (inp.manualBalance !== null) return 'manual';
    if (inp.crouch > 0) return 'charge';
    if (inp.braking && inp.speed > MOVING) return 'brake';
    if (inp.turn !== 0 && inp.speed > MOVING) return 'carve';
    if (inp.speed > MOVING) return 'ride';
    return 'idle';
  }
}
