import type { City, Round, SavedProgress } from "./types.ts";
import { antipode, nearestCity } from "./geo.ts";

export const ROUNDS = 8;

const SIGNATURES = new Set([
  "Chicago",
  "Shanghai",
  "Perth",
  "Madrid",
  "Lima",
  "Honolulu",
  "Auckland",
  "Christchurch",
  "Quito",
  "Santiago",
  "Wellington",
  "Hong Kong",
  "Buenos Aires",
  "Singapore",
  "New York",
  "Tokyo",
  "London",
]);

type Rng = () => number;

export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function hashString(str: string) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rng: Rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function catalog(cities: City[]): Round[] {
  const pool: Round[] = [];
  for (const city of cities) {
    const opposite = antipode(city);
    const nearest = nearestCity(opposite, cities, city.id);
    if (!nearest.city || nearest.distance >= 3400) continue;
    pool.push({
      city,
      antipode: opposite,
      best: nearest.city,
      bestDist: nearest.distance,
    });
  }
  return pool;
}

export function pickDailyRounds(cities: City[], dateKey: string, roundCount = ROUNDS) {
  const rng = mulberry32(hashString(`nadir:${dateKey}`));
  const pool = catalog(cities);
  const easy = shuffle(
    pool.filter((item) => item.bestDist < 800),
    rng
  );
  const mid = shuffle(
    pool.filter((item) => item.bestDist >= 800 && item.bestDist < 1800),
    rng
  );
  const hard = shuffle(
    pool.filter((item) => item.bestDist >= 1800),
    rng
  );
  const chosen: Round[] = [];
  const used = new Set<number>();

  function take(bucket: Round[], count: number) {
    const target = chosen.length + count;
    for (const item of bucket) {
      if (chosen.length >= target) break;
      if (used.has(item.city.id) || used.has(item.best.id)) continue;
      chosen.push(item);
      used.add(item.city.id);
      used.add(item.best.id);
    }
  }

  take(
    shuffle(
      pool.filter((item) => SIGNATURES.has(item.city.name)),
      rng
    ),
    3
  );
  take(easy, 2);
  take(mid, 2);
  take(hard, 2);
  take(shuffle(pool, rng), roundCount - chosen.length);
  return shuffle(chosen.slice(0, roundCount), rng);
}

function storageKey(dateKey: string) {
  return `nadir-${dateKey}`;
}

export function loadProgress(dateKey: string): SavedProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(dateKey));
    return raw ? (JSON.parse(raw) as SavedProgress) : null;
  } catch {
    return null;
  }
}

export function saveProgress(dateKey: string, payload: SavedProgress) {
  try {
    localStorage.setItem(storageKey(dateKey), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearProgress(dateKey: string) {
  try {
    localStorage.removeItem(storageKey(dateKey));
  } catch {
    /* ignore */
  }
}
