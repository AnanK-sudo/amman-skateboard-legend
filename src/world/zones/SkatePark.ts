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

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x2d2d4e })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.objects.push(ground);

    // Quarter pipe left
    const qp1 = new Ramp({ position: new THREE.Vector3(-15, 0, 0), width: 10, height: 3, depth: 4, rotation: Math.PI / 2 }, world);
    scene.add(qp1.mesh);
    this.objects.push(qp1.mesh);
    this.bodies.push(qp1.body);

    // Quarter pipe right
    const qp2 = new Ramp({ position: new THREE.Vector3(15, 0, 0), width: 10, height: 3, depth: 4, rotation: -Math.PI / 2 }, world);
    scene.add(qp2.mesh);
    this.objects.push(qp2.mesh);
    this.bodies.push(qp2.body);

    // Center rail
    const rail1 = new Rail({ position: new THREE.Vector3(0, 0, -5), length: 6, height: 0.6 }, world);
    scene.add(rail1.mesh);
    this.objects.push(rail1.mesh);
    this.bodies.push(rail1.body);

    // Side rail
    const rail2 = new Rail({ position: new THREE.Vector3(8, 0, 5), length: 5, height: 0.5, rotation: Math.PI / 4 }, world);
    scene.add(rail2.mesh);
    this.objects.push(rail2.mesh);
    this.bodies.push(rail2.body);

    // Fun box
    const funbox = new Platform({ position: new THREE.Vector3(0, 0, 8), width: 4, height: 0.6, depth: 3 }, world);
    scene.add(funbox.mesh);
    this.objects.push(funbox.mesh);
    this.bodies.push(funbox.body);

    // Ledge
    const ledge = new Ledge({ position: new THREE.Vector3(-6, 0, -10), length: 5, height: 0.45, width: 0.6 }, world);
    scene.add(ledge.mesh);
    this.objects.push(ledge.mesh);
    this.bodies.push(ledge.body);

    // Launch ramp
    const launch = new Ramp({ position: new THREE.Vector3(6, 0, -12), width: 3, height: 1.5, depth: 2.5 }, world);
    scene.add(launch.mesh);
    this.objects.push(launch.mesh);
    this.bodies.push(launch.body);

    // Pyramid
    const pyramid = new Platform({ position: new THREE.Vector3(-8, 0, 8), width: 3, height: 0.8, depth: 3 }, world);
    scene.add(pyramid.mesh);
    this.objects.push(pyramid.mesh);
    this.bodies.push(pyramid.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
  }
}
