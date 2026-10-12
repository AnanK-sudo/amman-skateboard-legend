import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import type { Skater } from './Skater';
import type { Board } from './board/Board';
import type { Walker, WalkInput } from './Walker';
import type { BailReason } from './LandingJudge';
import { groundBelow } from './physicsRays';

export type Mode = 'riding' | 'bailing' | 'walking' | 'mounting';

export interface ModeInput {
  walk: WalkInput;
  /** E pressed this frame */
  mount: boolean;
}

const BAIL_TIME = 1.6;
const MOUNT_TIME = 0.5;
const MOUNT_RADIUS = 1.2;
const RESPAWN_DELAY = 3;
const OUT_OF_REACH = 1.5;
const SLIDE_FRICTION = 3;

/** Who drives the body: the skater, the bail fall, the walker, or the hop back on */
export class RiderMode {
  private _mode: Mode = 'riding';
  private timer = 0;
  private _bailReason: BailReason | null = null;
  /** Rider feet and heading while not riding */
  readonly riderFeet = new THREE.Vector3();
  riderYaw = 0;
  private riderVel = new THREE.Vector3();
  private respawnTimer = 0;
  private mountYaw = 0;
  private mountFrom = new THREE.Vector3();

  constructor(
    private readonly skater: Skater,
    readonly board: Board,
    readonly walker: Walker,
    private readonly random: () => number = Math.random,
  ) {}

  get mode(): Mode { return this._mode; }
  get bailReason(): BailReason | null { return this._bailReason; }
  get bailProgress(): number { return this._mode === 'bailing' ? Math.min(this.timer / BAIL_TIME, 1) : 0; }
  get mountProgress(): number { return this._mode === 'mounting' ? Math.min(this.timer / MOUNT_TIME, 1) : 0; }
  get canMount(): boolean {
    if (this._mode !== 'walking') return false;
    const d = Math.hypot(this.board.position.x - this.walker.position.x, this.board.position.z - this.walker.position.z);
    const slow = Math.hypot(this.board.velocity.x, this.board.velocity.z) < 0.3;
    return d <= MOUNT_RADIUS && slow && Math.abs(this.board.position.y - this.walker.position.y) < 0.5;
  }

  bail(reason: BailReason): void {
    if (this._mode !== 'riding') return;
    const feet = this.skater.position.clone();
    feet.y -= 0.9;
    const speed = this.skater.speed;
    const yaw = this.skater.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const side = (this.random() - 0.5) * 4;
    const spinSign = this.random() < 0.5 ? -1 : 1;

    this.riderFeet.copy(feet);
    this.riderYaw = yaw;
    this.riderVel.set(fx * speed * 0.5, 0, fz * speed * 0.5);
    this.board.launch(
      feet,
      new THREE.Vector3(fx * speed * 1.1 + fz * side, Math.min(speed * 0.25, 2.5), fz * speed * 1.1 - fx * side),
      yaw + this.skater.spinAngle,
      spinSign * (2 + this.random() * 4),
      this.random() < 0.3,
    );
    this.skater.clearHeld();
    this._bailReason = reason;
    this.enter('bailing');
  }

  resetToSpawn(feet: { x: number; y: number; z: number }, yaw: number): void {
    this.skater.reset(feet, yaw);
    this._bailReason = null;
    this.enter('riding');
  }

  update(dt: number, input: ModeInput, cameraYaw: number, world: CANNON.World): void {
    this.timer += dt;
    switch (this._mode) {
      case 'riding':
        return;

      case 'bailing': {
        this.board.update(dt, world);
        this.riderFeet.addScaledVector(this.riderVel, dt);
        this.riderVel.multiplyScalar(Math.exp(-SLIDE_FRICTION * dt));
        this.riderFeet.y = groundBelow(world, this.riderFeet.x, this.riderFeet.z, this.riderFeet.y + 0.5) ?? 0;
        if (this.timer >= BAIL_TIME) {
          this.walker.place(this.riderFeet, this.riderYaw);
          this.enter('walking');
        }
        return;
      }

      case 'walking': {
        this.walker.update(dt, input.walk, cameraYaw, world);
        this.board.update(dt, world);
        const unreachable = this.board.lost || (this.board.settled && this.board.position.y - this.walker.position.y > OUT_OF_REACH);
        this.respawnTimer = unreachable ? this.respawnTimer + dt : 0;
        if (this.respawnTimer >= RESPAWN_DELAY) {
          const ahead = new THREE.Vector3(Math.sin(this.walker.yaw), 0, Math.cos(this.walker.yaw)).multiplyScalar(0.8);
          this.board.placeAt(this.walker.position.clone().add(ahead), this.walker.yaw);
          this.respawnTimer = 0;
        }
        if (input.mount && this.canMount) {
          // Ride off from whichever end of the board is closer to the way the walker faces
          const d = Math.atan2(Math.sin(this.walker.yaw - this.board.yaw), Math.cos(this.walker.yaw - this.board.yaw));
          this.mountYaw = Math.abs(d) <= Math.PI / 2 ? this.board.yaw : this.board.yaw + Math.PI;
          this.mountFrom.copy(this.walker.position);
          this.enter('mounting');
        }
        return;
      }

      case 'mounting':
        if (this.timer >= MOUNT_TIME) {
          this.board.wheelsUp = false;
          this.skater.reset(this.board.position, this.mountYaw);
          this.enter('riding');
        }
        return;
    }
  }

  /** Feet and heading of the body for the model while not riding */
  pose(): { feet: THREE.Vector3; yaw: number } {
    switch (this._mode) {
      case 'bailing': return { feet: this.riderFeet, yaw: this.riderYaw };
      case 'walking': return { feet: this.walker.position, yaw: this.walker.yaw };
      case 'mounting': {
        const t = this.mountProgress;
        return { feet: this.mountFrom.clone().lerp(this.board.position, t), yaw: this.walker.yaw + angleDiff(this.walker.yaw, this.mountYaw) * t };
      }
      default: {
        const p = this.skater.position;
        return { feet: new THREE.Vector3(p.x, p.y - 0.9, p.z), yaw: this.skater.yaw };
      }
    }
  }

  private enter(mode: Mode): void {
    this._mode = mode;
    this.timer = 0;
  }
}

function angleDiff(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
