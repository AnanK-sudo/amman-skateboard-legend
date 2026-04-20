import * as THREE from 'three';

export class BoardTrail {
  private points: THREE.Vector3[] = [];
  private maxPoints = 30;
  private line: THREE.Line;
  private geometry: THREE.BufferGeometry;
  private colorAttr: THREE.BufferAttribute;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.maxPoints * 3);
    const colors = new Float32Array(this.maxPoints * 3); // RGB per vertex
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    this.geometry.setAttribute('color', this.colorAttr);
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.18,   // overall cap — keeps the whole trail subtle
      depthWrite: false,
    });

    this.line = new THREE.Line(this.geometry, material);
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  update(position: THREE.Vector3, speed: number): void {
    if (speed < 1) {
      this.points = [];
      this.geometry.setDrawRange(0, 0);
      return;
    }

    this.points.push(position.clone());
    if (this.points.length > this.maxPoints) this.points.shift();

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const n = this.points.length;

    // Base brightness driven by speed (0 → 0, maxSpeed → 1)
    const speedFactor = Math.min(speed / 15, 1);

    for (let i = 0; i < n; i++) {
      posAttr.setXYZ(i, this.points[i].x, 0.05, this.points[i].z);

      // t=0 tail (oldest), t=1 head (newest) — fade toward tail
      const t = i / (n - 1 || 1);
      const brightness = t * t * speedFactor; // quadratic fade, dimmer overall

      // Purple-ish trail color: rgb(210, 168, 255) → scale by brightness
      this.colorAttr.setXYZ(i, 0.82 * brightness, 0.66 * brightness, brightness);
    }

    posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
  }
}
