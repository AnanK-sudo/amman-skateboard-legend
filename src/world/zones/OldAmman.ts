import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Ramp } from '../objects/Ramp';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';
import { createStoneMaterial, createConcreteMaterial, createPBRConcreteMaterial, createPBRStoneMaterial, createPBRPavingMaterial } from '@/shaders/GraffitiMaterial';
import { loadBuilding } from '../BuildingLoader';

// 7 Hills Skate Park, Amman, Jordan — daytime, limestone architecture
export class OldAmman implements Zone {
  readonly config: ZoneConfig = {
    id: 'old_amman',
    name: 'Old Amman',
    spawnPoint: new THREE.Vector3(0, 1, 5),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];
  private modelCleanups: (() => void)[] = [];

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

  // Build a pointed Islamic arch window using ExtrudeGeometry
  private makeArchWindow(winW: number, winH: number): THREE.BufferGeometry {
    const archH = winH * 0.35; // pointed tip portion
    const shape = new THREE.Shape();
    shape.moveTo(-winW / 2, 0);
    shape.lineTo(-winW / 2, winH - archH);
    // Pointed arch: two curves meeting at the tip
    shape.quadraticCurveTo(-winW / 2, winH + archH * 0.4, 0, winH + archH * 0.55);
    shape.quadraticCurveTo(winW / 2, winH + archH * 0.4, winW / 2, winH - archH);
    shape.lineTo(winW / 2, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }

  // Limestone Amman building — Islamic arch windows, facade bands, cornice, balconies
  private addBuilding(
    scene: THREE.Scene, world: CANNON.World,
    x: number, z: number,
    w: number, h: number, d: number,
    baseColor: number, rotY = 0
  ): void {
    const stoneMat   = createStoneMaterial(baseColor);
    const lightMat   = createStoneMaterial(Math.min(0xffffff, baseColor + 0x141410));
    const darkMat    = createStoneMaterial(Math.max(0, baseColor - 0x0c0c0a));

    // ── Main body ──
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    bodyMesh.position.set(x, h / 2, z);
    bodyMesh.rotation.y = rotY;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.addMesh(scene, bodyMesh);

    // Physics box
    const phys = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      position: new CANNON.Vec3(x, h / 2, z),
    });
    if (rotY !== 0) phys.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    this.addBody(world, phys);

