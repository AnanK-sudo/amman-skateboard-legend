import * as THREE from 'three';

export class SparkSystem {
  private particles: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private colors: Float32Array;
  private count = 80;
  private index = 0;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.lifetimes = new Float32Array(this.count);
    this.colors = new Float32Array(this.count * 3);

    // Hide all particles initially
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3 + 1] = -100;
      this.lifetimes[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geo, mat);
    scene.add(this.particles);
  }

  emit(x: number, y: number, z: number, count = 8) {
    for (let i = 0; i < count; i++) {
      const idx = (this.index % this.count);
      const i3 = idx * 3;

      this.positions[i3] = x + (Math.random() - 0.5) * 0.3;
      this.positions[i3 + 1] = y + Math.random() * 0.2;
      this.positions[i3 + 2] = z + (Math.random() - 0.5) * 0.3;

      this.velocities[i3] = (Math.random() - 0.5) * 4;
      this.velocities[i3 + 1] = Math.random() * 3 + 1;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 4;

      // Orange/yellow sparks
      this.colors[i3] = 1.0;
      this.colors[i3 + 1] = 0.5 + Math.random() * 0.5;
      this.colors[i3 + 2] = Math.random() * 0.3;

      this.lifetimes[idx] = 0.5 + Math.random() * 0.3;
      this.index++;
    }
  }

  update(delta: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.lifetimes[i] <= 0) continue;

      const i3 = i * 3;
      this.positions[i3] += this.velocities[i3] * delta;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;

      this.velocities[i3 + 1] -= 12 * delta; // gravity

      this.lifetimes[i] -= delta;

      // Fade color
      const fade = Math.max(0, this.lifetimes[i] * 2);
      this.colors[i3] = fade;
      this.colors[i3 + 1] = fade * 0.6;
      this.colors[i3 + 2] = fade * 0.1;

      if (this.lifetimes[i] <= 0) {
        this.positions[i3 + 1] = -100;
      }
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }
}
