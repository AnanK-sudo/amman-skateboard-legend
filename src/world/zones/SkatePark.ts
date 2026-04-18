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
    spawnPoint: new THREE.Vector3(0, 1, 8),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  private addMesh(scene: THREE.Scene, mesh: THREE.Object3D) {
    scene.add(mesh);
    this.objects.push(mesh);
  }

  private addBody(world: CANNON.World, body: CANNON.Body) {
    world.addBody(body);
    this.bodies.push(body);
  }

  private createHill(
    scene: THREE.Scene, world: CANNON.World,
    x: number, z: number,
    width: number, depth: number, height: number,
    color = 0x2a2a48
  ) {
    // Visual — smooth hill using a box with tapered top
    const geo = new THREE.BoxGeometry(width, height, depth);
    // Taper the top vertices inward for a rounded feel
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const py = positions.getY(i);
      if (py > 0) {
        // Shrink top face slightly
        positions.setX(i, positions.getX(i) * 0.7);
        positions.setZ(i, positions.getZ(i) * 0.7);
      }
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, height / 2, z);
    this.addMesh(scene, mesh);

    // Physics — box for collision/raycast
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
      position: new CANNON.Vec3(x, height / 2, z),
    });
    this.addBody(world, body);
  }

  private createBank(
    scene: THREE.Scene, world: CANNON.World,
    x: number, z: number,
    width: number, height: number, depth: number,
    rotation = 0, color = 0x2d2d50
  ) {
    // A sloped bank/transition — wedge shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(0, height);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(-depth / 2, 0, -width / 2);

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotation;
    this.addMesh(scene, mesh);

    // Physics — trimesh
    const vertices = Array.from(new Float32Array(geo.attributes.position.array));
    const indices = geo.index ? Array.from(geo.index.array) : [];
    const trimesh = new CANNON.Trimesh(vertices, indices);
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: trimesh,
      position: new CANNON.Vec3(x, 0, z),
    });
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
    this.addBody(world, body);
  }

  load(scene: THREE.Scene, world: CANNON.World): void {
    // === GROUND ===
    // Main ground — large flat area
    const groundGeo = new THREE.PlaneGeometry(80, 80, 20, 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d2d4e,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.addMesh(scene, ground);

    // Ground physics (flat infinite plane)
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.addBody(world, groundBody);

    // === ELEVATED PLATFORM AREA (north side) ===
    // Raised platform you skate up to via banks
    const platHeight = 1.5;
    const plat = new Platform({
      position: new THREE.Vector3(0, 0, -18),
      width: 20, height: platHeight, depth: 10,
    }, world);
    this.addMesh(scene, plat.mesh);
    this.bodies.push(plat.body);

    // Bank leading up to the platform (south face)
    this.createBank(scene, world, 0, -12.5, 12, platHeight, 3, 0, 0x33335a);

    // Rails on top of the elevated platform
    const topRail = new Rail({
      position: new THREE.Vector3(0, platHeight, -18),
      length: 8, height: 0.5,
    }, world);
    this.addMesh(scene, topRail.mesh);
    this.bodies.push(topRail.body);

    // Ledge on platform edge
    const platLedge = new Ledge({
      position: new THREE.Vector3(-6, platHeight, -14),
      length: 6, height: 0.4, width: 0.5,
    }, world);
    this.addMesh(scene, platLedge.mesh);
    this.bodies.push(platLedge.body);

    // === BOWL AREA (west side) ===
    // Simulated bowl with stepped circular walls
    const bowlCenter = new THREE.Vector3(-18, 0, 0);
    const bowlRadius = 6;
    const bowlDepth = 2;
    const bowlSegments = 16;

    // Bowl floor (lowered)
    const bowlFloor = new THREE.Mesh(
      new THREE.CircleGeometry(bowlRadius - 0.5, bowlSegments),
      new THREE.MeshStandardMaterial({ color: 0x252545 })
    );
    bowlFloor.rotation.x = -Math.PI / 2;
    bowlFloor.position.set(bowlCenter.x, -bowlDepth + 0.01, bowlCenter.z);
    this.addMesh(scene, bowlFloor);

    // Bowl floor physics
    const bowlFloorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(bowlRadius, 0.1, bowlRadius)),
      position: new CANNON.Vec3(bowlCenter.x, -bowlDepth, bowlCenter.z),
    });
    this.addBody(world, bowlFloorBody);

    // Bowl walls — ring of angled panels
    for (let i = 0; i < bowlSegments; i++) {
      const angle = (i / bowlSegments) * Math.PI * 2;
      const nextAngle = ((i + 1) / bowlSegments) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;

      const wallWidth = 2 * bowlRadius * Math.sin(Math.PI / bowlSegments);
      const wallX = bowlCenter.x + Math.cos(midAngle) * (bowlRadius - 0.2);
      const wallZ = bowlCenter.z + Math.sin(midAngle) * (bowlRadius - 0.2);

      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wallWidth, bowlDepth + 0.5, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2a2a4c })
      );
      wallMesh.position.set(wallX, -bowlDepth / 2 + 0.25, wallZ);
      wallMesh.rotation.y = -midAngle + Math.PI / 2;
      this.addMesh(scene, wallMesh);

      const wallBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(wallWidth / 2, (bowlDepth + 0.5) / 2, 0.2)),
        position: new CANNON.Vec3(wallX, -bowlDepth / 2 + 0.25, wallZ),
      });
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -midAngle + Math.PI / 2);
      this.addBody(world, wallBody);
    }

    // === QUARTER PIPES (east side) ===
    const qp1 = new Ramp({
      position: new THREE.Vector3(18, 0, -5),
      width: 8, height: 2.5, depth: 3.5,
      rotation: -Math.PI / 2,
    }, world);
    this.addMesh(scene, qp1.mesh);
    this.bodies.push(qp1.body);

    const qp2 = new Ramp({
      position: new THREE.Vector3(18, 0, 5),
      width: 8, height: 2.5, depth: 3.5,
      rotation: -Math.PI / 2,
    }, world);
    this.addMesh(scene, qp2.mesh);
    this.bodies.push(qp2.body);

    // === HILLS (scattered) ===
    this.createHill(scene, world, 10, 10, 4, 4, 1.2, 0x2e2e52);
    this.createHill(scene, world, -8, 12, 5, 3, 0.8, 0x302e50);
    this.createHill(scene, world, 12, -8, 3, 5, 1.0, 0x2c2c4e);

    // === CENTER AREA — flat with features ===
    // Fun box
    const funbox = new Platform({
      position: new THREE.Vector3(0, 0, 0),
      width: 4, height: 0.7, depth: 3,
    }, world);
    this.addMesh(scene, funbox.mesh);
    this.bodies.push(funbox.body);

    // Bank up to fun box
    this.createBank(scene, world, 0, 2, 4, 0.7, 1.5, 0, 0x33335a);
    this.createBank(scene, world, 0, -2, 4, 0.7, 1.5, Math.PI, 0x33335a);

    // Center rail
    const rail1 = new Rail({
      position: new THREE.Vector3(5, 0, 3),
      length: 7, height: 0.6,
    }, world);
    this.addMesh(scene, rail1.mesh);
    this.bodies.push(rail1.body);

    // Angled rail
    const rail2 = new Rail({
      position: new THREE.Vector3(-5, 0, 5),
      length: 5, height: 0.5,
      rotation: Math.PI / 6,
    }, world);
    this.addMesh(scene, rail2.mesh);
    this.bodies.push(rail2.body);

    // Down rail (from platform area)
    const downRail = new Rail({
      position: new THREE.Vector3(6, platHeight / 2, -12),
      length: 5, height: 0.6,
      rotation: 0,
    }, world);
    this.addMesh(scene, downRail.mesh);
    this.bodies.push(downRail.body);

    // === SOUTH AREA — street-style features ===
    // Ledges in a line
    const ledge1 = new Ledge({
      position: new THREE.Vector3(-8, 0, 15),
      length: 6, height: 0.4, width: 0.6,
    }, world);
    this.addMesh(scene, ledge1.mesh);
    this.bodies.push(ledge1.body);

    const ledge2 = new Ledge({
      position: new THREE.Vector3(0, 0, 18),
      length: 5, height: 0.5, width: 0.5,
    }, world);
    this.addMesh(scene, ledge2.mesh);
    this.bodies.push(ledge2.body);

    // Launch ramp
    const launch = new Ramp({
      position: new THREE.Vector3(8, 0, 15),
      width: 3, height: 1.2, depth: 2,
    }, world);
    this.addMesh(scene, launch.mesh);
    this.bodies.push(launch.body);

    // Small bank for flow
    this.createBank(scene, world, -12, 8, 6, 1.0, 2.5, Math.PI / 2, 0x2e2e50);
    this.createBank(scene, world, 12, 8, 6, 1.0, 2.5, -Math.PI / 2, 0x2e2e50);

    // === PYRAMID ===
    const pyramid = new Platform({
      position: new THREE.Vector3(-10, 0, -8),
      width: 4, height: 1.0, depth: 4,
    }, world);
    this.addMesh(scene, pyramid.mesh);
    this.bodies.push(pyramid.body);
    // Banks on all 4 sides of pyramid
    this.createBank(scene, world, -10, -5.5, 4, 1.0, 2, 0, 0x33335a);
    this.createBank(scene, world, -10, -10.5, 4, 1.0, 2, Math.PI, 0x33335a);
    this.createBank(scene, world, -7.5, -8, 4, 1.0, 2, -Math.PI / 2, 0x33335a);
    this.createBank(scene, world, -12.5, -8, 4, 1.0, 2, Math.PI / 2, 0x33335a);

    // === AMBIENT — ground markings / color variation ===
    // Colored ground patches for visual interest
    const patchColors = [0x252548, 0x302a50, 0x28284a, 0x2a2a4c];
    for (let i = 0; i < 8; i++) {
      const px = (Math.random() - 0.5) * 50;
      const pz = (Math.random() - 0.5) * 50;
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(3 + Math.random() * 4, 3 + Math.random() * 4),
        new THREE.MeshStandardMaterial({
          color: patchColors[i % patchColors.length],
          roughness: 0.95,
        })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(px, 0.01, pz);
      this.addMesh(scene, patch);
    }
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
  }
}
