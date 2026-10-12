import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Official NASA model (NASA-3D-Resources), already in meters.
const MODEL_URL = '/models/perseverance.glb';
const REAL_WIDTH = 2.7; // real rover width (m); real length is 3 m without the arm
const CAMERA_NAME = /cam|camera|watson/i;
const NOT_CAMERA = /cover|wiring|bracket/i;
const WHEEL_HALF_WIDTH = 0.2; // to center each track mark under its wheel

export async function loadRover() {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const { scene: model } = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL_URL);

  enableShadows(model);
  scaleToRealSize(model);
  const cameras = findCameras(model);
  console.log('Rover cameras:\n' + cameras.map((c) => '  · ' + c.name).join('\n'));

  const rover = new THREE.Group();
  rover.add(model);
  rover.userData = { cameras, trackHalfWidth: measureTrackHalfWidth(model) };
  return rover;
}

function enableShadows(model) {
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
}

// Scales to the real width (the NASA model already matches) and rests the wheels at y = 0
function scaleToRealSize(model) {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const scale = REAL_WIDTH / size.x;
  model.scale.multiplyScalar(scale);

  const box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  const s = box.getSize(new THREE.Vector3());
  console.log(`Scale applied to the NASA model: ×${scale.toFixed(3)}`);
  console.log(`Perseverance: ${s.x.toFixed(2)} m wide × ${s.z.toFixed(2)} m long (with arm) × ${s.y.toFixed(2)} m tall`);
}

// Parts that are cameras (to be used later)
function findCameras(model) {
  const cameras = [];
  model.traverse((o) => {
    if (CAMERA_NAME.test(o.name) && !NOT_CAMERA.test(o.name)) cameras.push(o);
  });
  return cameras;
}

// Distance from the center to each row of wheels, to place the tracks
function measureTrackHalfWidth(model) {
  const wheels = model.getObjectByName('Wheels_objs') ?? model;
  const box = new THREE.Box3().setFromObject(wheels);
  return (box.max.x - box.min.x) / 2 - WHEEL_HALF_WIDTH;
}
