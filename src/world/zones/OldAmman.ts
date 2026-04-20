import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Ramp } from '../objects/Ramp';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';
import { createStoneMaterial, createConcreteMaterial } from '@/shaders/GraffitiMaterial';

// 7 Hills Skate Park, Amman, Jordan — daytime, limestone architecture
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

  // Flat box — no physics (purely visual: decals, markings)
  private addDecal(scene: THREE.Scene, x: number, y: number, z: number, w: number, d: number, color: number, rotY = 0): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    mesh.position.set(x, y, z);
    this.addMesh(scene, mesh);
  }

  // Static box with physics
  private addBox(
    scene: THREE.Scene, world: CANNON.World,
    x: number, y: number, z: number,
    w: number, h: number, d: number,
    mat: THREE.Material, rotY = 0
  ): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
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
    if (rotY !== 0) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    this.addBody(world, body);
  }

  // Limestone building with windows, balconies, roof parapet
  private addBuilding(
    scene: THREE.Scene, world: CANNON.World,
    x: number, z: number,
    w: number, h: number, d: number,
    baseColor: number, rotY = 0
  ): void {
    const stoneMat = createStoneMaterial(baseColor);

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    body.position.set(x, h / 2, z);
    body.rotation.y = rotY;
    body.castShadow = true;
    body.receiveShadow = true;
    this.addMesh(scene, body);

    // Physics (simple box — no need for window detail in collision)
    const phys = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      position: new CANNON.Vec3(x, h / 2, z),
    });
    if (rotY !== 0) phys.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    this.addBody(world, phys);

    // Window material — dark tinted glass
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x2a3a48,
      roughness: 0.1,
      metalness: 0.6,
      envMapIntensity: 1.0,
    });

    // Window shutters (warm wood tone)
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });

    // Add windows on front (z+) and back (z−) faces
    const rows = Math.max(1, Math.floor(h / 2.8));
    const cols = Math.max(1, Math.floor(w / 2.6));
    const winW = 0.75, winH = 1.0;

    for (let face = 0; face < 2; face++) {
      const faceZ = face === 0 ? d / 2 + 0.06 : -(d / 2 + 0.06);
      const faceDirZ = face === 0 ? 0 : Math.PI;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = x + (-w / 2 + (c + 0.5) * (w / cols));
          const wy = 0.9 + r * (h / rows);
          const wz = z + faceZ;

          // Glass pane
          const win = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), winMat);
          win.position.set(wx, wy, wz);
          win.rotation.y = rotY + faceDirZ;
          this.addMesh(scene, win);

          // Shutter pair (flanking the window)
          const shutW = 0.18, shutH = winH + 0.05;
          for (const side of [-1, 1]) {
            const shutter = new THREE.Mesh(new THREE.BoxGeometry(shutW, shutH, 0.04), shutterMat);
            shutter.position.set(wx + side * (winW / 2 + shutW / 2 + 0.02), wy, wz + (face === 0 ? 0.03 : -0.03));
            shutter.rotation.y = rotY + faceDirZ;
            this.addMesh(scene, shutter);
          }
        }
      }
    }

    // Roof parapet — slightly wider/deeper than building body
    const parapetMat = createStoneMaterial(baseColor + 0x0a0a08);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.35, d + 0.25), parapetMat);
    parapet.position.set(x, h + 0.175, z);
    parapet.rotation.y = rotY;
    parapet.castShadow = true;
    this.addMesh(scene, parapet);

    // Roof detail — water tank / HVAC box (random per building)
    if ((x + z) % 3 > 0.5) {
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x888878, roughness: 0.7 });
      const tankW = 0.8 + (Math.abs(x) % 2) * 0.3;
      const tank = new THREE.Mesh(new THREE.BoxGeometry(tankW, 0.9, tankW), tankMat);
      tank.position.set(x + (w / 2 - tankW), h + 0.8, z + (d / 2 - tankW));
      tank.rotation.y = rotY;
      tank.castShadow = true;
      this.addMesh(scene, tank);
    }

    // Balcony on second floor (if tall enough)
    if (h > 5 && rows >= 2) {
      const balMat = createStoneMaterial(baseColor - 0x080806);
      // Front balcony
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.1, 0.7), balMat);
      balcony.position.set(x, 0.9 + (h / rows), z + d / 2 + 0.35);
      balcony.rotation.y = rotY;
      balcony.castShadow = true;
      balcony.receiveShadow = true;
      this.addMesh(scene, balcony);

      // Balcony railing posts
      const railMat = new THREE.MeshStandardMaterial({ color: 0x555545, roughness: 0.5, metalness: 0.3 });
      const postCount = Math.floor(w * 0.55 / 0.4);
      for (let p = 0; p <= postCount; p++) {
        const px = x - (w * 0.55 / 2) + p * (w * 0.55 / postCount);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), railMat);
        post.position.set(px, 0.9 + (h / rows) + 0.3, z + d / 2 + 0.35);
        post.rotation.y = rotY;
        this.addMesh(scene, post);
      }
      const railBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55 + 0.06, 0.05, 0.06), railMat);
      railBar.position.set(x, 0.9 + (h / rows) + 0.62, z + d / 2 + 0.35);
      railBar.rotation.y = rotY;
      this.addMesh(scene, railBar);
    }
  }

  // Tree: cylinder trunk + cone canopy
  private addTree(scene: THREE.Scene, world: CANNON.World, x: number, z: number): void {
    const trunkH = 2.0 + (Math.abs(x * z) % 1.5);
    const canopyH = 2.5 + (Math.abs(x + z) % 1.8);
    const canopyR = 1.2 + (Math.abs(x - z) % 0.8);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e10, roughness: 0.95 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3a6b22, roughness: 0.9 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, trunkH, 8), trunkMat);
    trunk.position.set(x, trunkH / 2, z);
    trunk.castShadow = true;
    this.addMesh(scene, trunk);

    // Main canopy cone
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(canopyR, canopyH, 10), canopyMat);
    canopy.position.set(x, trunkH + canopyH / 2 - 0.2, z);
    canopy.castShadow = true;
    this.addMesh(scene, canopy);

    // Second smaller cone on top for full shape
    const topCone = new THREE.Mesh(new THREE.ConeGeometry(canopyR * 0.6, canopyH * 0.6, 10), canopyMat);
    topCone.position.set(x, trunkH + canopyH * 0.7, z);
    topCone.castShadow = true;
    this.addMesh(scene, topCone);

    // Simple box physics for trunk collision
    const phys = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Cylinder(0.2, 0.25, trunkH, 8),
      position: new CANNON.Vec3(x, trunkH / 2, z),
    });
    this.addBody(world, phys);
  }

  private addBank(
    scene: THREE.Scene, world: CANNON.World,
    x: number, z: number,
    width: number, height: number, depth: number,
    rotY = 0, color = 0xb8a880,
  ): void {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(0, height);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(-depth / 2, 0, -width / 2);

    const mesh = new THREE.Mesh(geo, createConcreteMaterial(color));
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
    // GROUND — grass + concrete park surface
    // =========================================================
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a7a30, roughness: 0.95 });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.addMesh(scene, grass);

    const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.addBody(world, groundBody);

    // Concrete park surface
    const concreteMat = createConcreteMaterial(0xb8aa90);
    const concrete = new THREE.Mesh(new THREE.PlaneGeometry(48, 36), concreteMat);
    concrete.rotation.x = -Math.PI / 2;
    concrete.position.set(0, 0.01, 2);
    concrete.receiveShadow = true;
    this.addMesh(scene, concrete);

    // Road markings — painted lines on concrete
    this.addDecal(scene, 0, 0.025, 2, 44, 0.12, 0xfaf5e0, 0);       // center line
    this.addDecal(scene, -14, 0.025, 2, 0.12, 32, 0xfaf5e0, 0);      // left edge
    this.addDecal(scene, 14, 0.025, 2, 0.12, 32, 0xfaf5e0, 0);       // right edge

    // =========================================================
    // BOWL — large pool, west-center of park
    // =========================================================
    const bowlCenter = new THREE.Vector3(-10, 0, 0);
    const bowlRadius = 8;
    const bowlDepth = 2.5;
    const bowlSegments = 20;

    const bowlFloorMat = createConcreteMaterial(0xb0a280);
    const bowlFloor = new THREE.Mesh(new THREE.CircleGeometry(bowlRadius - 0.6, bowlSegments), bowlFloorMat);
    bowlFloor.rotation.x = -Math.PI / 2;
    bowlFloor.position.set(bowlCenter.x, -bowlDepth + 0.02, bowlCenter.z);
    bowlFloor.receiveShadow = true;
    this.addMesh(scene, bowlFloor);

    const bowlFloorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(bowlRadius, 0.15, bowlRadius)),
      position: new CANNON.Vec3(bowlCenter.x, -bowlDepth, bowlCenter.z),
    });
    this.addBody(world, bowlFloorBody);

    // Bowl walls — limestone-tinted concrete panels with graffiti accents
    const bowlWallColors = [0xc0b090, 0xb8a888, 0xbcae8a, 0xb4a882, 0xc4b494, 0xb8aa84];
    const graffitiColors = [0x6a4ca0, 0x4a6ab8, 0x7a3080, 0x3a5090];
    for (let i = 0; i < bowlSegments; i++) {
      const angle = (i / bowlSegments) * Math.PI * 2;
      const nextAngle = ((i + 1) / bowlSegments) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;

      const panelWidth = 2 * bowlRadius * Math.sin(Math.PI / bowlSegments) + 0.05;
      const wx = bowlCenter.x + Math.cos(midAngle) * (bowlRadius - 0.25);
      const wz = bowlCenter.z + Math.sin(midAngle) * (bowlRadius - 0.25);

      const useGraffiti = i % 4 === 0;
      const color = useGraffiti
        ? graffitiColors[Math.floor(i / 4) % graffitiColors.length]
        : bowlWallColors[i % bowlWallColors.length];

      const wallMat = useGraffiti
        ? new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
        : createConcreteMaterial(color);

      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, bowlDepth + 0.6, 0.5), wallMat);
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

    // Bowl coping — polished metal rim
    const copingMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.2, metalness: 0.8 });
    for (let i = 0; i < bowlSegments; i++) {
      const angle = (i / bowlSegments) * Math.PI * 2;
      const nextAngle = ((i + 1) / bowlSegments) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;
      const cw = 2 * bowlRadius * Math.sin(Math.PI / bowlSegments) + 0.1;
      const cx = bowlCenter.x + Math.cos(midAngle) * bowlRadius;
      const cz = bowlCenter.z + Math.sin(midAngle) * bowlRadius;
      const coping = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.12, 0.15), copingMat);
      coping.position.set(cx, 0.06, cz);
      coping.rotation.y = -midAngle + Math.PI / 2;
      coping.castShadow = true;
      this.addMesh(scene, coping);
    }

    // =========================================================
    // QUARTER PIPES
    // =========================================================
    const rampMat = createConcreteMaterial(0xb8aa88);
    for (const [rx, rz, rot] of [
      [-10, -10, 0],
      [-10, 10, Math.PI],
      [-20, 0, Math.PI / 2],
      [0, 0, -Math.PI / 2],
    ] as [number, number, number][]) {
      const qp = new Ramp({
        position: new THREE.Vector3(rx, 0, rz),
        width: 10, height: 2.5, depth: 3.5, rotation: rot,
      }, world);
      qp.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = rampMat; });
      this.addMesh(scene, qp.mesh);
      this.bodies.push(qp.body);
    }

    // =========================================================
    // BANKS
    // =========================================================
    this.addBank(scene, world, 2, -6, 6, 1.0, 3.0, 0, 0xb4a882);
    this.addBank(scene, world, 2, 8, 6, 1.0, 3.0, Math.PI, 0xb4a882);
    this.addBank(scene, world, -5, -6, 4, 0.8, 2.5, 0, 0xb0a47e);
    this.addBank(scene, world, -5, 8, 4, 0.8, 2.5, Math.PI, 0xb0a47e);

    // =========================================================
    // HUBBA / PLATFORM
    // =========================================================
    const platMat = createConcreteMaterial(0xc0b290);
    const hubba = new Platform({ position: new THREE.Vector3(12, 0, -8), width: 12, height: 0.6, depth: 6 }, world);
    hubba.mesh.material = platMat;
    this.addMesh(scene, hubba.mesh);
    this.bodies.push(hubba.body);

    this.addBank(scene, world, 12, -4.5, 10, 0.6, 1.5, 0, 0xb8aa88);

    for (const [lx, lz, lr] of [[7, -8, 0], [17, -8, 0]] as [number, number, number][]) {
      const l = new Ledge({ position: new THREE.Vector3(lx, 0.6, lz), length: 6, height: 0.35, width: 0.5, rotation: lr }, world);
      this.addMesh(scene, l.mesh);
      this.bodies.push(l.body);
    }

    const hubbaRail = new Rail({ position: new THREE.Vector3(12, 0.6, -4.5), length: 5, height: 0.5, rotation: 0 }, world);
    this.addMesh(scene, hubbaRail.mesh);
    this.bodies.push(hubbaRail.body);

    // =========================================================
    // MANUAL PAD
    // =========================================================
    const manPad = new Platform({ position: new THREE.Vector3(14, 0, 8), width: 8, height: 0.3, depth: 4 }, world);
    manPad.mesh.material = createConcreteMaterial(0xc2b492);
    this.addMesh(scene, manPad.mesh);
    this.bodies.push(manPad.body);

    const padLedge = new Ledge({ position: new THREE.Vector3(14, 0.3, 6.2), length: 8, height: 0.3, width: 0.6, rotation: 0 }, world);
    this.addMesh(scene, padLedge.mesh);
    this.bodies.push(padLedge.body);

    // =========================================================
    // RAILS & LEDGES
    // =========================================================
    for (const [rx, ry, rz, rl, rh, rrot] of [
      [8, 0, 2, 7, 0.55, 0],
      [18, 0, 4, 6, 0.5, Math.PI / 8],
      [5, 0, 12, 5, 0.45, 0],
    ] as [number, number, number, number, number, number][]) {
      const r = new Rail({ position: new THREE.Vector3(rx, ry, rz), length: rl, height: rh, rotation: rrot }, world);
      this.addMesh(scene, r.mesh);
      this.bodies.push(r.body);
    }

    for (const [lx, ly, lz, ll, lh, lw, lrot] of [
      [10, 0, -2, 7, 0.45, 0.7, 0],
      [20, 0, -2, 6, 0.4, 0.6, Math.PI / 12],
      [6, 0, 15, 5, 0.5, 0.8, 0],
    ] as [number, number, number, number, number, number, number][]) {
      const l = new Ledge({ position: new THREE.Vector3(lx, ly, lz), length: ll, height: lh, width: lw, rotation: lrot }, world);
      this.addMesh(scene, l.mesh);
      this.bodies.push(l.body);
    }

    // Launch ramp
    const launch = new Ramp({ position: new THREE.Vector3(20, 0, 12), width: 4, height: 1.2, depth: 2.0, rotation: Math.PI }, world);
    launch.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = createConcreteMaterial(0xb8ae86); });
    this.addMesh(scene, launch.mesh);
    this.bodies.push(launch.body);

    // =========================================================
    // HILLSIDE TERRAIN — Amman valley walls
    // =========================================================
    const hillMat = createStoneMaterial(0xc4b48c);
    const hillMatLight = createStoneMaterial(0xd0c098);
    const hillMatAlt = createStoneMaterial(0xc8b890);

    this.addBox(scene, world, 0, 0, -40, 90, 12, 18, hillMat);
    this.addBox(scene, world, 0, 0, -52, 100, 20, 12, hillMatLight);
    this.addBox(scene, world, 0, 0, 40, 90, 10, 16, hillMat);
    this.addBox(scene, world, 0, 0, 52, 100, 18, 12, hillMatLight);
    this.addBox(scene, world, -42, 0, 0, 16, 14, 70, hillMatAlt);
    this.addBox(scene, world, -54, 0, 0, 12, 20, 80, hillMatLight);
    this.addBox(scene, world, 42, 0, 0, 14, 6, 70, hillMat);

    // =========================================================
    // LIMESTONE BUILDINGS — proper 3D architecture
    // =========================================================
    // North hillside
    for (const [bx, bz, bw, bh, bd, bc] of [
      [-20, -46, 10, 8, 8, 0xd4c4a0],
      [-8, -44, 12, 11, 9, 0xe0d0b0],
      [4, -47, 9, 7, 8, 0xd0c09a],
      [16, -45, 11, 10, 8, 0xc8b890],
      [26, -46, 8, 6, 7, 0xd4c4a0],
      [-30, -48, 10, 12, 9, 0xe0d0b0],
      [32, -44, 9, 8, 8, 0xc8b890],
      [-15, -54, 14, 6, 10, 0xd4c4a0],
      [10, -55, 12, 7, 10, 0xdccead],
      [28, -52, 10, 5, 9, 0xd0c09a],
    ] as [number, number, number, number, number, number][]) {
      this.addBuilding(scene, world, bx, bz, bw, bh, bd, bc);
    }

    // South hillside
    for (const [bx, bz, bw, bh, bd, bc] of [
      [-22, 44, 11, 9, 8, 0xc8b890],
      [-10, 46, 10, 7, 9, 0xd4c4a0],
      [2, 43, 12, 11, 8, 0xe0d0b0],
      [14, 45, 9, 8, 8, 0xd0c09a],
      [24, 44, 10, 6, 7, 0xc8b890],
      [-32, 47, 9, 9, 9, 0xd4c4a0],
      [34, 46, 11, 10, 8, 0xe0d0b0],
    ] as [number, number, number, number, number, number][]) {
      this.addBuilding(scene, world, bx, bz, bw, bh, bd, bc);
    }

    // West hillside (behind bowl)
    for (const [bx, bz, bw, bh, bd, bc] of [
      [-46, -20, 8, 10, 10, 0xd4c4a0],
      [-48, -8, 9, 8, 9, 0xdccead],
      [-47, 4, 8, 12, 10, 0xc8b890],
      [-45, 16, 10, 9, 9, 0xd4c4a0],
      [-48, -30, 8, 7, 10, 0xe0d0b0],
      [-46, 28, 9, 9, 10, 0xd0c09a],
    ] as [number, number, number, number, number, number][]) {
      this.addBuilding(scene, world, bx, bz, bw, bh, bd, bc);
    }

    // =========================================================
    // TREES — cone canopy style
    // =========================================================
    for (const [tx, tz] of [
      [-25, -30], [-15, -32], [-5, -31], [5, -30], [15, -31], [25, -32],
      [-25, 32], [-15, 30], [-5, 31], [5, 32], [15, 30], [25, 31],
      [-30, -20], [-32, -10], [-31, 0], [-30, 10], [-32, 20],
      [32, -20], [30, -10], [31, 0], [32, 10], [30, 20],
      [-28, -5], [-27, 5], [28, -5], [27, 5],
    ] as [number, number][]) {
      this.addTree(scene, world, tx, tz);
    }

    // =========================================================
    // RETAINING WALL + STREET LAMPS
    // =========================================================
    const wallMat = createStoneMaterial(0xb8a878);
    this.addBox(scene, world, 0, 0, -24, 50, 2.0, 0.6, wallMat);
    this.addBox(scene, world, -25, 0, -16, 0.6, 2.0, 16, wallMat);
    this.addBox(scene, world, 25, 0, -16, 0.6, 2.0, 16, wallMat);

    // Street lamps along the wall — with warm point lights casting pools on ground
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x888878, roughness: 0.3, metalness: 0.7 });
    const lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e0, emissive: 0xffee88, emissiveIntensity: 2.0, roughness: 0.3
    });
    for (const lx of [-20, -10, 0, 10, 20]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.5, 8), lampMat);
      pole.position.set(lx, 2.25, -23.5);
      pole.castShadow = true;
      this.addMesh(scene, pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.8), lampMat);
      arm.position.set(lx, 4.5, -23.1);
      this.addMesh(scene, arm);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), lampHeadMat);
      head.position.set(lx, 4.42, -22.7);
      this.addMesh(scene, head);

      // Point light — warm golden pool on the ground below
      const pt = new THREE.PointLight(0xffdd88, 6, 12, 1.8);
      pt.position.set(lx, 4.0, -22.7);
      scene.add(pt);
      this.objects.push(pt);
    }
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
  }
}
