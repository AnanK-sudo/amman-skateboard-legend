import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface RampConfig {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  rotation?: number; // Y-axis rotation in radians
}

export class Ramp {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  readonly isLaunchRamp = true;

  constructor(config: RampConfig, world: CANNON.World) {
    const { position, width, height, depth, rotation = 0 } = config;

    // --- Three.js wedge via ExtrudeGeometry ---
    const shape = new THREE.Shape();
    // Wedge profile: bottom-left → bottom-right → top-right (launch tip)
    shape.moveTo(0, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(depth, height);
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: width,
      bevelEnabled: false,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center the geometry so pivot is at bottom-center
    geo.translate(-depth / 2, 0, -width / 2);

    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a5c, roughness: 0.8 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // --- CANNON Trimesh physics ---
    const posAttr = geo.attributes['position'] as THREE.BufferAttribute;
    const indexAttr = geo.index;

    const vertices: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      vertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }

    const indices: number[] = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.getX(i));
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) indices.push(i);
    }

    const trimesh = new CANNON.Trimesh(vertices, indices);
    this.body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 });
    this.body.addShape(trimesh);
    this.body.position.set(position.x, position.y, position.z);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
    world.addBody(this.body);
  }
}
