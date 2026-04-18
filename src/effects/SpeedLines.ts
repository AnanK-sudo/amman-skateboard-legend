import * as THREE from 'three';

export class SpeedLines {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(camera: THREE.PerspectiveCamera) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        intensity: { value: 0 },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float intensity;
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);

          // Radial lines
          float lines = abs(sin(angle * 20.0 + time * 3.0));
          lines = smoothstep(0.85, 1.0, lines);

          // Only show at edges (not center)
          float edgeMask = smoothstep(0.25, 0.5, dist);

          float alpha = lines * edgeMask * intensity * 0.3;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999;
  }

  getMesh(): THREE.Mesh { return this.mesh; }

  update(delta: number, speedRatio: number): void {
    this.material.uniforms.intensity.value = Math.max(0, (speedRatio - 0.5) * 2); // only above 50% speed
    this.material.uniforms.time.value += delta;
  }
}
