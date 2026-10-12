import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PushCycle, type PushPhase } from './anim/PushCycle';
import { RIDER_PROBE, STEP_HEIGHT, groundHit, resolveWalls } from './physicsRays';
import { TRICKS } from './tricks/catalog';
import { ManualBalance } from './tricks/ManualBalance';
import type { LandingSnapshot } from './LandingJudge';

export interface SkaterInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  /** Space held: crouch, charge the ollie, absorb a drop */
  ollieHeld: boolean;
  spinLeft: boolean;
  spinRight: boolean;
}

/** A trick id from the catalog, or none */
export type TrickAnim = string;

export interface LandingEvent {
  snapshot: LandingSnapshot;
  /** Flip and grab ids thrown during the air, in order */
  airTricks: string[];
  /** Signed half turns of spin, rounded */
  halfTurns: number;
  /** Tenths of a second spent holding grabs */
  grabTicks: number;
  /** True when the air started with a plain ollie */
  ollied: boolean;
}

const GRAVITY = 9.82 * 2;
const HALF_HEIGHT = 0.9;
const AIRBORNE_THRESHOLD = 0.3;
const OLLIE_MIN = 5;
const OLLIE_MAX = 7.5;
const OLLIE_CHARGE = 0.4;
const FLIP_POP = 6;
const SPIN_RATE = THREE.MathUtils.degToRad(540);
const GRAB_IN = 0.12;
const MANUAL_MIN_SPEED = 0.5;

export class Skater {
  readonly body: CANNON.Body;
  readonly maxSpeed = 15;

  private world: CANNON.World;
  // Forward is +Z rotated by yaw, matching the model and the camera. PI heads toward -Z, where the zones were built.
  private _yaw = Math.PI;
  private _speed = 0;
  private _turnInput = 0;
  private _braking = false;
  private pushThrust = 28;   // only while the push foot is on the ground
  private brakeForce = 15;
  private turnSpeed = 2.5;
  private push = new PushCycle();
  private isPushing = false;

  private groundY = 0;
  private verticalVel = 0;
  private airborne = false;
  private landingShock = 0;
  private peakFeetY = 0;

  private charge = 0;
  private wasOllieHeld = false;
  private _crouched = false;

  // Air bookkeeping
  private _spinAngle = 0;
  private airTricks: string[] = [];
  private ollied = false;
  private grabTicksTotal = 0;

  // Animation-facing trick state
  private flipId: string | null = null;
  private flipTimer = 0;
  private flipDuration = 0.5;
  private ollieTimer = -1;
  private ollieDuration = 0.5;
  private grabId: string | null = null;
  private grabHeldNow = false;
  private grabTimer = 0;
  private grabReleaseTimer = -1;
  private manualId: string | null = null;
  private balance = new ManualBalance();
  private _fakie = false;
  private _grindType: string | null = null;

  private pendingLanding: LandingEvent | null = null;
  private pendingWallHit: { before: number; after: number } | null = null;
  private manualFailed = false;

  private _positionVec = new THREE.Vector3();

