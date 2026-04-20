import * as THREE from 'three';

export class SparkSystem {
  private coreParticles: THREE.Points;
  private outerParticles: THREE.Points;

  private corePos: Float32Array;
  private coreVel: Float32Array;
  private coreLt:  Float32Array;
  private coreCol: Float32Array;
  private coreCount = 60;
  private coreIdx   = 0;

  private outerPos: Float32Array;
  private outerVel: Float32Array;
  private outerLt:  Float32Array;
  private outerCol: Float32Array;
  private outerCount = 140;
  private outerIdx   = 0;

  constructor(scene: THREE.Scene) {
    this.corePos = new Float32Array(this.coreCount * 3);
    this.coreVel = new Float32Array(this.coreCount * 3);
    this.coreLt  = new Float32Array(this.coreCount);
    this.coreCol = new Float32Array(this.coreCount * 3);

    this.outerPos = new Float32Array(this.outerCount * 3);
    this.outerVel = new Float32Array(this.outerCount * 3);
    this.outerLt  = new Float32Array(this.outerCount);
    this.outerCol = new Float32Array(this.outerCount * 3);

    for (let i = 0; i < this.coreCount;  i++) this.corePos[i * 3 + 1]  = -100;
    for (let i = 0; i < this.outerCount; i++) this.outerPos[i * 3 + 1] = -100;

    // White-hot core — larger, brighter, short-lived
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(this.corePos, 3));
    coreGeo.setAttribute('color',    new THREE.BufferAttribute(this.coreCol, 3));
    this.coreParticles = new THREE.Points(coreGeo, new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, transparent: true, opacity: 1.0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(this.coreParticles);

    // Orange/yellow outer spray
    const outerGeo = new THREE.BufferGeometry();
    outerGeo.setAttribute('position', new THREE.BufferAttribute(this.outerPos, 3));
    outerGeo.setAttribute('color',    new THREE.BufferAttribute(this.outerCol, 3));
    this.outerParticles = new THREE.Points(outerGeo, new THREE.PointsMaterial({
      size: 0.07, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(this.outerParticles);
  }

  emit(x: number, y: number, z: number, count = 8) {
    // White-hot core sparks (tight cluster, very bright)
    const coreEmit = Math.max(1, Math.floor(count * 0.4));
    for (let i = 0; i < coreEmit; i++) {
      const idx = (this.coreIdx % this.coreCount);
      const i3  = idx * 3;
      this.corePos[i3]     = x + (Math.random() - 0.5) * 0.15;
      this.corePos[i3 + 1] = y + Math.random() * 0.15;
      this.corePos[i3 + 2] = z + (Math.random() - 0.5) * 0.15;
      this.coreVel[i3]     = (Math.random() - 0.5) * 2.5;
      this.coreVel[i3 + 1] = Math.random() * 2.5 + 1.0;
      this.coreVel[i3 + 2] = (Math.random() - 0.5) * 2.5;
      // Near-white, slightly warm — will bloom heavily
      this.coreCol[i3]     = 1.0;
      this.coreCol[i3 + 1] = 0.95;
      this.coreCol[i3 + 2] = 0.80;
      this.coreLt[idx] = 0.2 + Math.random() * 0.15;
      this.coreIdx++;
    }

    // Orange/yellow outer spray
    const outerEmit = count - coreEmit;
    for (let i = 0; i < outerEmit; i++) {
      const idx = (this.outerIdx % this.outerCount);
      const i3  = idx * 3;
      this.outerPos[i3]     = x + (Math.random() - 0.5) * 0.4;
      this.outerPos[i3 + 1] = y + Math.random() * 0.25;
      this.outerPos[i3 + 2] = z + (Math.random() - 0.5) * 0.4;
      this.outerVel[i3]     = (Math.random() - 0.5) * 5.5;
      this.outerVel[i3 + 1] = Math.random() * 4.0 + 0.5;
      this.outerVel[i3 + 2] = (Math.random() - 0.5) * 5.5;
      this.outerCol[i3]     = 1.0;
      this.outerCol[i3 + 1] = 0.45 + Math.random() * 0.45;
      this.outerCol[i3 + 2] = Math.random() * 0.1;
      this.outerLt[idx] = 0.4 + Math.random() * 0.35;
      this.outerIdx++;
    }
  }

  update(delta: number) {
    for (let i = 0; i < this.coreCount; i++) {
      if (this.coreLt[i] <= 0) continue;
      const i3 = i * 3;
      this.corePos[i3]     += this.coreVel[i3]     * delta;
      this.corePos[i3 + 1] += this.coreVel[i3 + 1] * delta;
      this.corePos[i3 + 2] += this.coreVel[i3 + 2] * delta;
      this.coreVel[i3 + 1] -= 10 * delta;
      this.coreLt[i] -= delta;
      const f = Math.max(0, this.coreLt[i] * 6);
      this.coreCol[i3]     = Math.min(1, f);
      this.coreCol[i3 + 1] = Math.min(1, f * 0.95);
      this.coreCol[i3 + 2] = Math.min(1, f * 0.7);
      if (this.coreLt[i] <= 0) this.corePos[i3 + 1] = -100;
    }
    for (let i = 0; i < this.outerCount; i++) {
      if (this.outerLt[i] <= 0) continue;
      const i3 = i * 3;
      this.outerPos[i3]     += this.outerVel[i3]     * delta;
      this.outerPos[i3 + 1] += this.outerVel[i3 + 1] * delta;
      this.outerPos[i3 + 2] += this.outerVel[i3 + 2] * delta;
      this.outerVel[i3 + 1] -= 14 * delta;
      this.outerLt[i] -= delta;
      const f = Math.max(0, this.outerLt[i] * 2.5);
      this.outerCol[i3]     = Math.min(1, f);
      this.outerCol[i3 + 1] = Math.min(1, f * 0.55);
      this.outerCol[i3 + 2] = 0;
      if (this.outerLt[i] <= 0) this.outerPos[i3 + 1] = -100;
    }
    this.coreParticles.geometry.attributes.position.needsUpdate = true;
    this.coreParticles.geometry.attributes.color.needsUpdate    = true;
    this.outerParticles.geometry.attributes.position.needsUpdate = true;
    this.outerParticles.geometry.attributes.color.needsUpdate    = true;
  }
}
