import * as THREE from 'three';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private lookOffset = new THREE.Vector3(0, 1.5, 0);
  private smoothSpeed = 5;
  private yaw = 0;
  private pitch = 0.3;
  private distance = 8;
  private minPitch = -0.2;
  private maxPitch = 1.2;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  }

  handleMouseInput(dx: number, dy: number, sensitivity = 0.002): void {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * sensitivity));
  }

  getCameraYaw(): number { return this.yaw; }

  update(delta: number, target: THREE.Vector3): void {
    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    const desired = new THREE.Vector3(target.x + offsetX, target.y + offsetY, target.z + offsetZ);
    this.camera.position.lerp(desired, 1 - Math.exp(-this.smoothSpeed * delta));

    const lookAt = target.clone().add(this.lookOffset);
    this.camera.lookAt(lookAt);
  }
}
