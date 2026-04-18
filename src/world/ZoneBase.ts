import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface ZoneConfig {
  id: string;
  name: string;
  spawnPoint: THREE.Vector3;
}

export interface Zone {
  readonly config: ZoneConfig;
  load(scene: THREE.Scene, world: CANNON.World): void;
  unload(scene: THREE.Scene, world: CANNON.World): void;
}
