import * as THREE from 'three';

export class CameraShake {
  private intensity = 0;
  private decay = 8;
  private offset = new THREE.Vector3();

  trigger(amount: number) {
    this.intensity = Math.max(this.intensity, amount);
  }

  update(delta: number): THREE.Vector3 {
    if (this.intensity > 0.001) {
      this.offset.set(
        (Math.random() - 0.5) * this.intensity,
        (Math.random() - 0.5) * this.intensity * 0.5,
        (Math.random() - 0.5) * this.intensity
      );
      this.intensity *= Math.exp(-this.decay * delta);
    } else {
      this.offset.set(0, 0, 0);
      this.intensity = 0;
    }
    return this.offset;
  }
}
