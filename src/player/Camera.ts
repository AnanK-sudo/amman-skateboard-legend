import * as THREE from 'three';

export type CameraMode = 'ride' | 'walk' | 'bail';

const SWOOP_DISTANCE = 3.0;
const SWOOP_SWING    = THREE.MathUtils.degToRad(40);
const SWOOP_PITCH    = 0.12;
// Exponential rates: about 0.35 s in, 0.6 s back out
const SWOOP_IN  = 1 / 0.12;
const SWOOP_OUT = 1 / 0.2;
// Critically damped follow: settles in about 4/omega seconds
const FOLLOW_OMEGA: Record<CameraMode, number> = { ride: 8, walk: 3, bail: 0 };
const WALK_DISTANCE = 3.5;
const LOOK_SENSITIVITY = 0.004;
// Free-look offsets fade at this rate once the button is released (about 1.2 s to settle)
const LOOK_RETURN = 1 / 0.4;

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  // Target is the body centre (0.9 m above the feet); look at hip height so the whole body is framed
  private lookOffset = new THREE.Vector3(0, 0.1, 0);
  private lookSmooth = 8;

  private cameraYaw = 0;
  private yawVelocity = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private looking = false;

  private pitch = 0.2;
  private basePitch = 0.2;
  private baseDistance = 4.2;
  private distance = 4.2;
  // Big-move swoop: 0 chase, 1 fully swung in
  private moment = 0;
  private currentLookTarget = new THREE.Vector3();
  private baseFov = 60;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  }

  /** Hold-to-look (right mouse). The mouse never steers the camera otherwise */
  freeLook(active: boolean, dx: number, dy: number): void {
    this.looking = active;
    if (!active) return;
    this.lookYaw -= dx * LOOK_SENSITIVITY;
    this.lookPitch = Math.max(-0.15, Math.min(0.8, this.lookPitch + dy * LOOK_SENSITIVITY));
  }

  /** Orbit angle: the camera sits at target + (sin, cos) of this times the distance */
  getCameraYaw(): number { return this.cameraYaw + this.lookYaw; }

  /** chestSide: +1 when the rider faces the right of travel (regular), -1 for goofy */
  update(
    delta: number, target: THREE.Vector3, speed = 0, maxSpeed = 15, followYaw = 0,
    moment = false, chestSide = 1, mode: CameraMode = 'ride',
  ): void {
    const speedRatio = mode === 'ride' ? Math.min(speed / maxSpeed, 1) : 0;
    const swoop = mode === 'ride' && moment;
    this.moment += ((swoop ? 1 : 0) - this.moment) * (1 - Math.exp(-(swoop ? SWOOP_IN : SWOOP_OUT) * delta));

    if (!this.looking) {
      const k = Math.exp(-LOOK_RETURN * delta);
      this.lookYaw *= k;
      this.lookPitch *= k;
    }

    // Behind the body (travel is +Z rotated by yaw), swung toward the chest on big moves
    const omega = FOLLOW_OMEGA[mode];
    if (omega > 0) {
      const desired = followYaw + Math.PI + SWOOP_SWING * chestSide * this.moment;
      const diff = Math.atan2(Math.sin(desired - this.cameraYaw), Math.cos(desired - this.cameraYaw));
      this.yawVelocity += (omega * omega * diff - 2 * omega * this.yawVelocity) * delta;
      this.cameraYaw += this.yawVelocity * delta;
    } else {
      this.yawVelocity = 0;
    }

    const pitchTarget = this.basePitch + (SWOOP_PITCH - this.basePitch) * this.moment;
    this.pitch += (pitchTarget - this.pitch) * (1 - Math.exp(-(swoop ? 6 : 2) * delta));

    const chaseDist = mode === 'walk' ? WALK_DISTANCE : this.baseDistance + speedRatio * 1.5;
    const targetDist = chaseDist + (SWOOP_DISTANCE - chaseDist) * this.moment;
    if (mode !== 'bail') this.distance += (targetDist - this.distance) * (1 - Math.exp(-3 * delta));

    const targetFov = this.baseFov + speedRatio * 10;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * delta));
    this.camera.updateProjectionMatrix();

    const yaw = this.cameraYaw + this.lookYaw;
    const pitch = this.pitch + this.lookPitch;
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * this.distance,
      target.y + Math.sin(pitch) * this.distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * this.distance,
    );

    const lookAt = target.clone().add(this.lookOffset);
    this.currentLookTarget.lerp(lookAt, 1 - Math.exp(-this.lookSmooth * delta));
    this.camera.lookAt(this.currentLookTarget);
  }
}
