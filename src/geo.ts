import type { City, LatLon, ScoreTally } from "./types.ts";

const EARTH_KM = 6371;
const INNER_CORE = 1220;
const OUTER_CORE = 3480;
const LOWER_MANTLE = 5701;
const UPPER_MANTLE = 6341;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function haversine(a: LatLon, b: LatLon) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function antipode(city: LatLon): LatLon {
  let lon = city.lon + 180;
  if (lon > 180) lon -= 360;
  return { lat: -city.lat, lon };
}

export function centralAngle(a: LatLon, b: LatLon) {
  return haversine(a, b) / EARTH_KM;
}

export function chordMissKm(a: LatLon, b: LatLon) {
  const theta = centralAngle(a, b);
  return EARTH_KM * Math.cos(theta / 2);
}

export function layerName(missKm: number) {
  if (missKm < INNER_CORE) return "Inner core";
  if (missKm < OUTER_CORE) return "Outer core";
  if (missKm < LOWER_MANTLE) return "Lower mantle";
  if (missKm < UPPER_MANTLE) return "Upper mantle";
  return "Crust";
}

export function formatCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`;
}

export function formatKm(km: number) {
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

export function nearestCity(point: LatLon, cities: City[], excludeId?: number) {
  let best: City | null = null;
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

export const POINTS = {
  distance: 800,
  continent: 75,
  country: 125,
} as const;

const DISTANCE_SCALE_KM = 1400;
export const MAX_ROUND = POINTS.distance + POINTS.continent + POINTS.country;

export function emptyScore(): ScoreTally {
  return {
    continent: false,
    country: false,
    city: false,
    points: 0,
    parts: { distance: 0, continent: 0, country: 0 },
  };
}

export function scoreGuess(guess: City | null, official: City, antipodePoint: LatLon) {
  const result = emptyScore();
  if (!guess) return result;
  result.city = guess.id === official.id;
  result.country = result.city || guess.country === official.country;
  result.continent = result.country || guess.continent === official.continent;

  const bestDist = haversine(official, antipodePoint);
  const guessDist = haversine(guess, antipodePoint);
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

export const Geo = {
  EARTH_KM,
  INNER_CORE,
  OUTER_CORE,
  LOWER_MANTLE,
  UPPER_MANTLE,
  POINTS,
  MAX_ROUND,
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
