import * as THREE from 'three';
import { ROVER_START } from './config.js';
import { createStage } from './core/stage.js';
import { updateAudio } from './core/audio.js';
import { createLights, aimSunAt } from './world/lighting.js';
import { createSky } from './world/sky.js';
import { createTerrain } from './world/terrain.js';
import { createRocks } from './world/rocks.js';
import { createMoons, updateMoons } from './world/moons.js';
import { createDust, updateDust } from './world/dust.js';
import { loadRover } from './rover/model.js';
import { createDriver } from './rover/driver.js';
import { createTracks, updateTracks } from './rover/tracks.js';
import { createFollowCamera } from './rover/followCamera.js';

const { renderer, scene, camera, controls, render } = createStage();

// Scenery
const { sun, sky } = createLights();
const moons = createMoons();
const dust = createDust();
const tracks = createTracks();
scene.add(sun, sun.target, sky, createSky(), createTerrain(), createRocks(), moons, dust, tracks);

// View while the rover loads
camera.position.set(ROVER_START.x + 5, 6, ROVER_START.z + 10);
controls.target.set(ROVER_START.x, 2, ROVER_START.z);

// Rover (loaded in the background)
let rover = null, driver = null, follow = null;
loadRover().then((model) => {
  rover = model;
  driver = createDriver(rover, ROVER_START);
  scene.add(rover);
  camera.position.set(ROVER_START.x - 7, rover.position.y + 2.2, ROVER_START.z + 5);
  follow = createFollowCamera(camera, controls, rover);
  window.__ready = true; // signal for npm run check
});

const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();

  updateDust(dust, dt, t);
  updateMoons(moons, t);
  if (rover) {
    const { speed, effort } = driver.update(dt);
    updateTracks(tracks, rover);
    follow.update(dt, speed);
    aimSunAt(sun, rover.position);
    updateAudio(effort);
  }

  controls.update();
  render();
});
