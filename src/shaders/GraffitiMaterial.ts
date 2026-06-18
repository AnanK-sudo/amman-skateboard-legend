import * as THREE from 'three';

function makeRamp(steps: number[]): THREE.DataTexture {
  const data = new Uint8Array(steps);
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Shared ramps -- allocated once, reused across all materials
const ramp2 = makeRamp([80, 240]);          // concrete: shadow + highlight
const ramp3 = makeRamp([70, 160, 240]);     // stone: shadow + mid + highlight
const ramp3warm = makeRamp([75, 165, 242]); // paving/graffiti: same 3-tone, warmer feel

export function createGraffitiMaterial(baseColor: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: baseColor, gradientMap: ramp3 });
}

// Emissive neon -- stays MeshStandardMaterial so it blooms in postprocessing
export function createNeonMaterial(color: number, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.5,
    roughness: 0.3,
  });
}

export function createStoneMaterial(baseColor: number, _roughness = 0.88): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: baseColor, gradientMap: ramp3 });
}

export function createConcreteMaterial(baseColor: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: baseColor, gradientMap: ramp2 });
}

// PBR variants replaced with toon -- normal/roughness maps don't read in toon shading
export function createPBRConcreteMaterial(_repeat = 6): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: 0xa09888, gradientMap: ramp2 });
}

export function createPBRStoneMaterial(_repeat = 3): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: 0x9a8a70, gradientMap: ramp3 });
}

export function createPBRPavingMaterial(_repeat = 4): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: 0x8a7e68, gradientMap: ramp3warm });
}
