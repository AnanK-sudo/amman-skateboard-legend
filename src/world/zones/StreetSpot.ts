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

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x3a3a4a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.objects.push(ground);

    // 3-stair
    const stairs3 = new Stairs({ position: new THREE.Vector3(-10, 0, -5), steps: 3, stepWidth: 4 }, world);
    scene.add(stairs3.group); this.objects.push(stairs3.group); this.bodies.push(...stairs3.bodies);

    // 5-stair with handrail
    const stairs5 = new Stairs({ position: new THREE.Vector3(0, 0, -8), steps: 5, stepWidth: 5 }, world);
    scene.add(stairs5.group); this.objects.push(stairs5.group); this.bodies.push(...stairs5.bodies);
    const handrail5 = new Rail({ position: new THREE.Vector3(2, 0.45, -9), length: 3, height: 0.7, rotation: 0.35 }, world);
    scene.add(handrail5.mesh); this.objects.push(handrail5.mesh); this.bodies.push(handrail5.body);

    // 8-stair with handrail
    const stairs8 = new Stairs({ position: new THREE.Vector3(12, 0, -5), steps: 8, stepWidth: 6 }, world);
    scene.add(stairs8.group); this.objects.push(stairs8.group); this.bodies.push(...stairs8.bodies);
    const handrail8 = new Rail({ position: new THREE.Vector3(15, 0.72, -7), length: 4.5, height: 0.8, rotation: 0.3 }, world);
    scene.add(handrail8.mesh); this.objects.push(handrail8.mesh); this.bodies.push(handrail8.body);

    // Long ledge
    const ledge1 = new Ledge({ position: new THREE.Vector3(-8, 0, 8), length: 8, height: 0.4, width: 0.5 }, world);
    scene.add(ledge1.mesh); this.objects.push(ledge1.mesh); this.bodies.push(ledge1.body);

    // Bench
    const bench = new Ledge({ position: new THREE.Vector3(8, 0, 10), length: 2, height: 0.45, width: 0.6 }, world);
    scene.add(bench.mesh); this.objects.push(bench.mesh); this.bodies.push(bench.body);

    // Loading dock
    const dock = new Platform({ position: new THREE.Vector3(-15, 0, -15), width: 6, height: 1.2, depth: 4 }, world);
    scene.add(dock.mesh); this.objects.push(dock.mesh); this.bodies.push(dock.body);

    // Flat rail
    const flatRail = new Rail({ position: new THREE.Vector3(0, 0, 15), length: 7, height: 0.35 }, world);
    scene.add(flatRail.mesh); this.objects.push(flatRail.mesh); this.bodies.push(flatRail.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
  }
}
