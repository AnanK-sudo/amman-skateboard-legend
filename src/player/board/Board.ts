import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import { BOARD_PROBE, findWall, groundHit } from '../physicsRays';

const GRAVITY = 9.82 * 2;
const ROLL_FRICTION = 0.35;     // along the board, wheels down
const SIDE_FRICTION = 6;        // across the board, wheels down: wheels don't slide sideways
const SCRAPE_FRICTION = 3;      // upside down or on its side
const SPIN_DAMPING = 2.5;
const RESTITUTION = 0.4;
const SETTLE_SPEED = 0.05;

/** The board on its own after a bail: slides, bounces off walls, settles */
export class Board {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  /** Heading of the nose, same convention as the skater's yaw */
  yaw = 0;
  yawRate = 0;
  wheelsUp = false;
  settled = false;
  grounded = false;

  get lost(): boolean { return this.position.y < -10; }

  launch(position: THREE.Vector3, velocity: THREE.Vector3, yaw: number, yawRate: number, wheelsUp: boolean): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.yaw = yaw;
    this.yawRate = yawRate;
    this.wheelsUp = wheelsUp;
    this.settled = false;
    this.grounded = false;
  }

  /** Put it down at rest, wheels down (respawn next to the walker) */
  placeAt(position: THREE.Vector3, yaw: number): void {
    this.launch(position, new THREE.Vector3(), yaw, 0, false);
    this.settled = true;
    this.grounded = true;
  }

  update(dt: number, world: CANNON.World): void {
    if (this.settled || this.lost) return;

    // Walls: reflect the horizontal velocity off any face in the way
    const dx = this.velocity.x * dt, dz = this.velocity.z * dt;
    const n = findWall(world, this.position.x, this.position.y, this.position.z, dx, dz, BOARD_PROBE);
    if (n) {
      const into = this.velocity.x * n.x + this.velocity.z * n.z;
      if (into < 0) {
        this.velocity.x -= (1 + RESTITUTION) * into * n.x;
        this.velocity.z -= (1 + RESTITUTION) * into * n.z;
        this.yawRate += into * 0.3;
      }
    }
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.yaw += this.yawRate * dt;

    // Zone floors are planes at y = 0, which cannon's ray test misses away from the origin; the skater uses the same fallback
    const ground = groundHit(world, this.position.x, this.position.z, this.position.y + 0.5)?.y ?? 0;
    this.velocity.y -= GRAVITY * dt;
    this.position.y += this.velocity.y * dt;
    this.grounded = this.position.y <= ground;
    if (this.grounded) {
      this.position.y = ground;
      this.velocity.y = this.velocity.y < -3 ? -this.velocity.y * 0.25 : 0;
      this.applyFriction(dt);
      if (Math.hypot(this.velocity.x, this.velocity.z) < SETTLE_SPEED && this.velocity.y === 0) {
        this.velocity.set(0, 0, 0);
        this.yawRate = 0;
        this.settled = true;
      }
    }
  }

  private applyFriction(dt: number): void {
    this.yawRate *= Math.exp(-SPIN_DAMPING * dt);
    if (this.wheelsUp) {
      const k = Math.exp(-SCRAPE_FRICTION * dt);
      this.velocity.x *= k;
      this.velocity.z *= k;
      return;
    }
    // Wheels down: rolls freely along the nose, grips sideways
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const along = this.velocity.x * fx + this.velocity.z * fz;
    const across = this.velocity.x * fz - this.velocity.z * fx;
    const a = along * Math.exp(-ROLL_FRICTION * dt);
    const c = across * Math.exp(-SIDE_FRICTION * dt);
    this.velocity.x = a * fx + c * fz;
    this.velocity.z = a * fz - c * fx;
  }
}
