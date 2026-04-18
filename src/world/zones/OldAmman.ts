import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Ramp } from '../objects/Ramp';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';

// 7 Hills Skate Park, Amman, Jordan
// Central concrete flat area with a large bowl, quarter pipes, banks,
// and limestone hillside buildings surrounding the park in a valley.

export class OldAmman implements Zone {
  readonly config: ZoneConfig = {
    id: 'old_amman',
    name: 'Old Amman',
    spawnPoint: new THREE.Vector3(0, 1, 5),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  private addMesh(scene: THREE.Scene, mesh: THREE.Object3D): void {
    scene.add(mesh);
    this.objects.push(mesh);
  }

  private addBody(world: CANNON.World, body: CANNON.Body): void {
    world.addBody(body);
    this.bodies.push(body);
  }

  // Helper — static box mesh + physics body
  private addBox(
    scene: THREE.Scene,
    world: CANNON.World,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rotY = 0,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.addMesh(scene, mesh);

    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      position: new CANNON.Vec3(x, y + h / 2, z),
    });
    if (rotY !== 0) {
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    }
    this.addBody(world, body);
  }

  // A sloped bank wedge (wedge profile: right-triangle extruded along width)
  private addBank(
    scene: THREE.Scene,
    world: CANNON.World,
    x: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    rotY = 0,
    color = 0xb8a880,
  ): void {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(0, height);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(-depth / 2, 0, -width / 2);

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.addMesh(scene, mesh);

    const posAttr = geo.attributes['position'] as THREE.BufferAttribute;
    const indexAttr = geo.index;
    const vertices: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      vertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }
    const indices: number[] = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) indices.push(indexAttr.getX(i));
    } else {
      for (let i = 0; i < posAttr.count; i++) indices.push(i);
    }

    const trimesh = new CANNON.Trimesh(vertices, indices);
    const body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    body.addShape(trimesh);
    body.position.set(x, 0, z);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    this.addBody(world, body);
  }

  load(scene: THREE.Scene, world: CANNON.World): void {
    // =========================================================
    // LIGHTING — warm afternoon Amman sun
    // =========================================================
    const ambient = new THREE.AmbientLight(0xffe8c0, 0.7);
    this.addMesh(scene, ambient);

    const sun = new THREE.DirectionalLight(0xfff5d0, 1.4);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.addMesh(scene, sun);

    // =========================================================
    // GROUND PLANE — grass surrounds + concrete park surface
    // =========================================================

    // Outer grass (large area)
    const grassGeo = new THREE.PlaneGeometry(200, 200);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3d6b28, roughness: 0.95 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.addMesh(scene, grass);

    // Flat infinite ground physics plane (for raycast ground detection)
    const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.addBody(world, groundBody);

    // Central concrete flat area — ~40x30
    const concreteGeo = new THREE.PlaneGeometry(44, 32);
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xc4b090, roughness: 0.88 });
    const concrete = new THREE.Mesh(concreteGeo, concreteMat);
    concrete.rotation.x = -Math.PI / 2;
    concrete.position.set(0, 0.01, 2);
    concrete.receiveShadow = true;
    this.addMesh(scene, concrete);

    // Subtle grid lines on concrete
    const parkGrid = new THREE.GridHelper(44, 22, 0xb0a07a, 0xb0a07a);
    (parkGrid.material as THREE.Material).transparent = true;
    (parkGrid.material as THREE.Material).opacity = 0.2;
    parkGrid.position.set(0, 0.02, 2);
    this.addMesh(scene, parkGrid);

    // =========================================================
    // BOWL — large pool, west-center of park
    // Simulated with angled ring of wall segments + sunken floor
    // =========================================================
    const bowlCenter = new THREE.Vector3(-10, 0, 0);
    const bowlRadius = 8;
    const bowlDepth = 2.5;
    const bowlSegments = 20;

    // Sunken bowl floor (concrete)
    const bowlFloor = new THREE.Mesh(
      new THREE.CircleGeometry(bowlRadius - 0.6, bowlSegments),
      new THREE.MeshStandardMaterial({ color: 0xb8a878, roughness: 0.9 }),
    );
    bowlFloor.rotation.x = -Math.PI / 2;
    bowlFloor.position.set(bowlCenter.x, -bowlDepth + 0.02, bowlCenter.z);
    bowlFloor.receiveShadow = true;
    this.addMesh(scene, bowlFloor);

    // Bowl floor physics
    const bowlFloorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(bowlRadius, 0.15, bowlRadius)),
      position: new CANNON.Vec3(bowlCenter.x, -bowlDepth, bowlCenter.z),
    });
    this.addBody(world, bowlFloorBody);

    // Purple/blue graffiti color for bowl walls (like the real park)
    const bowlWallColors = [0x6a4ca0, 0x4a6ab8, 0x7a3080, 0x3a5090, 0x8840a0, 0x4a70c0];
    for (let i = 0; i < bowlSegments; i++) {
      const angle = (i / bowlSegments) * Math.PI * 2;
      const nextAngle = ((i + 1) / bowlSegments) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;

      const panelWidth = 2 * bowlRadius * Math.sin(Math.PI / bowlSegments) + 0.05;
      const wx = bowlCenter.x + Math.cos(midAngle) * (bowlRadius - 0.25);
      const wz = bowlCenter.z + Math.sin(midAngle) * (bowlRadius - 0.25);

      const wallColor = bowlWallColors[i % bowlWallColors.length];
      // Alternate between graffiti color and concrete for realistic look
      const useGraffiti = i % 3 === 0;
      const color = useGraffiti ? wallColor : 0xbcac8a;

      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(panelWidth, bowlDepth + 0.6, 0.5),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
      );
      wallMesh.position.set(wx, -bowlDepth / 2 + 0.3, wz);
      wallMesh.rotation.y = -midAngle + Math.PI / 2;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.addMesh(scene, wallMesh);

      const wallBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(panelWidth / 2, (bowlDepth + 0.6) / 2, 0.25)),
        position: new CANNON.Vec3(wx, -bowlDepth / 2 + 0.3, wz),
      });
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -midAngle + Math.PI / 2);
      this.addBody(world, wallBody);
    }

    // Bowl coping — metal rail around the rim
    const copingMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.6 });
    for (let i = 0; i < bowlSegments; i++) {
      const angle = (i / bowlSegments) * Math.PI * 2;
      const nextAngle = ((i + 1) / bowlSegments) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;
      const cw = 2 * bowlRadius * Math.sin(Math.PI / bowlSegments) + 0.1;
      const cx = bowlCenter.x + Math.cos(midAngle) * bowlRadius;
      const cz = bowlCenter.z + Math.sin(midAngle) * bowlRadius;
      const coping = new THREE.Mesh(
        new THREE.BoxGeometry(cw, 0.12, 0.12),
        copingMat,
      );
      coping.position.set(cx, 0.06, cz);
      coping.rotation.y = -midAngle + Math.PI / 2;
      this.addMesh(scene, coping);
    }

    // =========================================================
    // QUARTER PIPES — 4 sides around the bowl area
    // =========================================================

    // North quarter pipe
    const qpNorth = new Ramp({
      position: new THREE.Vector3(-10, 0, -10),
      width: 10, height: 2.5, depth: 3.5,
      rotation: 0,
    }, world);
    qpNorth.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xc4b090, roughness: 0.85 }); });
    this.addMesh(scene, qpNorth.mesh);
    this.bodies.push(qpNorth.body);

    // South quarter pipe
    const qpSouth = new Ramp({
      position: new THREE.Vector3(-10, 0, 10),
      width: 10, height: 2.5, depth: 3.5,
      rotation: Math.PI,
    }, world);
    qpSouth.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xc4b090, roughness: 0.85 }); });
    this.addMesh(scene, qpSouth.mesh);
    this.bodies.push(qpSouth.body);

    // West quarter pipe (facing east into the bowl)
    const qpWest = new Ramp({
      position: new THREE.Vector3(-20, 0, 0),
      width: 10, height: 2.5, depth: 3.5,
      rotation: Math.PI / 2,
    }, world);
    qpWest.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xc4b090, roughness: 0.85 }); });
    this.addMesh(scene, qpWest.mesh);
    this.bodies.push(qpWest.body);

    // East quarter pipe (facing west into the bowl)
    const qpEast = new Ramp({
      position: new THREE.Vector3(-0, 0, 0),
      width: 10, height: 2.0, depth: 3,
      rotation: -Math.PI / 2,
    }, world);
    qpEast.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xc4b090, roughness: 0.85 }); });
    this.addMesh(scene, qpEast.mesh);
    this.bodies.push(qpEast.body);

    // =========================================================
    // BANK RAMPS — connecting flat area to bowl edge
    // =========================================================
    this.addBank(scene, world, 2, -6, 6, 1.0, 3.0, 0, 0xc0ae88);
    this.addBank(scene, world, 2, 8, 6, 1.0, 3.0, Math.PI, 0xc0ae88);
    this.addBank(scene, world, -5, -6, 4, 0.8, 2.5, 0, 0xbcaa84);
    this.addBank(scene, world, -5, 8, 4, 0.8, 2.5, Math.PI, 0xbcaa84);

    // =========================================================
    // FLAT AREA — east side of park (main skate zone)
    // Raised platform / hubba section
    // =========================================================
    const hubba = new Platform({
      position: new THREE.Vector3(12, 0, -8),
      width: 12, height: 0.6, depth: 6,
    }, world);
    hubba.mesh.material = new THREE.MeshStandardMaterial({ color: 0xc8b898, roughness: 0.85 });
    this.addMesh(scene, hubba.mesh);
    this.bodies.push(hubba.body);

    // Bank up to hubba — south face
    this.addBank(scene, world, 12, -4.5, 10, 0.6, 1.5, 0, 0xc0ae88);

    // Ledges on hubba edges
    const hubbaLedge1 = new Ledge({
      position: new THREE.Vector3(7, 0.6, -8),
      length: 6, height: 0.35, width: 0.5,
      rotation: 0,
    }, world);
    this.addMesh(scene, hubbaLedge1.mesh);
    this.bodies.push(hubbaLedge1.body);

    const hubbaLedge2 = new Ledge({
      position: new THREE.Vector3(17, 0.6, -8),
      length: 6, height: 0.35, width: 0.5,
      rotation: 0,
    }, world);
    this.addMesh(scene, hubbaLedge2.mesh);
    this.bodies.push(hubbaLedge2.body);

    // Down rail on hubba
    const hubbaRail = new Rail({
      position: new THREE.Vector3(12, 0.6, -4.5),
      length: 5, height: 0.5,
      rotation: 0,
    }, world);
    this.addMesh(scene, hubbaRail.mesh);
    this.bodies.push(hubbaRail.body);

    // =========================================================
    // MANUAL PAD — center east area
    // =========================================================
    const manualPad = new Platform({
      position: new THREE.Vector3(14, 0, 8),
      width: 8, height: 0.3, depth: 4,
    }, world);
    manualPad.mesh.material = new THREE.MeshStandardMaterial({ color: 0xcabc96, roughness: 0.88 });
    this.addMesh(scene, manualPad.mesh);
    this.bodies.push(manualPad.body);

    // Ledge along manual pad
    const padLedge = new Ledge({
      position: new THREE.Vector3(14, 0.3, 6.2),
      length: 8, height: 0.3, width: 0.6,
      rotation: 0,
    }, world);
    this.addMesh(scene, padLedge.mesh);
    this.bodies.push(padLedge.body);

    // =========================================================
    // STREET RAILS — flat area
    // =========================================================
    const rail1 = new Rail({
      position: new THREE.Vector3(8, 0, 2),
      length: 7, height: 0.55,
      rotation: 0,
    }, world);
    this.addMesh(scene, rail1.mesh);
    this.bodies.push(rail1.body);

    const rail2 = new Rail({
      position: new THREE.Vector3(18, 0, 4),
      length: 6, height: 0.5,
      rotation: Math.PI / 8,
    }, world);
    this.addMesh(scene, rail2.mesh);
    this.bodies.push(rail2.body);

    const rail3 = new Rail({
      position: new THREE.Vector3(5, 0, 12),
      length: 5, height: 0.45,
      rotation: 0,
    }, world);
    this.addMesh(scene, rail3.mesh);
    this.bodies.push(rail3.body);

    // =========================================================
    // STREET LEDGES — scattered in flat area
    // =========================================================
    const ledge1 = new Ledge({
      position: new THREE.Vector3(10, 0, -2),
      length: 7, height: 0.45, width: 0.7,
      rotation: 0,
    }, world);
    this.addMesh(scene, ledge1.mesh);
    this.bodies.push(ledge1.body);

    const ledge2 = new Ledge({
      position: new THREE.Vector3(20, 0, -2),
      length: 6, height: 0.4, width: 0.6,
      rotation: Math.PI / 12,
    }, world);
    this.addMesh(scene, ledge2.mesh);
    this.bodies.push(ledge2.body);

    const ledge3 = new Ledge({
      position: new THREE.Vector3(6, 0, 15),
      length: 5, height: 0.5, width: 0.8,
      rotation: 0,
    }, world);
    this.addMesh(scene, ledge3.mesh);
    this.bodies.push(ledge3.body);

    // =========================================================
    // SMALL LAUNCH RAMP — south-east corner
    // =========================================================
    const launch = new Ramp({
      position: new THREE.Vector3(20, 0, 12),
      width: 4, height: 1.2, depth: 2.0,
      rotation: Math.PI,
    }, world);
    launch.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xbcae86, roughness: 0.86 }); });
    this.addMesh(scene, launch.mesh);
    this.bodies.push(launch.body);

    // =========================================================
    // HILLSIDE TERRAIN — valley walls north + south + west
    // Limestone-colored stepped ridges simulating Amman hills
    // =========================================================

    // North hill ridge
    this.addBox(scene, world, 0, 0, -40, 90, 12, 18, 0xc8b890);
    this.addBox(scene, world, 0, 0, -52, 100, 20, 12, 0xd0c098);

    // South hill ridge
    this.addBox(scene, world, 0, 0, 40, 90, 10, 16, 0xc8b890);
    this.addBox(scene, world, 0, 0, 52, 100, 18, 12, 0xd0c098);

    // West hill ridge (behind bowl)
    this.addBox(scene, world, -42, 0, 0, 16, 14, 70, 0xc4b48a);
    this.addBox(scene, world, -54, 0, 0, 12, 20, 80, 0xcab898);

    // East gentle slope / street level
    this.addBox(scene, world, 42, 0, 0, 14, 6, 70, 0xc0b088);

    // =========================================================
    // LIMESTONE BUILDINGS — on the hillsides (classic Amman style)
    // Simple box meshes in stone color
    // =========================================================
    const stoneColor = 0xd4c4a0;
    const stoneColorDark = 0xbcaf90;
    const stoneColorLight = 0xe0d0b0;

    // North hillside buildings
    const northBuildings: [number, number, number, number, number, number, number][] = [
      [-20, 0, -46, 10, 8, 8, stoneColor],
      [-8, 0, -44, 12, 10, 9, stoneColorLight],
      [4, 0, -47, 9, 7, 8, stoneColor],
      [16, 0, -45, 11, 9, 8, stoneColorDark],
      [26, 0, -46, 8, 6, 7, stoneColor],
      [-30, 0, -48, 10, 11, 9, stoneColorLight],
      [32, 0, -44, 9, 8, 8, stoneColorDark],
      [-15, 0, -54, 14, 6, 10, stoneColor],
      [10, 0, -55, 12, 7, 10, stoneColorLight],
      [28, 0, -52, 10, 5, 9, stoneColor],
    ];

    // South hillside buildings
    const southBuildings: [number, number, number, number, number, number, number][] = [
      [-22, 0, 44, 11, 9, 8, stoneColorDark],
      [-10, 0, 46, 10, 7, 9, stoneColor],
      [2, 0, 43, 12, 10, 8, stoneColorLight],
      [14, 0, 45, 9, 8, 8, stoneColor],
      [24, 0, 44, 10, 6, 7, stoneColorDark],
      [-32, 0, 47, 9, 8, 9, stoneColor],
      [34, 0, 46, 11, 9, 8, stoneColorLight],
    ];

    // West hillside buildings (behind bowl)
    const westBuildings: [number, number, number, number, number, number, number][] = [
      [-46, 0, -20, 8, 10, 10, stoneColor],
      [-48, 0, -8, 9, 8, 9, stoneColorLight],
      [-47, 0, 4, 8, 11, 10, stoneColorDark],
      [-45, 0, 16, 10, 9, 9, stoneColor],
      [-48, 0, -30, 8, 7, 10, stoneColorLight],
      [-46, 0, 28, 9, 8, 10, stoneColor],
    ];

    for (const [bx, by, bz, bw, bh, bd, bc] of [...northBuildings, ...southBuildings, ...westBuildings]) {
      this.addBox(scene, world, bx, by, bz, bw, bh, bd, bc);
    }

    // =========================================================
    // TREES — green box trees around the park perimeter
    // =========================================================
    const treePositions: [number, number][] = [
      // North perimeter
      [-25, -30], [-15, -32], [-5, -31], [5, -30], [15, -31], [25, -32],
      // South perimeter
      [-25, 32], [-15, 30], [-5, 31], [5, 32], [15, 30], [25, 31],
      // West perimeter
      [-30, -20], [-32, -10], [-31, 0], [-30, 10], [-32, 20],
      // East perimeter
      [32, -20], [30, -10], [31, 0], [32, 10], [30, 20],
      // Scattered inside park edges
      [-28, -5], [-27, 5], [28, -5], [27, 5],
    ];

    for (const [tx, tz] of treePositions) {
      const treeH = 2.5 + Math.abs((tx + tz) % 3) * 0.5;
      const treeW = 1.5 + Math.abs((tx * tz) % 2) * 0.4;
      // Trunk
      this.addBox(scene, world, tx, 0, tz, 0.4, treeH * 0.5, 0.4, 0x5a3a1a);
      // Canopy
      this.addBox(scene, world, tx, treeH * 0.5, tz, treeW, treeH * 0.6, treeW, 0x3a6b35);
    }

    // =========================================================
    // RETAINING WALL — separates park from hillside (north side)
    // =========================================================
    this.addBox(scene, world, 0, 0, -24, 50, 2.0, 0.6, 0xb8a878);
    this.addBox(scene, world, -25, 0, -16, 0.6, 2.0, 16, 0xb8a878);
    this.addBox(scene, world, 25, 0, -16, 0.6, 2.0, 16, 0xb8a878);
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
}