  constructor(world: CANNON.World, spawn?: { x: number; y: number; z: number }) {
    this.world = world;
    this.body = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.15)),
      position: new CANNON.Vec3(spawn?.x ?? 0, spawn?.y ?? 1, spawn?.z ?? 0),
      fixedRotation: true,
      // Own group, so the wall and ground rays (mask 1) never hit the skater's own box
      collisionFilterGroup: 2,
      collisionFilterMask: 1,
    });
    world.addBody(this.body);
  }

  get yaw(): number { return this._yaw; }
  get speed(): number { return this._speed; }
  get isGrounded(): boolean { return !this.airborne; }
  get isAirborne(): boolean { return this.airborne; }
  get pushing(): boolean { return this.isPushing; }
  get pushState(): { phase: PushPhase; phaseT: number; contactTravel: number; stride: number } {
    return { phase: this.push.phase, phaseT: this.push.phaseT, contactTravel: this.push.contactTravel, stride: this.push.stride };
  }
  get shock(): number { return this.landingShock; }
  get turnInput(): number { return this._turnInput; }
  get braking(): boolean { return this._braking; }
  /** 0 to 1 while Space is held on the ground (ollie charge) or in the air (bracing for the landing) */
  get crouch(): number { return this._crouched ? Math.max(0.5, Math.min(this.charge / OLLIE_CHARGE, 1)) : 0; }
  get crouched(): boolean { return this._crouched; }
  /** Signed radians of spin this air; left is positive */
  get spinAngle(): number { return this._spinAngle; }
  get fakie(): boolean { return this._fakie; }
  get grabHeld(): boolean { return this.grabHeldNow; }
  get manualBalance(): number | null { return this.manualId ? this.balance.value : null; }
  get manualTrick(): string | null { return this.manualId; }
  get grindType(): string | null { return this._grindType; }
  get position(): THREE.Vector3 {
    const p = this.body.position;
    return this._positionVec.set(p.x, p.y, p.z);
  }

  /** The trick the animation should show */
  get trick(): TrickAnim {
    if (this.manualId) return this.manualId;
    if (this.grabId) return this.grabId;
    if (this.flipId) return this.flipId;
    if (this.ollieTimer >= 0) return 'ollie';
    return 'none';
  }

  get trickProgress(): number {
    if (this.manualId) return 0.5;
    if (this.grabId) {
      if (this.grabReleaseTimer >= 0) return 0.75 + 0.25 * Math.min(this.grabReleaseTimer / GRAB_IN, 1);
      return Math.min(this.grabTimer / GRAB_IN, 1) * 0.25 + (this.grabTimer > GRAB_IN ? 0.25 : 0);
    }
    if (this.flipId) return Math.min(this.flipTimer / this.flipDuration, 1);
    if (this.ollieTimer >= 0) return Math.min(this.ollieTimer / this.ollieDuration, 1);
    return 0;
  }

  // ── Trick commands ─────────────────────────────────────────────────────────

  /** Pops if grounded; ignored while another flip is still turning */
  startFlip(id: string): boolean {
    if (this.flipId || this.manualId || this.grabId) return false;
    if (!this.airborne) this.pop(FLIP_POP, false);
    this.flipId = id;
    this.flipTimer = 0;
    this.flipDuration = this.stretchedDuration();
    this.airTricks.push(id);
    return true;
  }

  startGrab(id: string): boolean {
    if (!this.airborne || this.grabId || this.flipId) return false;
    this.grabId = id;
    this.grabHeldNow = true;
    this.grabTimer = 0;
    this.grabReleaseTimer = -1;
    this.airTricks.push(id);
    return true;
  }

  releaseGrab(): void {
    if (this.grabId && this.grabHeldNow) {
      this.grabHeldNow = false;
      this.grabReleaseTimer = 0;
    }
  }

  startManual(id: string): boolean {
    if (this.airborne || this.manualId || this._speed < MANUAL_MIN_SPEED) return false;
    this.manualId = id;
    this.balance.start();
    return true;
  }

  setGrinding(type: string | null): void { this._grindType = type; }

  /** After a clean landing: a 180 or 540 rides out fakie */
  landClean(halfTurns: number): void {
    if (Math.abs(halfTurns) % 2 === 1) this._fakie = !this._fakie;
    this._spinAngle = 0;
  }

  /** Back on the board after a bail, or after a zone switch */
  reset(feet: { x: number; y: number; z: number }, yaw: number): void {
    this.body.position.set(feet.x, feet.y + HALF_HEIGHT, feet.z);
    this._yaw = yaw;
    this._speed = 0;
    this.verticalVel = 0;
    this.airborne = false;
    this.groundY = feet.y;
    this._fakie = false;
    this.clearHeld();
  }

  /** Drops held grabs, charges, manuals and pending events (zone switches, bails) */
  clearHeld(): void {
    this.flipId = null;
    this.grabId = null;
    this.grabHeldNow = false;
    this.manualId = null;
    this.ollieTimer = -1;
    this.charge = 0;
    this.wasOllieHeld = false;
    this._crouched = false;
    this._spinAngle = 0;
    this.airTricks = [];
    this.grabTicksTotal = 0;
    this.pendingLanding = null;
    this.pendingWallHit = null;
    this.manualFailed = false;
  }

  consumeLanding(): LandingEvent | null { const e = this.pendingLanding; this.pendingLanding = null; return e; }
  consumeWallHit(): { before: number; after: number } | null { const e = this.pendingWallHit; this.pendingWallHit = null; return e; }
  consumeManualFail(): boolean { const f = this.manualFailed; this.manualFailed = false; return f; }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(delta: number, input: SkaterInput): void {
    const inManual = this.manualId !== null;
    const turnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this._turnInput = turnInput;
    this._braking = input.backward && !input.forward && !inManual;
    this._yaw += turnInput * this.turnSpeed * delta;
    const forward = new CANNON.Vec3(Math.sin(this._yaw), 0, Math.cos(this._yaw));

    // ── Speed ──
    const wantPush = input.forward && !input.backward && !this.airborne && !inManual;
    const thrusting = this.push.update(delta, this._speed, wantPush, this._speed >= this.maxSpeed * 0.98);
    this.isPushing = this.push.phase !== 'none';
    if (thrusting) {
      this._speed = Math.min(this._speed + this.pushThrust * delta, this.maxSpeed);
    } else if (this._braking) {
      this._speed = Math.max(this._speed - this.brakeForce * delta, 0);
    } else {
      // Rolling resistance is light between strokes and in manuals, stronger when coasting
      this._speed *= (1 - (this.isPushing || input.forward || inManual ? 0.3 : 2) * delta);
      if (this._speed < 0.01) this._speed = 0;
    }

    // ── Walls ──
    const feetY = this.body.position.y - HALF_HEIGHT;
    const wantX = forward.x * this._speed * delta, wantZ = forward.z * this._speed * delta;
    const [dx, dz] = resolveWalls(this.world, this.body.position.x, feetY, this.body.position.z, wantX, wantZ, RIDER_PROBE);
    // Keep only the speed that survived the wall: head-on stops, a glancing hit slides on
    const wanted = Math.hypot(wantX, wantZ);
    if (wanted > 0.001) {
      const before = this._speed;
      this._speed *= Math.hypot(dx, dz) / wanted;
      if (this._speed < before * 0.9) this.pendingWallHit = { before, after: this._speed };
    }
    this.body.position.x += dx;
    this.body.position.z += dz;

    // ── Ground ──
    const groundBefore = this.groundY;
    const hit = groundHit(this.world, this.body.position.x, this.body.position.z, this.body.position.y + 2);
    this.groundY = hit?.y ?? 0;
    // A flat top more than a step above the feet is a ledge we clipped into, not ground to snap up onto.
    // If the ground under the old position is just as high we were already embedded (e.g. spawned
    // inside a platform), so let the snap lift us out instead of pinning us in place.
    if (!this.airborne && hit && this.groundY - feetY > STEP_HEIGHT && hit.normalY > 0.95) {
      const back = groundHit(this.world, this.body.position.x - dx, this.body.position.z - dz, this.body.position.y + 2);
      const embedded = back !== null && back.y - feetY > STEP_HEIGHT;
      if (!embedded) {
        this.body.position.x -= dx;
        this.body.position.z -= dz;
        this.groundY = groundBefore;
        this._speed = 0;
      }
    }
    const feetHeight = this.groundY + HALF_HEIGHT;

    // ── Ollie charge: hold Space to crouch, release to pop ──
    this._crouched = input.ollieHeld;
    if (input.ollieHeld && !this.airborne) this.charge += delta;
    const released = this.wasOllieHeld && !input.ollieHeld;
    this.wasOllieHeld = input.ollieHeld;
    if (released && !this.airborne && this.charge > 0) {
      this.manualId = null;
      this.pop(OLLIE_MIN + (OLLIE_MAX - OLLIE_MIN) * Math.min(this.charge / OLLIE_CHARGE, 1), true);
    }
    if (!input.ollieHeld) this.charge = 0;

    // ── Vertical ──
    if (this.airborne) {
      this.verticalVel -= GRAVITY * delta;
      this.body.position.y += this.verticalVel * delta;
      this.peakFeetY = Math.max(this.peakFeetY, this.body.position.y - HALF_HEIGHT);
      this._spinAngle += ((input.spinLeft ? 1 : 0) - (input.spinRight ? 1 : 0)) * SPIN_RATE * delta;
      if (this.body.position.y <= feetHeight) {
        this.body.position.y = feetHeight;
        this.landingShock = Math.min(1, Math.abs(this.verticalVel) * 0.08);
        this.touchDown();
      }
    } else if (this.body.position.y - feetHeight > AIRBORNE_THRESHOLD) {
      this.leaveGround(0);
    } else {
      this.body.position.y = feetHeight;
    }
    this.landingShock = Math.max(0, this.landingShock - delta * 4);

    // ── Trick timers ──
    if (this.flipId) {
      this.flipTimer += delta;
      if (this.flipTimer >= this.flipDuration) this.flipId = null;
    }
    if (this.ollieTimer >= 0) {
      this.ollieTimer += delta;
      if (this.ollieTimer >= this.ollieDuration) this.ollieTimer = -1;
    }
    if (this.grabId) {
      if (this.grabHeldNow) {
        this.grabTimer += delta;
        if (this.grabTimer > GRAB_IN) this.grabTicksTotal += delta * 10;
      } else {
        this.grabReleaseTimer += delta;
        if (this.grabReleaseTimer >= GRAB_IN) { this.grabId = null; this.grabReleaseTimer = -1; }
      }
    }
    if (this.manualId) {
      if (this._speed < MANUAL_MIN_SPEED) this.manualId = null;
      else if (this.balance.update(delta, (input.forward ? 1 : 0) - (input.backward ? 1 : 0))) {
        this.manualId = null;
        this.manualFailed = true;
      }
    }

    if (this.body.position.y < -10) {
      this.body.position.set(0, 2, 0);
      this._speed = 0;
      this.verticalVel = 0;
      this.airborne = false;
    }
  }

  private pop(velocity: number, ollie: boolean): void {
    this.leaveGround(velocity);
    this.ollied = ollie;
    this.ollieTimer = 0;
    this.ollieDuration = this.stretchedDuration();
  }

  private leaveGround(velocity: number): void {
    this.verticalVel = velocity;
    this.airborne = true;
    this.peakFeetY = this.body.position.y - HALF_HEIGHT;
    this._spinAngle = 0;
    this.airTricks = [];
    this.ollied = false;
    this.grabTicksTotal = 0;
  }

  private touchDown(): void {
    const residual = this._spinAngle - Math.round(this._spinAngle / Math.PI) * Math.PI;
    const flipUnfinished = this.flipId !== null && this.flipTimer < this.flipDuration;
    this.pendingLanding = {
      snapshot: {
        flipProgress: flipUnfinished ? this.flipTimer / this.flipDuration : null,
        grabHeld: this.grabHeldNow,
        spinResidualDeg: THREE.MathUtils.radToDeg(residual),
        dropHeight: this.peakFeetY - this.groundY,
        crouched: this._crouched,
      },
      airTricks: [...this.airTricks],
      halfTurns: Math.round(this._spinAngle / Math.PI),
      grabTicks: Math.floor(this.grabTicksTotal),
      ollied: this.ollied,
    };
    this.verticalVel = 0;
    this.airborne = false;
    this.flipId = null;
    this.grabId = null;
    this.grabHeldNow = false;
    this.ollieTimer = -1;
  }

  /** Most of the remaining flight, so flips and the ollie fill the jump */
  private stretchedDuration(): number {
    const height = Math.max(0, this.body.position.y - HALF_HEIGHT - this.groundY);
    const flight = (this.verticalVel + Math.sqrt(this.verticalVel ** 2 + 2 * GRAVITY * height)) / GRAVITY;
    return Math.min(Math.max(flight * 0.85, 0.35), 0.8);
  }
}

export function trickName(id: string): string {
  return TRICKS[id]?.name ?? id;
}
