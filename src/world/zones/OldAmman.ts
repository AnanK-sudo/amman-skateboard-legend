import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { OsmLoader } from '../osm/OsmLoader';
import { Stairs } from '../objects/Stairs';
import { Rail } from '../objects/Rail';
import { Ledge } from '../objects/Ledge';

const ZONE_CENTER: [number, number] = [35.9285, 31.9545];

export class OldAmman implements Zone {
  readonly config: ZoneConfig = {
    id: 'old_amman',
    name: 'Old Amman',
    spawnPoint: new THREE.Vector3(0, 1, 0),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    // Ground plane — Amman stone color
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d3528, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.objects.push(ground);

    const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    this.bodies.push(groundBody);

    // Ambient + directional light
    const ambient = new THREE.AmbientLight(0xffeedd, 0.6);
    scene.add(ambient);
    this.objects.push(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff0cc, 1.2);
    dirLight.position.set(30, 60, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);
    this.objects.push(dirLight);

    // Hand-placed skate objects

    // Stair set 1 — left side
    const stairs1 = new Stairs(
      { position: new THREE.Vector3(-15, 0, -10), steps: 5, stepWidth: 3, rotation: 0 },
      world,
    );
    scene.add(stairs1.group);
    this.objects.push(stairs1.group);
    this.bodies.push(...stairs1.bodies);

    // Stair set 2 — right side
    const stairs2 = new Stairs(
      { position: new THREE.Vector3(15, 0, 5), steps: 4, stepWidth: 3, rotation: Math.PI },
      world,
    );
    scene.add(stairs2.group);
    this.objects.push(stairs2.group);
    this.bodies.push(...stairs2.bodies);

    // Rail 1 — along the stairs1
    const rail1 = new Rail(
      { position: new THREE.Vector3(-15, 0.9, -10), length: 4, height: 0.9, rotation: 0 },
      world,
    );
    scene.add(rail1.mesh);
    this.objects.push(rail1.mesh);
    this.bodies.push(rail1.body);

    // Rail 2 — diagonal near center
    const rail2 = new Rail(
      {
        position: new THREE.Vector3(5, 0.6, -5),
        length: 5,
        height: 0.6,
        rotation: Math.PI / 6,
      },
      world,
    );
    scene.add(rail2.mesh);
    this.objects.push(rail2.mesh);
    this.bodies.push(rail2.body);

    // Ledge — center plaza
    const ledge = new Ledge(
      {
        position: new THREE.Vector3(0, 0, 10),
        length: 8,
        height: 0.5,
        width: 1.2,
        rotation: 0,
      },
      world,
    );
    scene.add(ledge.mesh);
    this.objects.push(ledge.mesh);
    this.bodies.push(ledge.body);

    // Load OSM data async — adds street geometry when available
    this._loadOsmAsync(scene);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) {
      scene.remove(obj);
    }
    for (const body of this.bodies) {
      world.removeBody(body);
    }
    this.objects = [];
    this.bodies = [];
  }

  private async _loadOsmAsync(scene: THREE.Scene): Promise<void> {
    try {
      const response = await fetch('/data/old-amman.geojson');
      if (!response.ok) return;
      const geojson = (await response.json()) as GeoJSON.FeatureCollection;
      const loader = new OsmLoader({ center: ZONE_CENTER });
      const meshes = loader.parse(geojson);
      for (const mesh of meshes) {
        scene.add(mesh);
        this.objects.push(mesh);
      }
    } catch {
      // OSM data unavailable — zone still works with hand-placed objects
    }
  }
}