    // ── Horizontal facade bands every ~2.8m (floor lines) ──
    const floors = Math.max(1, Math.floor(h / 2.8));
    const bandMat = darkMat;
    for (let f = 1; f < floors; f++) {
      const by = (f / floors) * h;
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), bandMat);
      band.position.set(x, by, z);
      band.rotation.y = rotY;
      this.addMesh(scene, band);
    }

    // ── Islamic arch windows ──
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x1a2e3a, roughness: 0.05, metalness: 0.7,
    });
    const archFrameMat = lightMat;
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x6b4520, roughness: 0.85 });

    const cols = Math.max(1, Math.floor(w / 2.6));
    const winW = 0.72, winH = 1.05;
    const archGeo = this.makeArchWindow(winW, winH);

    for (let face = 0; face < 2; face++) {
      const faceOffset = face === 0 ? d / 2 : -(d / 2);
      const faceRot    = face === 0 ? 0 : Math.PI;
      const faceDir    = face === 0 ? 1 : -1;

      for (let fl = 0; fl < floors; fl++) {
        const wy = 1.1 + fl * (h / floors);
        for (let c = 0; c < cols; c++) {
          const wx = x + (-w / 2 + (c + 0.5) * (w / cols));
          const wz = z + faceOffset * 1.01;

          // Glass pane (arch shape)
          const pane = new THREE.Mesh(archGeo, winMat);
          pane.position.set(wx, wy, wz);
          pane.rotation.y = rotY + faceRot;
          this.addMesh(scene, pane);

          // Arch frame — thin box surround
          const frameW = winW + 0.12, frameH = winH + 0.18;
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(frameW, frameH, 0.08),
            archFrameMat
          );
          frame.position.set(wx, wy + winH * 0.05, wz + faceDir * 0.03);
          frame.rotation.y = rotY + faceRot;
          this.addMesh(scene, frame);

          // Wooden shutters (open, flanking)
          for (const side of [-1, 1] as const) {
            const shutter = new THREE.Mesh(
              new THREE.BoxGeometry(0.2, winH, 0.04), shutterMat
            );
            shutter.position.set(
              wx + side * (winW / 2 + 0.12),
              wy + winH * 0.05,
              wz + faceDir * 0.05
            );
            shutter.rotation.y = rotY + faceRot;
            this.addMesh(scene, shutter);
          }
        }
      }
    }

    // ── Decorative cornice (pronounced overhang at roofline) ──
    const corniceBot = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.15, d + 0.5), darkMat);
    corniceBot.position.set(x, h - 0.3, z);
    corniceBot.rotation.y = rotY;
    corniceBot.castShadow = true;
    this.addMesh(scene, corniceBot);

    const corniceTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.22, d + 0.7), lightMat);
    corniceTop.position.set(x, h, z);
    corniceTop.rotation.y = rotY;
    corniceTop.castShadow = true;
    this.addMesh(scene, corniceTop);

    // ── Roof parapet with crenellations ──
    const crenH = 0.55, crenW = 0.5;
    const perimX = [-w / 2, w / 2];
    for (const px of perimX) {
      const count = Math.floor(d / (crenW * 2));
      for (let i = 0; i < count; i++) {
        if (i % 2 === 0) {
          const cr = new THREE.Mesh(new THREE.BoxGeometry(0.3, crenH, crenW), lightMat);
          const lx = x + px + (px > 0 ? -0.15 : 0.15);
          cr.position.set(lx, h + crenH / 2 + 0.22, z - d / 2 + i * crenW * 2 + crenW);
          cr.rotation.y = rotY;
          cr.castShadow = true;
          this.addMesh(scene, cr);
        }
      }
    }
    const perimZ = [-d / 2, d / 2];
    for (const pz of perimZ) {
      const count = Math.floor(w / (crenW * 2));
      for (let i = 0; i < count; i++) {
        if (i % 2 === 0) {
          const cr = new THREE.Mesh(new THREE.BoxGeometry(crenW, crenH, 0.3), lightMat);
          cr.position.set(x - w / 2 + i * crenW * 2 + crenW, h + crenH / 2 + 0.22, z + pz + (pz > 0 ? -0.15 : 0.15));
          cr.rotation.y = rotY;
          cr.castShadow = true;
          this.addMesh(scene, cr);
        }
      }
    }

    // ── Rooftop water tanks ──
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x909080, roughness: 0.75 });
    const tankH = 1.0, tankR = 0.45 + (Math.abs(x * 0.1) % 0.25);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 8), tankMat);
    tank.position.set(x + w * 0.3, h + 0.22 + tankH / 2, z + d * 0.3);
    tank.castShadow = true;
    this.addMesh(scene, tank);

    // ── Balconies every other floor on front face ──
    if (floors >= 2) {
      const balMat = lightMat;
      const railMat = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.6, metalness: 0.2 });
      for (let fl = 1; fl < floors; fl += 2) {
        const by = 1.1 + fl * (h / floors);
        const bw = w * 0.5;
        const cosR = Math.cos(rotY), sinR = Math.sin(rotY);
        const balOffZ = d / 2 + 0.4;

        // Slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.12, 0.85), balMat);
        slab.position.set(
          x + (-sinR) * balOffZ,
          by,
          z + cosR * balOffZ
        );
        slab.rotation.y = rotY;
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.addMesh(scene, slab);

        // Railing posts
        const posts = Math.floor(bw / 0.38);
        for (let p = 0; p <= posts; p++) {
          const localX = -bw / 2 + p * (bw / posts);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.07), railMat);
          post.position.set(
            x + localX * cosR + (-sinR) * balOffZ,
            by + 0.38,
            z + localX * sinR + cosR * balOffZ
          );
          post.rotation.y = rotY;
          this.addMesh(scene, post);
        }

        // Top rail bar
        const rail = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, 0.06, 0.06), railMat);
        rail.position.set(
          x + (-sinR) * balOffZ,
          by + 0.7,
          z + cosR * balOffZ
        );
        rail.rotation.y = rotY;
        this.addMesh(scene, rail);
      }
    }
  }

  // Minaret — tall slender tower with Islamic tiers, typical of Amman mosques
  private addMinaret(scene: THREE.Scene, world: CANNON.World, x: number, z: number, h = 20): void {
    const stoneMat  = createStoneMaterial(0xd8c8a0);
    const accentMat = createStoneMaterial(0xe8d8b0);
    const r = 0.7;

    // Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 12), stoneMat);
    shaft.position.set(x, h / 2, z);
    shaft.castShadow = true;
    this.addMesh(scene, shaft);

    // Balcony tier at 2/3 height
    const tierY = h * 0.65;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.2, 0.4, 12), accentMat);
    tier.position.set(x, tierY, z);
    tier.castShadow = true;
    this.addMesh(scene, tier);

    // Tapering upper section above balcony
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, h * 0.3, 12), stoneMat);
    upper.position.set(x, tierY + h * 0.15, z);
    upper.castShadow = true;
    this.addMesh(scene, upper);

    // Onion dome at top
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), accentMat);
    dome.position.set(x, h + 0.1, z);
    dome.castShadow = true;
    this.addMesh(scene, dome);

    // Pointed tip (cone)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.0, 8), accentMat);
    tip.position.set(x, h + 0.9, z);
    this.addMesh(scene, tip);

    // Physics — simple cylinder
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Cylinder(r, r * 1.1, h, 8),
      position: new CANNON.Vec3(x, h / 2, z),
    });
    this.addBody(world, body);
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

    // Concrete park surface — real PBR texture from Poly Haven
    const concreteMat = createPBRConcreteMaterial(8);
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
    // Hillside terrain — real PBR limestone/rock texture
    const hillMat = createPBRStoneMaterial(5);
    const hillMatLight = createPBRStoneMaterial(6);
    const hillMatAlt = createPBRStoneMaterial(4);

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
    const wallMat = createPBRPavingMaterial(3);
    this.addBox(scene, world, 0, 0, -24, 50, 2.0, 0.6, wallMat);
    this.addBox(scene, world, -25, 0, -16, 0.6, 2.0, 16, wallMat);
    this.addBox(scene, world, 25, 0, -16, 0.6, 2.0, 16, wallMat);

    // =========================================================
    // REAL BUILDING MODELS — drop .glb files in /public/models/
    // =========================================================
    // Each entry: modelPath, position, scale, rotationY (radians)
    // If the file doesn't exist the loader silently skips it.
    const buildingPlacements: [string, number, number, number, number][] = [
      // [modelPath,              x,    z,   scale, rotY,        ]
      ['/models/building_a.glb', -20, -46,   1.0,  0            ],
      ['/models/building_a.glb',  -8, -44,   1.2,  Math.PI / 4  ],
      ['/models/building_b.glb',   4, -47,   0.9,  0            ],
      ['/models/building_b.glb',  16, -45,   1.1, -Math.PI / 6  ],
      ['/models/building_a.glb', -22,  44,   1.0,  Math.PI      ],
      ['/models/building_b.glb',   2,  43,   1.3,  Math.PI      ],
      ['/models/building_a.glb', -46, -20,   1.0,  Math.PI / 2  ],
      ['/models/building_b.glb', -48,   4,   1.1,  Math.PI / 2  ],
    ];

    for (const [path, x, z, scale, rotY] of buildingPlacements) {
      const cleanup = loadBuilding(scene, world, {
        modelPath: path,
        position: new THREE.Vector3(x, 0, z),
        scale,
        rotationY: rotY,
      });
      this.modelCleanups.push(cleanup);
    }

    // =========================================================
    // MINARETS — north and south hillsides
    // =========================================================
    this.addMinaret(scene, world, -35, -48, 22);
    this.addMinaret(scene, world,  30, -50, 18);
    this.addMinaret(scene, world, -32,  47, 20);
    this.addMinaret(scene, world,  28,  45, 16);

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
    for (const cleanup of this.modelCleanups) cleanup();
    this.objects = [];
    this.bodies = [];
    this.modelCleanups = [];
  }
}
