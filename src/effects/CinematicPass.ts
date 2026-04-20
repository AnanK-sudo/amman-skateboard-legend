import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Combined vignette + chromatic aberration post-processing pass.
// Set uSpeed (0–1) each frame to drive chromatic aberration intensity.
export function createCinematicPass(): ShaderPass {
  const shader = {
    name: 'CinematicShader',
    uniforms: {
      tDiffuse: { value: null },
      uSpeed:   { value: 0.0 },  // 0–1 driven from skater speed ratio
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float uSpeed;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;

        // Chromatic aberration — screen-edge distortion grows with speed
        float chromaticStrength = uSpeed * 0.012;
        vec2 dir = (uv - 0.5) * chromaticStrength;
        float r = texture2D(tDiffuse, uv + dir).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - dir).b;

        // Vignette — subtle dark ring at screen edges
        float dist = length(uv - 0.5) * 1.6;
        float vignette = smoothstep(1.0, 0.35, dist);
        vignette = mix(0.55, 1.0, vignette); // darken edges to ~55%

        gl_FragColor = vec4(vec3(r, g, b) * vignette, 1.0);
      }
    `,
  };

  return new ShaderPass(shader);
}
