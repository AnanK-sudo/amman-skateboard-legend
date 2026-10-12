import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import { STEP_HEIGHT, WALKER_PROBE, groundHit, resolveWalls } from './physicsRays';

export interface WalkInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jog: boolean;
}

const WALK_SPEED = 1.6;
const JOG_SPEED = 3;
const ACCEL = 10;
const TURN_RATE = 10;
const GRAVITY = 9.82 * 2;
const STRIDE = 0.7;

/** On foot after a bail: walks back to the board */
export class Walker {
  /** Feet position */
  readonly position = new THREE.Vector3();
  yaw = 0;
  private _speed = 0;
  private verticalVel = 0;
  /** Radians through the walk cycle; one full turn is two steps */
  stridePhase = 0;

  get speed(): number { return this._speed; }

  place(feet: THREE.Vector3, yaw: number): void {
    this.position.copy(feet);
    this.yaw = yaw;
    this._speed = 0;
    this.verticalVel = 0;
  }

  /** cameraYaw: the camera's orbit angle (it sits at target + (sin, cos) * distance); forward is away from it */
  update(dt: number, input: WalkInput, cameraYaw: number, world: CANNON.World): void {
    const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw);
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    // Right of forward (fx, fz) is (-fz, fx)
    let mx = fx * f - fz * r, mz = fz * f + fx * r;
    const len = Math.hypot(mx, mz);
    const target = len > 0 ? (input.jog ? JOG_SPEED : WALK_SPEED) : 0;
    if (len > 0) {
      mx /= len; mz /= len;
      const want = Math.atan2(mx, mz);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-TURN_RATE * dt));
    }
    this._speed += (target - this._speed) * (1 - Math.exp(-ACCEL * dt));
    if (this._speed < 0.01 && target === 0) this._speed = 0;

    if (len > 0 || this._speed > 0) {
      const dirX = len > 0 ? mx : Math.sin(this.yaw), dirZ = len > 0 ? mz : Math.cos(this.yaw);
      const [dx, dz] = resolveWalls(world, this.position.x, this.position.y, this.position.z, dirX * this._speed * dt, dirZ * this._speed * dt, WALKER_PROBE);
      this.position.x += dx;
      this.position.z += dz;
      this.stridePhase += (Math.hypot(dx, dz) / STRIDE) * Math.PI;
    }

    const ground = groundHit(world, this.position.x, this.position.z, this.position.y + STEP_HEIGHT + 0.05)?.y ?? 0;
    if (this.position.y - ground > 0.05) {
      this.verticalVel -= GRAVITY * dt;
      this.position.y = Math.max(ground, this.position.y + this.verticalVel * dt);
    } else {
      this.verticalVel = 0;
      this.position.y = ground;
    }
  }
}
