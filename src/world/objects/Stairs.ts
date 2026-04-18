import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface StairsConfig {
  position: THREE.Vector3;
  steps: number;
  stepWidth: number;
  rotation?: number; // Y-axis rotation in radians
}

const STEP_HEIGHT = 0.18;
const STEP_DEPTH = 0.28;

export class Stairs {
  readonly group: THREE.Group;
  readonly bodies: CANNON.Body[];

  constructor(config: StairsConfig, world: CANNON.World) {
    const { position, steps, stepWidth, rotation = 0 } = config;

    this.group = new THREE.Group();
    this.bodies = [];

    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.9 });

    for (let i = 0; i < steps; i++) {
      // Each step is a box that accumulates in depth and height
      const stepW = stepWidth;
      const stepH = STEP_HEIGHT * (i + 1); // cumulative height slab
      const stepD = STEP_DEPTH;

      const geo = new THREE.BoxGeometry(stepW, stepH, stepD);
      const mesh = new THREE.Mesh(geo, mat);

      // Position: step i sits at depth offset i * STEP_DEPTH, vertically centered at stepH/2
      const localX = 0;
      const localY = stepH / 2;
      const localZ = i * STEP_DEPTH + STEP_DEPTH / 2;

      mesh.position.set(localX, localY, localZ);
      this.group.add(mesh);

      // Physics body for each step
      const halfExtents = new CANNON.Vec3(stepW / 2, stepH / 2, stepD / 2);
      const shape = new CANNON.Box(halfExtents);
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
      body.addShape(shape);

      // Convert local position to world space accounting for group rotation
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      const worldX = position.x + localX * cosR - localZ * sinR;
      const worldY = position.y + localY;
      const worldZ = position.z + localX * sinR + localZ * cosR;

      body.position.set(worldX, worldY, worldZ);
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
      world.addBody(body);
      this.bodies.push(body);
    }

    this.group.position.copy(position);
    this.group.rotation.y = rotation;
  }
}
