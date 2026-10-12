import * as THREE from 'three';

const SWOOP_DISTANCE = 3.0;
const SWOOP_SWING    = THREE.MathUtils.degToRad(40);
const SWOOP_PITCH    = 0.12;
// Exponential rates: about 0.35 s in, 0.6 s back out
const SWOOP_IN  = 1 / 0.12;
const SWOOP_OUT = 1 / 0.2;

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  // Target is the body centre (0.9 m above the feet); look at hip height so the whole body is framed
  private lookOffset = new THREE.Vector3(0, 0.1, 0);
  private smoothSpeed = 6;
  private lookSmooth = 8;

  // Camera orbit angles — auto-follows skater yaw
  private cameraYaw = 0;      // current camera yaw (smoothed toward target)
  private targetYaw = 0;      // where camera wants to be (behind skater)
  private mouseYawOffset = 0; // temporary offset from mouse look
  private mouseDecayTimer = 0;// timer to snap back after mouse input stops

  private pitch = 0.2;
  private basePitch = 0.2;
  private baseDistance = 4.2;
  private distance = 4.2;
  // Big-move swoop: 0 chase, 1 fully swung in
  private moment = 0;
  private minPitch = 0.05;
  private maxPitch = 1.0;
  private currentLookTarget = new THREE.Vector3();
  private baseFov = 60;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  }

  handleMouseInput(dx: number, dy: number, sensitivity = 0.003): void {
    // Mouse adds temporary offset — decays back to auto-follow
    this.mouseYawOffset -= dx * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * sensitivity));
    this.mouseDecayTimer = 1.5; // 1.5 seconds before camera snaps back
  }

  getCameraYaw(): number { return this.cameraYaw; }

  /** chestSide: +1 when the rider faces the right of travel (regular), -1 for goofy */
  update(delta: number, target: THREE.Vector3, speed = 0, maxSpeed = 15, skaterYaw = 0, moment = false, chestSide = 1): void {
    const speedRatio = Math.min(speed / maxSpeed, 1);
    this.moment += ((moment ? 1 : 0) - this.moment) * (1 - Math.exp(-(moment ? SWOOP_IN : SWOOP_OUT) * delta));

    // Auto-follow: behind the skater (travel is +Z rotated by yaw), swung toward the chest on big moves
    this.targetYaw = skaterYaw + Math.PI + SWOOP_SWING * chestSide * this.moment;

    // Decay mouse offset over time
    if (this.mouseDecayTimer > 0) {
      this.mouseDecayTimer -= delta;
    } else {
      // Smoothly decay mouse offset back to zero
      this.mouseYawOffset *= (1 - 3 * delta);
      if (Math.abs(this.mouseYawOffset) < 0.01) this.mouseYawOffset = 0;
      // Also ease pitch back to default
      const pitchTarget = this.basePitch + (SWOOP_PITCH - this.basePitch) * this.moment;
      this.pitch += (pitchTarget - this.pitch) * (moment ? 6 : 2) * delta;
    }

    // Smooth camera yaw toward target + mouse offset
    let desiredYaw = this.targetYaw + this.mouseYawOffset;

    // Normalize angle difference for shortest path rotation
    let diff = desiredYaw - this.cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Faster follow when moving, slower when idle
    const followRate = speed > 0.5 ? 4 : 2;
    this.cameraYaw += diff * (1 - Math.exp(-followRate * delta));

    // Distance: pull back at speed
    const chaseDist  = this.baseDistance + speedRatio * 1.5;
    const targetDist = chaseDist + (SWOOP_DISTANCE - chaseDist) * this.moment;
    this.distance += (targetDist - this.distance) * (1 - Math.exp(-3 * delta));

    // FOV: widen at speed
    const targetFov = this.baseFov + speedRatio * 10;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * delta));
    this.camera.updateProjectionMatrix();

    // Camera position from orbit angles
    const offsetX = Math.sin(this.cameraYaw) * Math.cos(this.pitch) * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;
    const offsetZ = Math.cos(this.cameraYaw) * Math.cos(this.pitch) * this.distance;

    const desired = new THREE.Vector3(target.x + offsetX, target.y + offsetY, target.z + offsetZ);
    this.camera.position.lerp(desired, 1 - Math.exp(-this.smoothSpeed * delta));

    // Smooth look target
    const lookAt = target.clone().add(this.lookOffset);
    this.currentLookTarget.lerp(lookAt, 1 - Math.exp(-this.lookSmooth * delta));
    this.camera.lookAt(this.currentLookTarget);
  }
}
