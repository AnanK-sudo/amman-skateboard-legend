import * as THREE from 'three';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private lookOffset = new THREE.Vector3(0, 1.5, 0);
  private smoothSpeed = 6;
  private lookSmooth = 8;
  private yaw = 0;
  private pitch = 0.3;
  private baseDistance = 6;
  private distance = 6;
  private minPitch = -0.2;
  private maxPitch = 1.2;
  private currentLookTarget = new THREE.Vector3();
  private baseFov = 60;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  }

  handleMouseInput(dx: number, dy: number, sensitivity = 0.002): void {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * sensitivity));
  }

  getCameraYaw(): number { return this.yaw; }

  update(delta: number, target: THREE.Vector3, speed = 0, maxSpeed = 15): void {
    const speedRatio = Math.min(speed / maxSpeed, 1);

    // Pull camera back at speed, push closer when slow
    const targetDist = this.baseDistance + speedRatio * 3;
    this.distance += (targetDist - this.distance) * (1 - Math.exp(-3 * delta));

    // Slight FOV increase at speed for sense of velocity
    const targetFov = this.baseFov + speedRatio * 10;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * delta));
    this.camera.updateProjectionMatrix();

    // Camera position
    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    const desired = new THREE.Vector3(target.x + offsetX, target.y + offsetY, target.z + offsetZ);
    this.camera.position.lerp(desired, 1 - Math.exp(-this.smoothSpeed * delta));

    // Smooth look target (prevents jittery camera)
    const lookAt = target.clone().add(this.lookOffset);
    this.currentLookTarget.lerp(lookAt, 1 - Math.exp(-this.lookSmooth * delta));
    this.camera.lookAt(this.currentLookTarget);
  }
}
