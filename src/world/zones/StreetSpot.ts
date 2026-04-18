import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Stairs } from '../objects/Stairs';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';

export class StreetSpot implements Zone {
  readonly config: ZoneConfig = {
    id: 'street',
    name: 'Street Spot',
    spawnPoint: new THREE.Vector3(0, 1, 10),
  };

  // Three.js objects
  private groundMesh!: THREE.Mesh;
  private stairs3!: Stairs;
  private stairs5!: Stairs;
  private stairs8!: Stairs;
  private handrail5!: Rail;
  private handrail8!: Rail;
  private longLedge!: Ledge;
  private bench!: Ledge;
  private loadingDock!: Platform;
  private flatRail!: Rail;

  // All physics bodies for cleanup
  private allBodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    this.allBodies = [];

    // --- Ground plane (80x80, concrete color) ---
    const groundGeo = new THREE.BoxGeometry(80, 0.2, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.95 });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.position.set(0, -0.1, 0);
    this.groundMesh.receiveShadow = true;
    scene.add(this.groundMesh);

    const groundShape = new CANNON.Box(new CANNON.Vec3(40, 0.1, 40));
    const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.position.set(0, -0.1, 0);
    world.addBody(groundBody);
    this.allBodies.push(groundBody);

    // --- 3-stair set (left side, facing -Z) ---
    this.stairs3 = new Stairs(
      { position: new THREE.Vector3(-20, 0, -5), steps: 3, stepWidth: 4 },
      world,
    );
    scene.add(this.stairs3.group);
    this.allBodies.push(...this.stairs3.bodies);

    // --- 5-stair set with handrail (center-left) ---
    this.stairs5 = new Stairs(
      { position: new THREE.Vector3(-8, 0, -5), steps: 5, stepWidth: 4 },
      world,
    );
    scene.add(this.stairs5.group);
    this.allBodies.push(...this.stairs5.bodies);

    // Handrail for 5-stair: top of last step
    const stairs5TopY = 0.18 * 5; // STEP_HEIGHT * steps
    const stairs5Depth = 0.28 * 5; // STEP_DEPTH * steps
    this.handrail5 = new Rail(
      {
        position: new THREE.Vector3(-8 + 2.2, stairs5TopY + 0.45, -5 + stairs5Depth / 2),
        length: stairs5Depth * 1.05,
        height: 0.45,
        rotation: Math.PI / 2,
      },
      world,
    );
    scene.add(this.handrail5.mesh);
    this.allBodies.push(this.handrail5.body);

    // --- 8-stair set with handrail (center-right) ---
    this.stairs8 = new Stairs(
      { position: new THREE.Vector3(6, 0, -5), steps: 8, stepWidth: 5 },
      world,
    );
    scene.add(this.stairs8.group);
    this.allBodies.push(...this.stairs8.bodies);

    // Handrail for 8-stair: runs along right side
    const stairs8TopY = 0.18 * 8;
    const stairs8Depth = 0.28 * 8;
    this.handrail8 = new Rail(
      {
        position: new THREE.Vector3(6 + 2.7, stairs8TopY + 0.45, -5 + stairs8Depth / 2),
        length: stairs8Depth * 1.05,
        height: 0.45,
        rotation: Math.PI / 2,
      },
      world,
    );
    scene.add(this.handrail8.mesh);
    this.allBodies.push(this.handrail8.body);

    // --- Long ledge (right side, parallel to Z) ---
    this.longLedge = new Ledge(
      {
        position: new THREE.Vector3(22, 0, 0),
        length: 10,
        height: 0.45,
        width: 0.4,
        rotation: 0,
      },
      world,
    );
    scene.add(this.longLedge.mesh);
    this.allBodies.push(this.longLedge.body);

    // --- Bench / short ledge ---
    this.bench = new Ledge(
      {
        position: new THREE.Vector3(16, 0, 5),
        length: 3,
        height: 0.45,
        width: 0.6,
        rotation: Math.PI / 4,
      },
      world,
    );
    scene.add(this.bench.mesh);
    this.allBodies.push(this.bench.body);

    // --- Loading dock (elevated platform, back area) ---
    this.loadingDock = new Platform(
      {
        position: new THREE.Vector3(-18, 0, -22),
        width: 12,
        height: 1.2,
        depth: 8,
      },
      world,
    );
    scene.add(this.loadingDock.mesh);
    this.allBodies.push(this.loadingDock.body);

    // --- Flat rail (center plaza) ---
    this.flatRail = new Rail(
      {
        position: new THREE.Vector3(0, 0.45, 10),
        length: 8,
        height: 0.45,
        rotation: 0,
      },
      world,
    );
    scene.add(this.flatRail.mesh);
    this.allBodies.push(this.flatRail.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    // Remove Three.js objects
    scene.remove(this.groundMesh);
    scene.remove(this.stairs3.group);
    scene.remove(this.stairs5.group);
    scene.remove(this.stairs8.group);
    scene.remove(this.handrail5.mesh);
    scene.remove(this.handrail8.mesh);
    scene.remove(this.longLedge.mesh);
    scene.remove(this.bench.mesh);
    scene.remove(this.loadingDock.mesh);
    scene.remove(this.flatRail.mesh);

    // Remove all physics bodies
    for (const body of this.allBodies) {
      world.removeBody(body);
    }
    this.allBodies = [];
  }
}
