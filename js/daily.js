const Daily = (() => {
  const ROUNDS = 8;
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

  function utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function formatDateLabel(key) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function catalog(cities, geo) {
    return cities
      .map((city) => {
        const antipode = geo.antipode(city);
        const nearest = geo.nearestCity(antipode, cities, city.id);
        return {
          city,
          antipode,
          best: nearest.city,
          bestDist: nearest.distance,
        };
      })
      .filter((entry) => entry.best && entry.bestDist < 3400);
  }

  function pickDailyRounds(cities, geo, dateKey, roundCount = ROUNDS) {
    const rng = mulberry32(hashString(`nadir:${dateKey}`));
    const pool = catalog(cities, geo);
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
    const chosen = [];
    const used = new Set();

    function take(bucket, count) {
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

  function storageKey(dateKey) {
    return `nadir-${dateKey}`;
  }

  function loadProgress(dateKey) {
    try {
      const raw = localStorage.getItem(storageKey(dateKey));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveProgress(dateKey, payload) {
    try {
      localStorage.setItem(storageKey(dateKey), JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function clearProgress(dateKey) {
    try {
      localStorage.removeItem(storageKey(dateKey));
    } catch {
      /* ignore */
    }
  }

  return {
    ROUNDS,
    utcDateKey,
    formatDateLabel,
    hashString,
    pickDailyRounds,
    loadProgress,
    saveProgress,
    clearProgress,
  };
})();

if (typeof module !== "undefined") module.exports = Daily;
