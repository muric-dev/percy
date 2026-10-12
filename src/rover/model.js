import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Modelo oficial de la NASA (NASA-3D-Resources), ya viene en metros.
const MODEL_URL = '/models/perseverance.glb';
const REAL_WIDTH = 2.7; // ancho real del rover (m); largo real 3 m sin brazo
const CAMERA_NAME = /cam|camera|watson/i;
const NOT_CAMERA = /cover|wiring|bracket/i;
const WHEEL_HALF_WIDTH = 0.2; // para centrar cada huella bajo su rueda

export async function loadRover() {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const { scene: model } = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL_URL);

  enableShadows(model);
  scaleToRealSize(model);
  const cameras = findCameras(model);
  console.log('Cámaras del rover:\n' + cameras.map((c) => '  · ' + c.name).join('\n'));

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

// Escala por el ancho real (el modelo de la NASA ya coincide) y apoya las ruedas en y = 0
function scaleToRealSize(model) {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const scale = REAL_WIDTH / size.x;
  model.scale.multiplyScalar(scale);

  const box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  const s = box.getSize(new THREE.Vector3());
  console.log(`Escala aplicada al modelo de la NASA: ×${scale.toFixed(3)}`);
  console.log(`Perseverance: ${s.x.toFixed(2)} m ancho × ${s.z.toFixed(2)} m largo (con brazo) × ${s.y.toFixed(2)} m alto`);
}

// Piezas que son cámaras (las usaremos más adelante)
function findCameras(model) {
  const cameras = [];
  model.traverse((o) => {
    if (CAMERA_NAME.test(o.name) && !NOT_CAMERA.test(o.name)) cameras.push(o);
  });
  return cameras;
}

// Distancia del centro a cada fila de ruedas, para colocar las huellas
function measureTrackHalfWidth(model) {
  const wheels = model.getObjectByName('Wheels_objs') ?? model;
  const box = new THREE.Box3().setFromObject(wheels);
  return (box.max.x - box.min.x) / 2 - WHEEL_HALF_WIDTH;
}
