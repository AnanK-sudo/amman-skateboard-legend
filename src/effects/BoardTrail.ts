import * as THREE from 'three';

// Glowing ribbon trail — cyan head fading to purple tail, additive blending so it blooms
export class BoardTrail {
  private points: { pos: THREE.Vector3; speed: number }[] = [];
  private maxPoints = 60;
  private line: THREE.Line;
  private geometry: THREE.BufferGeometry;
  private colorAttr: THREE.BufferAttribute;
  private posAttr:   THREE.BufferAttribute;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.maxPoints * 3);
    const colors    = new Float32Array(this.maxPoints * 3);
    this.posAttr   = new THREE.BufferAttribute(positions, 3);
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color',    this.colorAttr);
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // additive = HDR glow through bloom
    });

    this.line = new THREE.Line(this.geometry, material);
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  update(position: THREE.Vector3, speed: number): void {
    if (speed < 0.8) {
      this.points = [];
      this.geometry.setDrawRange(0, 0);
      return;
    }

    this.points.push({ pos: position.clone(), speed });
    if (this.points.length > this.maxPoints) this.points.shift();

    const n = this.points.length;
    const speedFactor = Math.min(speed / 12, 1);

    for (let i = 0; i < n; i++) {
      // t=0 oldest (tail), t=1 newest (head)
      const t = i / Math.max(n - 1, 1);
      const alpha = t * t * speedFactor; // quadratic fade toward tail

      // Head: bright cyan (0.0, 1.0, 1.0) → tail: vivid purple (0.7, 0.0, 1.0)
      // Interpolate and scale by alpha so tail fades to black
      const r = (0.0  + t * 0.7)  * alpha;
      const g = (1.0  - t * 1.0)  * alpha;
      const b = (1.0  + t * 0.0)  * alpha;

      this.posAttr.setXYZ(i, this.points[i].pos.x, 0.06, this.points[i].pos.z);
      this.colorAttr.setXYZ(i, r, g, b);
    }

    this.posAttr.needsUpdate   = true;
    this.colorAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
  }
}
