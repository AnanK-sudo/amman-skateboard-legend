import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNeonMaterial } from '@/shaders/GraffitiMaterial';
import { addOutline } from '@/shaders/OutlineShader';

export interface RailConfig {
  position: THREE.Vector3;
  length: number;
  height: number;
  rotation?: number; // Y-axis rotation in radians
}

export class Rail {
  readonly mesh: THREE.Group;
  readonly body: CANNON.Body;
  readonly grindPath: { start: THREE.Vector3; end: THREE.Vector3 };

  constructor(config: RailConfig, world: CANNON.World) {
    const { position, length, height, rotation = 0 } = config;
    const halfLen = length / 2;
    const railRadius = 0.04;
    const postRadius = 0.03;

    // --- Three.js mesh group ---
    this.mesh = new THREE.Group();

    const railMat = createNeonMaterial(0x3fb950, 1.5);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 });

    // Main rail cylinder (along X before rotation)
    const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, length, 8);
    railGeo.rotateZ(Math.PI / 2); // lay along X axis
    const railMesh = new THREE.Mesh(railGeo, railMat);
    railMesh.position.set(0, 0, 0);
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    addOutline(railMesh, 0x000000, 0.02);
    this.mesh.add(railMesh);

    // Two support posts
    const postHeight = height;
    const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 6);
    const postOffsets = [-halfLen * 0.6, halfLen * 0.6];
    for (const xOffset of postOffsets) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(xOffset, -postHeight / 2, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      this.mesh.add(post);
    }

    // Position and rotate the group
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;

    // --- CANNON physics body (thin box along rail axis) ---
    const halfExtents = new CANNON.Vec3(halfLen, railRadius, railRadius);
    const shape = new CANNON.Box(halfExtents);
    this.body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    this.body.addShape(shape);
    this.body.position.set(position.x, position.y, position.z);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
    world.addBody(this.body);

    // --- Grind path endpoints in world space ---
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    this.grindPath = {
      start: new THREE.Vector3(
        position.x - halfLen * cosR,
        position.y + height,
        position.z + halfLen * sinR,
      ),
      end: new THREE.Vector3(
        position.x + halfLen * cosR,
        position.y + height,
        position.z - halfLen * sinR,
      ),
    };

    // Store grindPath on mesh userData so scene traversal can find it
    this.mesh.userData.grindPath = this.grindPath;
  }
}
