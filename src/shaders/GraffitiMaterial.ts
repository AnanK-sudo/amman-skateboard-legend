import * as THREE from 'three';

export function createGraffitiMaterial(baseColor: number): THREE.MeshToonMaterial {
  const colors = new Uint8Array([40, 120, 255]);
  const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;

  return new THREE.MeshToonMaterial({ color: baseColor, gradientMap });
}

export function createNeonMaterial(color: number, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.5,
    roughness: 0.3,
  });
}
