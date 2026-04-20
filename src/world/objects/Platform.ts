import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createConcreteMaterial } from '@/shaders/GraffitiMaterial';

export interface PlatformConfig {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
}

export class Platform {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;

  constructor(config: PlatformConfig, world: CANNON.World) {
    const { position, width, height, depth } = config;

    // --- Three.js box mesh ---
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = createConcreteMaterial(0xb0a898);
    this.mesh = new THREE.Mesh(geo, mat);
    // Center mesh vertically so bottom is at position.y
    this.mesh.position.set(position.x, position.y + height / 2, position.z);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    // --- CANNON box physics ---
    const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2);
    const shape = new CANNON.Box(halfExtents);
    this.body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    this.body.addShape(shape);
    this.body.position.set(position.x, position.y + height / 2, position.z);
    world.addBody(this.body);
  }
}
