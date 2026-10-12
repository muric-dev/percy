import * as THREE from 'three';
import { ROVER_START } from './config.js';
import { createStage } from './core/stage.js';
import { updateAudio, isAudioOn, toggleSound, isMusicOn, toggleMusic } from './core/audio.js';
import { onPress } from './core/input.js';
import { createMarsClock } from './astro/clock.js';
import { altAz } from './astro/ephemeris.js';
import { createLights, updateLights } from './world/lighting.js';
import { createSky, updateSky, skyLook } from './world/sky.js';
import { createStarfield, updateStarfield } from './world/starfield.js';
import { createSkyGuide, updateSkyGuide } from './world/skyguide.js';
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
import { installMissionControl } from './mission/plugin.js';

const { renderer, scene, camera, controls, render } = createStage();

// Martian time: today's date, a full sol every 20 minutes. ?time=HH starts at another local hour.
const startHour = parseFloat(new URLSearchParams(location.search).get('time'));
const clock = createMarsClock(Number.isFinite(startHour) ? { startLocalTime: startHour } : {});

// Scenery
const lights = createLights();
const skyDome = createSky();
const starfield = createStarfield(clock.sky.planets);
const skyGuide = createSkyGuide(clock.sky.planets);
const moons = createMoons();
const dust = createDust();
const tracks = createTracks();
const horizon = createHorizon();
const terrain = createTerrain();
scene.add(lights.sun, lights.sun.target, lights.sky, skyDome, starfield, skyGuide, horizon, terrain, createRocks(), moons, dust, tracks);

const $ = (id) => document.getElementById(id);
const minimap = createMinimap($('minimap'), $('map-info'), terrain);
const skymap = createSkymap($('skymap'), $('sky-info'));
const clockHud = createClockHud($('clock'));
const boostLabel = $('boost');
installMissionControl(); // real Perseverance telemetry on the right (T hides it)

// Sound button (and M): its clicks must not reach the "any gesture starts audio" listeners
const soundButton = $('sound');
['pointerdown', 'pointerup', 'touchend'].forEach((type) => soundButton.addEventListener(type, (e) => e.stopPropagation()));
soundButton.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSound();
  soundButton.blur(); // keep Space/Enter from re-triggering it
});
onPress('KeyM', toggleSound);
onPress('KeyN', toggleMusic);
const musicLabel = $('music');
let soundShown = false;

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
    updateAudio(dt, drive, { distance: camera.position.distanceTo(rover.position), daylight: look.daylight });
    boostLabel.textContent = drive.boost ? 'ON' : 'off';
    boostLabel.classList.toggle('on', drive.boost);
    musicLabel.textContent = isMusicOn() ? 'on' : 'off';
  }
  if (isAudioOn() !== soundShown) {
    soundShown = isAudioOn();
    soundButton.textContent = soundShown ? '🔊 Sound: on' : '🔇 Sound: off';
    soundButton.classList.toggle('off', !soundShown);
  }
  updateLights(lights, controls.target, sky.sunDir, sunAlt, look);

  controls.update();
  updateHorizon(horizon, camera, look);
  updateStarfield(starfield, camera, sky, look.stars);
  updateSkyGuide(skyGuide, camera, sky, look.stars);
  updateMoons(moons, camera, sky, t);
  render();
});
