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

// Procedural stone/concrete texture — canvas noise so surfaces have grain
export function createStoneMaterial(baseColor: number, roughness = 0.88): THREE.MeshStandardMaterial {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const r = (baseColor >> 16) & 0xff;
  const g = (baseColor >> 8) & 0xff;
  const b = baseColor & 0xff;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Grain: random dark/light specks
  for (let i = 0; i < size * size * 0.25; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const v = (Math.random() - 0.5) * 28;
    const cr = Math.max(0, Math.min(255, r + v));
    const cg = Math.max(0, Math.min(255, g + v));
    const cb = Math.max(0, Math.min(255, b + v));
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.55)`;
    ctx.fillRect(x, y, Math.random() < 0.5 ? 2 : 1, Math.random() < 0.5 ? 2 : 1);
  }

  // Subtle horizontal mortar lines (limestone block rows)
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = `rgb(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)})`;
  for (let y = 0; y < size; y += 14 + Math.floor(Math.random() * 4)) {
    ctx.fillRect(0, y, size, 1);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);

  return new THREE.MeshStandardMaterial({ map: tex, roughness });
}

// Concrete (asphalt / skate surface) — darker, smoother grain
export function createConcreteMaterial(baseColor: number): THREE.MeshStandardMaterial {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const r = (baseColor >> 16) & 0xff;
  const g = (baseColor >> 8) & 0xff;
  const b = baseColor & 0xff;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < size * size * 0.15; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const v = (Math.random() - 0.5) * 18;
    const cr = Math.max(0, Math.min(255, r + v));
    const cg = Math.max(0, Math.min(255, g + v));
    const cb = Math.max(0, Math.min(255, b + v));
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.4)`;
    ctx.fillRect(x, y, 1, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);

  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
}
