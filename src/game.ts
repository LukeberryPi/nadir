import { CITIES } from "./cities.ts";
import {
  ROUNDS,
  clearProgress,
  formatDateLabel,
  loadProgress,
  pickDailyRounds,
  saveProgress,
  utcDateKey,
} from "./daily.ts";
import {
  MAX_ROUND,
  emptyScore,
  formatCoord,
  scoreGuess,
} from "./geo.ts";
import { dispose, mount, reveal as revealGlobe, setPrompt } from "./globe.ts";
import { copy, formatResults, tweetUrl } from "./share.ts";
import type { City, HistoryRow, Round, SavedProgress, ScoreTally } from "./types.ts";

function must<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

type ScreenName = "intro" | "play" | "finale";

const screens: Record<ScreenName, HTMLElement> = {
  intro: must("screen-intro"),
  play: must("screen-play"),
  finale: must("screen-finale"),
};

const els = {
  begin: must<HTMLButtonElement>("btn-begin"),
  roundMark: must("round-mark"),
  runningScore: must("running-score"),
  fromName: must("from-name"),
  fromMeta: must("from-meta"),
  form: must<HTMLFormElement>("guess-form"),
  input: must<HTMLInputElement>("guess-input"),
  suggest: must<HTMLUListElement>("suggest-list"),
  error: must("guess-error"),
  skip: must<HTMLButtonElement>("btn-skip"),
  reveal: must("reveal"),
  toName: must("to-name"),
  toMeta: must("to-meta"),
  verdict: must("verdict"),
  points: must("points"),
  scoreBreak: must<HTMLUListElement>("score-break"),
  next: must<HTMLButtonElement>("btn-next"),
  globe: must<HTMLCanvasElement>("globe"),
  globeHint: must("globe-hint"),
  finaleScore: must("finale-score"),
  finaleCap: must("finale-cap"),
  finaleLine: must("finale-line"),
  tunnels: must<HTMLOListElement>("tunnels"),
  again: must<HTMLButtonElement>("btn-again"),
  copy: must<HTMLButtonElement>("btn-copy"),
  tweet: must<HTMLButtonElement>("btn-tweet"),
  shareStatus: must("share-status"),
};

const state = {
  dateKey: utcDateKey(),
  rounds: [] as Round[],
  index: 0,
  score: 0,
  history: [] as HistoryRow[],
  selected: null as City | null,
  activeSuggest: -1,
  matches: [] as City[],
  revealed: false,
  finished: false,
};

