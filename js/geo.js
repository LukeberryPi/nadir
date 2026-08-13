const Geo = (() => {
  const EARTH_KM = 6371;
  const INNER_CORE = 1220;
  const OUTER_CORE = 3480;
  const LOWER_MANTLE = 5701;
  const UPPER_MANTLE = 6341;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  function haversine(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const h =
      sinLat * sinLat +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function antipode(city) {
    let lon = city.lon + 180;
    if (lon > 180) lon -= 360;
    return { lat: -city.lat, lon };
  }

  function centralAngle(a, b) {
    return haversine(a, b) / EARTH_KM;
  }

  function chordMissKm(a, b) {
    const theta = centralAngle(a, b);
    return EARTH_KM * Math.cos(theta / 2);
  }

  function layerName(missKm) {
    if (missKm < INNER_CORE) return "Inner core";
    if (missKm < OUTER_CORE) return "Outer core";
    if (missKm < LOWER_MANTLE) return "Lower mantle";
    if (missKm < UPPER_MANTLE) return "Upper mantle";
    return "Crust";
  }

  function formatCoord(lat, lon) {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`;
  }

  function formatKm(km) {
    return `${Math.round(km).toLocaleString("en-US")} km`;
  }

  function oceanName(point) {
    const { lat, lon } = point;
    if (lat > 66) return "the Arctic Ocean";
    if (lat < -60) return "the Southern Ocean";
    if (lon > 20 && lon < 145 && lat < 30 && lat > -60) {
      if (lon < 100 || lat < 10) return "the Indian Ocean";
    }
    if (lon > 100 || lon < -70) {
      if (!(lon > -70 && lon < 20)) return "the Pacific Ocean";
    }
    if (lon > -70 && lon < 20) return "the Atlantic Ocean";
    return "open ocean";
  }

  function nearestCity(point, cities, excludeId) {
    let best = null;
    let bestD = Infinity;
    for (const city of cities) {
      if (city.id === excludeId) continue;
      const d = haversine(point, city);
      if (d < bestD) {
        bestD = d;
        best = city;
      }
    }
    return { city: best, distance: bestD };
  }

  function scoreGuess(guessDist, bestDist) {
    const waste = Math.max(0, guessDist - bestDist);
    return Math.round(1000 * Math.exp(-waste / 1400));
  }

  return {
    EARTH_KM,
    INNER_CORE,
    OUTER_CORE,
    LOWER_MANTLE,
    UPPER_MANTLE,
    haversine,
    antipode,
    centralAngle,
    chordMissKm,
    layerName,
    formatCoord,
    formatKm,
    oceanName,
    nearestCity,
    scoreGuess,
    toDeg,
  };
})();

if (typeof module !== "undefined") module.exports = Geo;
