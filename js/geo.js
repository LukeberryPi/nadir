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

  const POINTS = {
    distance: 800,
    continent: 75,
    country: 125,
  };
  const DISTANCE_SCALE_KM = 1400;

  function emptyScore() {
    return {
      continent: false,
      country: false,
      city: false,
      points: 0,
      parts: { distance: 0, continent: 0, country: 0 },
    };
  }

  function scoreGuess(guess, official, antipode) {
    const result = emptyScore();
    if (!guess || !official || !antipode) return result;
    result.city = guess.id === official.id;
    result.country = result.city || guess.country === official.country;
    result.continent = result.country || guess.continent === official.continent;

    const bestDist = haversine(official, antipode);
    const guessDist = haversine(guess, antipode);
    const waste = Math.max(0, guessDist - bestDist);
    result.parts.distance = Math.round(POINTS.distance * Math.exp(-waste / DISTANCE_SCALE_KM));
    result.points += result.parts.distance;

    if (result.continent) {
      result.parts.continent = POINTS.continent;
      result.points += POINTS.continent;
    }
    if (result.country) {
      result.parts.country = POINTS.country;
      result.points += POINTS.country;
    }
    return result;
  }

  return {
    EARTH_KM,
    INNER_CORE,
    OUTER_CORE,
    LOWER_MANTLE,
    UPPER_MANTLE,
    POINTS,
    MAX_ROUND: POINTS.distance + POINTS.continent + POINTS.country,
    haversine,
    antipode,
    centralAngle,
    chordMissKm,
    layerName,
    formatCoord,
    formatKm,
    nearestCity,
    emptyScore,
    scoreGuess,
    toDeg,
  };
})();

if (typeof module !== "undefined") module.exports = Geo;
