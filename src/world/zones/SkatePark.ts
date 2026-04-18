import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Ramp } from '../objects/Ramp';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';

export class SkatePark implements Zone {
  readonly config: ZoneConfig = {
    id: 'skate_park',
    name: 'Skate Park',
    spawnPoint: new THREE.Vector3(0, 1, 0),
  };

  private meshes: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    // --- Ground plane (60x60) ---
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2d2d4e, roughness: 0.9 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    this.meshes.push(groundMesh);

    const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    this.bodies.push(groundBody);

    // --- Quarter pipes (Ramp) on left and right sides ---
    const leftQuarterPipe = new Ramp(
      {
        position: new THREE.Vector3(-18, 0, 0),
        width: 6,
        height: 3,
        depth: 5,
        rotation: Math.PI / 2,
      },
      world,
    );
    scene.add(leftQuarterPipe.mesh);
    this.meshes.push(leftQuarterPipe.mesh);
    this.bodies.push(leftQuarterPipe.body);

    const rightQuarterPipe = new Ramp(
      {
        position: new THREE.Vector3(18, 0, 0),
        width: 6,
        height: 3,
        depth: 5,
        rotation: -Math.PI / 2,
      },
      world,
    );
    scene.add(rightQuarterPipe.mesh);
    this.meshes.push(rightQuarterPipe.mesh);
    this.bodies.push(rightQuarterPipe.body);

    // --- Rails (center and side) ---
    const centerRail = new Rail(
      {
        position: new THREE.Vector3(0, 0.6, 0),
        length: 8,
        height: 0.6,
        rotation: 0,
      },
      world,
    );
    scene.add(centerRail.mesh);
    this.meshes.push(centerRail.mesh);
    this.bodies.push(centerRail.body);

    const sideRail = new Rail(
      {
        position: new THREE.Vector3(8, 0.5, -5),
        length: 6,
        height: 0.5,
        rotation: Math.PI / 6,
      },
      world,
    );
    scene.add(sideRail.mesh);
    this.meshes.push(sideRail.mesh);
    this.bodies.push(sideRail.body);

    // --- Fun box (Platform) ---
    const funBox = new Platform(
      {
        position: new THREE.Vector3(-6, 0, -8),
        width: 5,
        height: 0.8,
        depth: 5,
      },
      world,
    );
    scene.add(funBox.mesh);
    this.meshes.push(funBox.mesh);
    this.bodies.push(funBox.body);

    // --- Ledge ---
    const ledge = new Ledge(
      {
        position: new THREE.Vector3(5, 0, 8),
        length: 7,
        height: 0.5,
        width: 1.2,
        rotation: 0,
      },
      world,
    );
    scene.add(ledge.mesh);
    this.meshes.push(ledge.mesh);
    this.bodies.push(ledge.body);

    // --- Small launch ramp (Ramp) ---
    const launchRamp = new Ramp(
      {
        position: new THREE.Vector3(-10, 0, 8),
        width: 3,
        height: 1.2,
        depth: 3,
        rotation: 0,
      },
      world,
    );
    scene.add(launchRamp.mesh);
    this.meshes.push(launchRamp.mesh);
    this.bodies.push(launchRamp.body);

    // --- Pyramid (Platform) ---
    const pyramid = new Platform(
      {
        position: new THREE.Vector3(0, 0, -14),
        width: 6,
        height: 1.5,
        depth: 6,
      },
      world,
    );
    scene.add(pyramid.mesh);
    this.meshes.push(pyramid.mesh);
    this.bodies.push(pyramid.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const mesh of this.meshes) {
      scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    this.meshes = [];

    for (const body of this.bodies) {
      world.removeBody(body);
    }
    this.bodies = [];
  }
}
