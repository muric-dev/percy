import * as THREE from 'three';
import { ROVER_START } from './config.js';
import { createStage } from './core/stage.js';
import { updateAudio } from './core/audio.js';
import { createMarsClock } from './astro/clock.js';
import { altAz } from './astro/ephemeris.js';
import { createLights, updateLights } from './world/lighting.js';
import { createSky, updateSky, skyLook } from './world/sky.js';
import { createStarfield, updateStarfield } from './world/starfield.js';
import { createTerrain } from './world/terrain.js';
import { createRocks } from './world/rocks.js';
import { createMoons, updateMoons } from './world/moons.js';
import { createDust, updateDust } from './world/dust.js';
import { createHorizon, updateHorizon } from './world/horizon.js';
import { loadRover } from './rover/model.js';
import { createDriver } from './rover/driver.js';
import { createTracks, updateTracks } from './rover/tracks.js';
import { createFollowCamera } from './rover/followCamera.js';
import { createWheels } from './rover/wheels.js';
import { createMinimap } from './ui/minimap.js';
import { createSkymap } from './ui/skymap.js';
import { createClockHud } from './ui/clockHud.js';

const { renderer, scene, camera, controls, render } = createStage();

// Martian time: today's date, a full sol every 20 minutes. ?time=HH starts at another local hour.
const startHour = parseFloat(new URLSearchParams(location.search).get('time'));
const clock = createMarsClock(Number.isFinite(startHour) ? { startLocalTime: startHour } : {});

// Scenery
const lights = createLights();
const skyDome = createSky();
const starfield = createStarfield(clock.sky.planets);
const moons = createMoons();
const dust = createDust();
const tracks = createTracks();
const horizon = createHorizon();
const terrain = createTerrain();
scene.add(lights.sun, lights.sun.target, lights.sky, skyDome, starfield, horizon, terrain, createRocks(), moons, dust, tracks);

const $ = (id) => document.getElementById(id);
const minimap = createMinimap($('minimap'), $('map-info'), terrain);
const skymap = createSkymap($('skymap'), $('sky-info'));
const clockHud = createClockHud($('clock'));
const boostLabel = $('boost');

// View while the rover loads
camera.position.set(ROVER_START.x + 5, 6, ROVER_START.z + 10);
controls.target.set(ROVER_START.x, 2, ROVER_START.z);

// Rover (loaded in the background), starting out facing the sun
let rover = null, driver = null, follow = null, wheels = null;
loadRover().then((model) => {
  rover = model;
  wheels = createWheels(rover); // before placing the rover: wheels are split in rover space
  const { sunDir } = clock.sky;
  driver = createDriver(rover, { ...ROVER_START, heading: Math.atan2(sunDir.x, sunDir.z) });
  scene.add(rover);
  follow = createFollowCamera(camera, controls, rover);
  window.__ready = true; // signal for npm run check
});

const timer = new THREE.Timer();
const look = skyLook(0);
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();

  // Sky and light for the current Martian time
  const sky = clock.update(dt);
  const sunAlt = altAz(sky.sunDir).alt;
  skyLook(sunAlt, look);
  scene.fog.color.copy(look.horizon);
  renderer.toneMappingExposure = 1.05 + 0.5 * (1 - look.daylight); // eyes adapting to the dark
  updateSky(skyDome, sky.sunDir, look);
  updateDust(dust, dt, t, look.daylight);
  skymap.update(dt, sky, look);
  clockHud.update(clock.status, sky.ltst);

  if (rover) {
    const drive = driver.update(dt);
    wheels.update(dt, drive);
    updateTracks(tracks, rover);
    follow.update(dt, drive.speed);
    minimap.update(rover, sky.sunDir);
    updateAudio(drive.effort, drive.event);
    boostLabel.textContent = drive.boost ? 'ON' : 'off';
    boostLabel.classList.toggle('on', drive.boost);
  }
  updateLights(lights, controls.target, sky.sunDir, sunAlt, look);

  controls.update();
  updateHorizon(horizon, camera, look);
  updateStarfield(starfield, camera, sky, look.stars);
  updateMoons(moons, camera, sky, t);
  render();
});
