// The four channels on the mission control panel: what each one measures, in which unit,
// who provides it and a plain-words sentence about what the current value means.
// meaning(value, points) gets the latest value and the whole mission series.
const MARATHON_KM = 42.195;
const mmss = (minutes) => `${Math.floor(minutes)} min ${Math.round((minutes % 1) * 60)} s`;

export const CHANNELS = [
  {
    key: 'distance',
    name: 'Distance driven',
    unit: 'km',
    decimals: 2,
    provider: 'nasa-waypoints',
    meaning: (km) => `All Percy has driven since landing: ${(km / MARATHON_KM).toFixed(2)} marathons, slower than a walk.`,
  },
  {
    key: 'elevation',
    name: 'Terrain elevation',
    unit: 'm',
    decimals: 0,
    provider: 'nasa-waypoints',
    meaning: (m, points) =>
      `Ground height vs. Mars's average level (there is no sea). Up ${Math.round(m - points[0].value)} m since landing, onto the crater rim.`,
  },
  {
    key: 'tilt',
    name: 'Rover tilt',
    unit: '°',
    decimals: 1,
    provider: 'nasa-waypoints',
    meaning: (deg) =>
      `How much Percy leans where it parked: ${deg < 5 ? 'almost flat' : deg < 15 ? 'a gentle slope' : 'a steep slope'}. Drivers keep it under ~30°.`,
  },
  {
    key: 'lightTime',
    name: 'Earth–Mars light time',
    unit: 'min',
    decimals: 3,
    provider: 'light-time',
    meaning: (minutes) =>
      `A command from Earth takes ${mmss(minutes)} to arrive: no live joystick… except yours.`,
  },
];
