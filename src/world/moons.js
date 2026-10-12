import * as THREE from 'three';
import { rng } from '../utils/noise.js';

const SKY_DISTANCE = 900;

// Irregular "potato-shaped" moons: a deformed sphere.
function moonGeometry(radius, seed, stretch) {
  const rand = rng(seed);
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 12 }, () => ({
    dir: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
    size: 0.15 + rand() * 0.25,
    depth: 0.04 + rand() * 0.06,
  }));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let k = 1;
    for (const b of bumps) {
      const d = v.distanceTo(b.dir);
      if (d < b.size) k -= b.depth * (1 - d / b.size); // craters
    }
    v.multiplyScalar(radius * k);
    v.x *= stretch;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Lit by the true sun direction (even when the sun is below our horizon), so they show phases
function moonMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, color: { value: new THREE.Color(0xb8a090) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.999995; // just in front of the stars, behind the skyline
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, color;
      varying vec3 vNormal;
      void main() {
        float light = max(dot(normalize(vNormal), sunDir), 0.0);
        gl_FragColor = vec4(color * (0.04 + 1.1 * light), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createMoons() {
  const group = new THREE.Group();
  const mat = moonMaterial();

  // Sizes are exaggerated ~10× so they read on screen: from the surface Phobos spans ~0.2°
  // and Deimos looks almost like a bright star.
  const phobos = new THREE.Mesh(moonGeometry(16, 7, 1.35), mat);
  phobos.rotation.set(0.4, 0.8, 0.2);
  const deimos = new THREE.Mesh(moonGeometry(6, 13, 1.15), mat);

  group.add(phobos, deimos);
  group.userData = { phobos, deimos };
  return group;
}

// sky: output of skyAt(), with the moons' directions and the sun direction
export function updateMoons(group, camera, sky, t) {
  const { phobos, deimos } = group.userData;
  group.position.copy(camera.position);
  for (const [name, moon] of [['phobos', phobos], ['deimos', deimos]]) {
    const dir = sky.moons[name];
    moon.position.copy(dir).multiplyScalar(SKY_DISTANCE);
    moon.visible = dir.y > -0.03;
  }
  phobos.material.uniforms.sunDir.value.copy(sky.sunDir);
  phobos.rotation.y = 0.8 + t * 0.05;
  deimos.rotation.y = t * 0.02;
}
