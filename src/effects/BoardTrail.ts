import * as THREE from 'three';

export class BoardTrail {
  private points: THREE.Vector3[] = [];
  private maxPoints = 30;
  private line: THREE.Line;
  private geometry: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxPoints * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color: 0xd2a8ff,
      transparent: true,
      opacity: 0.4,
      linewidth: 1,
    });

    this.line = new THREE.Line(this.geometry, material);
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  update(position: THREE.Vector3, speed: number): void {
    if (speed < 1) {
      // Too slow — clear trail
      this.points = [];
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // Add new point
    this.points.push(position.clone());
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    // Update geometry
    const positions = this.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.points.length; i++) {
      positions.setXYZ(i, this.points[i].x, 0.05, this.points[i].z);
    }
    positions.needsUpdate = true;
    this.geometry.setDrawRange(0, this.points.length);

    // Fade opacity based on speed
    (this.line.material as THREE.LineBasicMaterial).opacity = Math.min(speed / 15, 1) * 0.4;
  }
}