function show(name: ScreenName) {
  (Object.entries(screens) as [ScreenName, HTMLElement][]).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

function cityById(id: number) {
  return CITIES.find((city) => city.id === id) ?? null;
}

function persist() {
  saveProgress(state.dateKey, {
    index: state.index,
    score: state.score,
    revealed: state.revealed,
    finished: state.finished,
    history: state.history.map((row) => ({
      fromId: row.from.id,
      guessId: row.guess ? row.guess.id : null,
      bestId: row.best.id,
      points: row.points,
      tally: row.tally,
      skipped: row.skipped,
    })),
  });
}

function restoreHistory(saved: SavedProgress): HistoryRow[] {
  return (saved.history || [])
    .map((row) => {
      const from = cityById(row.fromId);
      const best = cityById(row.bestId);
      if (!from || !best) return null;
      return {
        from,
        guess: row.guessId == null ? null : cityById(row.guessId),
        best,
        points: row.points,
        tally: row.tally,
        skipped: row.skipped,
      };
    })
    .filter((row): row is HistoryRow => row !== null);
}

let globeQueue: Promise<void> = Promise.resolve();

function withGlobe(fn: () => Promise<void> | void) {
  globeQueue = globeQueue
    .then(async () => {
      await fn();
    })
    .catch(() => {});
  return globeQueue;
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchCities(query: string) {
  const q = normalize(query);
  if (q.length < 1) return [];
  const promptId = state.rounds[state.index].city.id;
  const scored: { city: City; weight: number }[] = [];
  for (const city of CITIES) {
    if (city.id === promptId) continue;
    const idx = city.search.indexOf(q);
    if (idx === -1) continue;
    const weight = (idx === 0 ? 0 : 20) + city.search.length;
    scored.push({ city, weight });
  }
  scored.sort((a, b) => a.weight - b.weight);
  return scored.slice(0, 8).map((row) => row.city);
}

function setSuggest(matches: City[]) {
  state.matches = matches;
  state.activeSuggest = matches.length ? 0 : -1;
  els.suggest.innerHTML = "";
  if (!matches.length) {
    els.suggest.hidden = true;
    els.input.setAttribute("aria-expanded", "false");
    return;
  }
  matches.forEach((city, i) => {
    const li = document.createElement("li");
    li.role = "option";
    li.id = `suggest-${city.id}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggest-item";
    btn.dataset.id = String(city.id);
    btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
    btn.innerHTML = `<strong>${city.name}</strong><span>${city.country}</span>`;
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      chooseCity(city);
    });
    li.appendChild(btn);
    els.suggest.appendChild(li);
  });
  els.suggest.hidden = false;
  els.input.setAttribute("aria-expanded", "true");
}

function moveSuggest(delta: number) {
  if (!state.matches.length) return;
  state.activeSuggest =
    (state.activeSuggest + delta + state.matches.length) % state.matches.length;
  [...els.suggest.querySelectorAll(".suggest-item")].forEach((btn, i) => {
    btn.setAttribute("aria-selected", i === state.activeSuggest ? "true" : "false");
  });
  const active = state.matches[state.activeSuggest];
  els.input.setAttribute("aria-activedescendant", `suggest-${active.id}`);
}

function chooseCity(city: City) {
  state.selected = city;
  els.input.value = city.label;
  setSuggest([]);
  els.error.hidden = true;
  els.input.focus();
}

function findExact(value: string) {
  const q = normalize(value);
  const promptId = state.rounds[state.index].city.id;
  return CITIES.filter((city) => {
    if (city.id === promptId) return false;
    return (
      normalize(city.label) === q ||
      normalize(city.name) === q ||
      city.search.startsWith(`${q},`)
    );
  });
}

function renderRound() {
  const round = state.rounds[state.index];
  const city = round.city;
  state.revealed = false;
  screens.play.classList.remove("is-revealed");
  els.roundMark.textContent = `${formatDateLabel(state.dateKey)} · ${state.index + 1} of ${ROUNDS}`;
  els.runningScore.textContent = state.score.toLocaleString("en-US");
  els.fromName.textContent = city.name;
  els.fromMeta.textContent = `${formatCoord(city.lat, city.lon)}  ·  ${city.country}`;
  els.form.hidden = false;
  els.reveal.hidden = true;
  els.input.value = "";
  state.selected = null;
  setSuggest([]);
  els.error.hidden = true;
  els.globeHint.textContent = "Drag to turn";
  els.next.textContent = state.index === ROUNDS - 1 ? "See scores" : "Next city";
  withGlobe(async () => {
    await mount(els.globe);
    setPrompt(city);
  });
  els.input.focus();
}

function describe(round: Round, guess: City | null, tally: ScoreTally, skipped: boolean) {
  const best = round.best;
  const opposite = `The opposite city is ${best.name}, ${best.country}.`;

  if (skipped || !guess) return opposite;

  if (tally.city) {
    return `${opposite} You named it.`;
  }
  if (tally.country) {
    return `${opposite} You had the country. You named ${guess.name}.`;
  }
  if (tally.continent) {
    return `${opposite} You had the continent (${best.continent}). You named ${guess.label}.`;
  }
  return `${opposite} You named ${guess.label}.`;
}

function renderScoreBreak(tally: ScoreTally) {
  const rows: [string, number][] = [
    ["Distance", tally.parts.distance],
    ["Continent", tally.parts.continent],
    ["Country", tally.parts.country],
  ];
  els.scoreBreak.innerHTML = "";
  rows.forEach(([label, value]) => {
    const li = document.createElement("li");
    if (!value) li.className = "is-miss";
    li.innerHTML = `<span>${label}</span><span>${value ? `+${value}` : "—"}</span>`;
    els.scoreBreak.appendChild(li);
  });
}

function paintReveal(guess: City | null, skipped: boolean, tally: ScoreTally) {
  const round = state.rounds[state.index];
  const official = round.best;
  screens.play.classList.add("is-revealed");
  els.form.hidden = true;
  els.reveal.hidden = false;
  els.toName.textContent = official.name;
  els.toMeta.textContent = `${formatCoord(official.lat, official.lon)}  ·  ${official.country}`;
  els.verdict.textContent = describe(round, guess, tally, skipped);
  renderScoreBreak(tally);
  els.points.textContent = skipped ? "Skipped" : `+${tally.points.toLocaleString("en-US")}`;
  els.runningScore.textContent = state.score.toLocaleString("en-US");
  els.globeHint.textContent = "Green is the true opposite. Red is your guess.";
  state.revealed = true;
  withGlobe(async () => {
    await mount(els.globe);
    revealGlobe({
      prompt: round.city,
      official,
      guess,
      antipode: round.antipode,
    });
  });
  els.next.focus();
}

function reveal(guess: City | null, skipped: boolean) {
  const round = state.rounds[state.index];
  const tally = skipped || !guess ? emptyScore() : scoreGuess(guess, round.best, round.antipode);

  state.score += tally.points;
  state.history.push({
    from: round.city,
    guess,
    best: round.best,
    points: tally.points,
    tally,
    skipped,
  });
  paintReveal(guess, skipped, tally);
  persist();
}

function submitGuess() {
  const typed = els.input.value.trim();
  let guess = state.selected;
  if (!guess && !els.suggest.hidden && state.activeSuggest >= 0) {
    guess = state.matches[state.activeSuggest];
  }
  if (!guess) {
    const hits = findExact(typed);
    if (hits.length === 1) guess = hits[0];
    else if (hits.length > 1) {
      els.error.hidden = false;
      els.error.textContent = "Several cities share that name. Pick one from the list.";
      setSuggest(hits);
      return;
    }
  }
  if (!guess) {
    els.error.hidden = false;
    els.error.textContent = typed
      ? "That city isn’t in the list. Try a larger one."
      : "Name a city first.";
    return;
  }
  if (guess.id === state.rounds[state.index].city.id) {
    els.error.hidden = false;
    els.error.textContent = "That’s this city. Name the one on the other side.";
    return;
  }
  reveal(guess, false);
}

function shareText() {
  return formatResults({
    dateKey: state.dateKey,
    score: state.score,
    maxScore: MAX_ROUND * ROUNDS,
    history: state.history,
  });
}

function renderFinale() {
  state.finished = true;
  persist();
  withGlobe(() => dispose());
  show("finale");
  els.finaleScore.textContent = state.score.toLocaleString("en-US");
  els.finaleCap.textContent = `of ${(MAX_ROUND * ROUNDS).toLocaleString("en-US")} · ${formatDateLabel(state.dateKey)}`;
  const best = state.history.slice().sort((a, b) => b.points - a.points)[0];
  const hits = state.history.filter((row) => row.tally && row.tally.city).length;
  if (best && best.guess) {
    els.finaleLine.textContent =
      hits >= 4
        ? `You got ${hits} cities right. Best round: ${best.from.name} → ${best.guess.name}.`
        : `Best round: ${best.from.name} → ${best.guess.name}.`;
  } else {
    els.finaleLine.textContent = "No guesses this time.";
  }

  els.tunnels.innerHTML = "";
  state.history.forEach((row) => {
    const li = document.createElement("li");
    const named = row.skipped || !row.guess ? "Skipped" : row.guess.label;
    const pair = document.createElement("p");
    pair.className = "tunnel-pair";
    pair.textContent = `${row.from.name}  →  ${named}`;
    const pts = document.createElement("p");
    pts.className = "tunnel-pts";
    pts.textContent = row.skipped ? "—" : row.points.toLocaleString("en-US");
    const meta = document.createElement("p");
    meta.className = "tunnel-meta";
    meta.textContent = `Opposite: ${row.best.label}`;
    li.append(pair, pts, meta);
    els.tunnels.appendChild(li);
  });
  els.shareStatus.hidden = true;
}

export function startGame({ replay }: { replay?: boolean } = {}) {
  state.dateKey = utcDateKey();
  state.rounds = pickDailyRounds(CITIES, state.dateKey, ROUNDS);
  const saved = replay ? null : loadProgress(state.dateKey);
  if (saved && saved.history && saved.history.length) {
    state.history = restoreHistory(saved);
    state.score = saved.score || 0;
    state.index = Math.min(saved.index || 0, ROUNDS - 1);
    state.finished = Boolean(saved.finished);
    if (state.finished) {
      renderFinale();
      return;
    }
    show("play");
    renderRound();
    if (saved.revealed) {
      const last = state.history[state.history.length - 1];
      if (last) paintReveal(last.guess, last.skipped, last.tally || emptyScore());
    }
    return;
  }
  state.index = 0;
  state.score = 0;
  state.history = [];
  state.revealed = false;
  state.finished = false;
  show("play");
  renderRound();
}

export function bindGame() {
  els.begin.addEventListener("click", () => startGame());
  els.again.addEventListener("click", () => {
    clearProgress(state.dateKey);
    startGame({ replay: true });
  });
  els.skip.addEventListener("click", () => reveal(null, true));
  els.next.addEventListener("click", () => {
    if (state.index >= ROUNDS - 1) {
      renderFinale();
      return;
    }
    state.index += 1;
    state.revealed = false;
    persist();
    renderRound();
  });
  els.copy.addEventListener("click", async () => {
    const ok = await copy(shareText());
    els.shareStatus.hidden = false;
    els.shareStatus.textContent = ok
      ? "Copied."
      : "Couldn’t copy. Select the results and copy them yourself.";
  });
  els.tweet.addEventListener("click", () => {
    window.open(tweetUrl(shareText()), "_blank", "noopener,noreferrer");
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitGuess();
  });

  els.input.addEventListener("input", () => {
    state.selected = null;
    setSuggest(searchCities(els.input.value));
    els.error.hidden = true;
  });

  els.input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSuggest(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSuggest(-1);
    } else if (event.key === "Escape") {
      setSuggest([]);
    }
  });

  document.addEventListener("click", (event) => {
    if (!els.form.contains(event.target as Node)) setSuggest([]);
  });
}
