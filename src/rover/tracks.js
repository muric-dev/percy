import * as THREE from 'three';
import { groundHeight, groundNormal } from '../world/terrain.js';
import { canvasTexture } from '../utils/textures.js';
import { yawOf } from '../utils/math.js';

const MAX = 6000; // stored track marks (ring buffer)
const SPACING = 0.3; // meters between marks
const TREAD_WIDTH = 0.42;
const LIFT = 0.02; // offset from the ground to avoid z-fighting

// Tread pattern: Perseverance's wheels have chevron-shaped "grousers"
const treadTexture = () =>
  canvasTexture(64, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(6, 0, 52, 64);
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.lineWidth = 7;
    for (let y = -16; y < 80; y += 21) {
      g.beginPath();
      g.moveTo(8, y + 10);
      g.lineTo(32, y);
      g.lineTo(56, y + 10);
      g.stroke();
    }
  });

export function createTracks() {
  const geo = new THREE.PlaneGeometry(TREAD_WIDTH, SPACING * 1.05);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a2312,
    map: treadTexture(),
    transparent: true,
    depthWrite: false,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData = { next: 0, last: null };
  return mesh;
}

// Leaves two marks (left and right wheels) every SPACING meters traveled
export function updateTracks(tracks, rover) {
  const d = tracks.userData;
  const { x, z } = rover.position;
  if (!d.last) d.last = rover.position.clone();
  if (Math.hypot(x - d.last.x, z - d.last.z) < SPACING) return;

  const yaw = yawOf(rover);
  const half = rover.userData.trackHalfWidth;
  const sx = Math.cos(yaw) * half, sz = -Math.sin(yaw) * half;
  stamp(tracks, x + sx, z + sz, yaw);
  stamp(tracks, x - sx, z - sz, yaw);
  d.last.copy(rover.position);
}

const dummy = new THREE.Object3D(), normal = new THREE.Vector3();
function stamp(tracks, x, z, yaw) {
  dummy.position.set(x, groundHeight(x, z) + LIFT, z);
  dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, groundNormal(x, z, SPACING, normal));
  dummy.rotateY(yaw);
  dummy.updateMatrix();

  const d = tracks.userData;
  tracks.setMatrixAt(d.next, dummy.matrix);
  d.next = (d.next + 1) % MAX;
  tracks.count = Math.min(tracks.count + 1, MAX);
  tracks.instanceMatrix.needsUpdate = true;
}
