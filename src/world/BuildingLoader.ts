import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export interface BuildingPlacement {
  modelPath: string;   // e.g. '/models/amman_building_a.glb'
  position: THREE.Vector3;
  scale?: number;
  rotationY?: number;
  // Physics bounding box (auto-computed from model if omitted)
  physicsBox?: { w: number; h: number; d: number };
}

/**
 * Load a GLB/GLTF building model and place it in the scene with a physics box.
 * Returns a cleanup function that removes mesh + body.
 */
export function loadBuilding(
  scene: THREE.Scene,
  world: CANNON.World,
  placement: BuildingPlacement,
  onLoaded?: (mesh: THREE.Object3D) => void,
): () => void {
  const { modelPath, position, scale = 1, rotationY = 0, physicsBox } = placement;

  let mesh: THREE.Object3D | null = null;
  let body: CANNON.Body | null = null;

  loader.load(
    import.meta.env.BASE_URL + modelPath.replace(/^\//, ''),
    (gltf) => {
      mesh = gltf.scene;
      mesh.scale.setScalar(scale);
      mesh.position.copy(position);
      mesh.rotation.y = rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Enable shadows on all sub-meshes
      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(mesh);

      // Auto-compute bounding box for physics if not provided
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);

      const hw = (physicsBox?.w ?? size.x) / 2;
      const hh = (physicsBox?.h ?? size.y) / 2;
      const hd = (physicsBox?.d ?? size.z) / 2;

      body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(hw, hh, hd)),
        position: new CANNON.Vec3(position.x, position.y + hh, position.z),
      });
      if (rotationY !== 0) {
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);
      }
      world.addBody(body);

      onLoaded?.(mesh);
    },
    undefined,
    (err) => {
      console.warn(`[BuildingLoader] Failed to load ${modelPath}:`, err);
    },
  );

  // Return cleanup function for zone unload
  return () => {
    if (mesh) scene.remove(mesh);
    if (body) world.removeBody(body);
  };
}
