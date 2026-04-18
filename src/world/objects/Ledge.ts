import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface LedgeConfig {
  position: THREE.Vector3;
  length: number;
  height: number;
  width: number;
  rotation?: number; // Y-axis rotation in radians
}

export class Ledge {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  readonly grindPath: { start: THREE.Vector3; end: THREE.Vector3 };

  constructor(config: LedgeConfig, world: CANNON.World) {
    const { position, length, height, width, rotation = 0 } = config;
    const halfLen = length / 2;

    // --- Three.js box mesh ---
    const geo = new THREE.BoxGeometry(length, height, width);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a5a7a, roughness: 0.7 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    // Mesh origin is center; lift so bottom sits at position.y
    this.mesh.position.y = position.y + height / 2;
    this.mesh.rotation.y = rotation;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // --- CANNON box physics ---
    const halfExtents = new CANNON.Vec3(halfLen, height / 2, width / 2);
    const shape = new CANNON.Box(halfExtents);
    this.body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    this.body.addShape(shape);
    this.body.position.set(position.x, position.y + height / 2, position.z);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
    world.addBody(this.body);

    // --- Grind path along top edge (world space) ---
    const topY = position.y + height;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    this.grindPath = {
      start: new THREE.Vector3(
        position.x - halfLen * cosR,
        topY,
        position.z + halfLen * sinR,
      ),
      end: new THREE.Vector3(
        position.x + halfLen * cosR,
        topY,
        position.z - halfLen * sinR,
      ),
    };
  }
}
