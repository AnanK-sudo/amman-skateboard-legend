import * as THREE from 'three';

export function createOutlineMaterial(color = 0x000000, thickness = 0.03): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 pos = position + normal * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

export function addOutline(mesh: THREE.Mesh, color?: number, thickness?: number): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, createOutlineMaterial(color, thickness));
  outline.scale.copy(mesh.scale);
  mesh.add(outline);
  return outline;
}
