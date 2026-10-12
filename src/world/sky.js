import * as THREE from 'three';
import { DUST_COLOR, SUN_DIRECTION } from '../config.js';

// Cielo marciano de tarde: caramelo en el horizonte, marrón polvoriento arriba
// y el característico halo azulado alrededor del sol.
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIRECTION },
      horizon: { value: new THREE.Color(DUST_COLOR) },
      zenith: { value: new THREE.Color(0x5a3424) },
      halo: { value: new THREE.Color(0x9ab4c4) },
      sunColor: { value: new THREE.Color(0xfff2dc) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, horizon, zenith, halo, sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.55));
        float s = max(dot(d, sunDir), 0.0);
        // Resplandor cálido amplio por el polvo
        col += vec3(1.0, 0.62, 0.32) * pow(s, 8.0) * 0.25;
        // Halo azul del atardecer marciano
        col = mix(col, halo, pow(s, 60.0) * 0.45);
        // Disco solar (más pequeño que en la Tierra)
        col += sunColor * smoothstep(0.9993, 0.9997, s) * 2.5;
        col += sunColor * pow(s, 900.0) * 0.8;
        // Bajo el horizonte, mismo tono que la niebla
        col = mix(col, horizon, smoothstep(0.0, -0.05, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
