// Provider for NASA's drive history: every place Perseverance stopped to localize itself,
// published by JPL for the public Mars 2020 map (MMGIS). Fetched live; the file is one
// GeoJSON point per stop, with the sol, distance driven, ground elevation and rover attitude.
const URL = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json';
const NO_DATA = -9999;

// Each channel picks one series out of the stops
const SERIES = {
  // Mid-drive stops report dist_total_m = 0, so the total is the running sum of each leg
  distance: (stops) => {
    let meters = 0;
    return stops.map((s) => ({ sol: s.sol, value: (meters += s.dist_m || 0) / 1000 }));
  },
  elevation: (stops) => stops.map((s) => ({ sol: s.sol, value: s.elev_geoid })),
  tilt: (stops) => stops.map((s) => ({ sol: s.sol, value: s.tilt })),
};

export function createWaypointsProvider() {
  let stops = null; // one download shared by every channel

  function load() {
    stops ??= fetch(URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => geojson.features.map((f) => f.properties).sort((a, b) => a.sol - b.sol));
    return stops;
  }

  return {
    key: 'nasa-waypoints',
    name: 'NASA/JPL drive history',
    async request(channel) {
      const points = SERIES[channel.key](await load());
      return points.filter((p) => Number.isFinite(p.value) && p.value !== NO_DATA);
    },
  };
}
