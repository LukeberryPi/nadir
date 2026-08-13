(() => {
  const ROUNDS = 8;
  const CX = 160;
  const CY = 160;
  const R = 132;

  const screens = {
    intro: document.getElementById("screen-intro"),
    play: document.getElementById("screen-play"),
    finale: document.getElementById("screen-finale"),
  };

  const els = {
    begin: document.getElementById("btn-begin"),
    roundMark: document.getElementById("round-mark"),
    runningScore: document.getElementById("running-score"),
    fromName: document.getElementById("from-name"),
    fromMeta: document.getElementById("from-meta"),
    form: document.getElementById("guess-form"),
    input: document.getElementById("guess-input"),
    suggest: document.getElementById("suggest-list"),
    error: document.getElementById("guess-error"),
    skip: document.getElementById("btn-skip"),
    reveal: document.getElementById("reveal"),
    toName: document.getElementById("to-name"),
    toMeta: document.getElementById("to-meta"),
    verdict: document.getElementById("verdict"),
    points: document.getElementById("points"),
    scoreBreak: document.getElementById("score-break"),
    next: document.getElementById("btn-next"),
    lines: document.getElementById("planet-lines"),
    dots: document.getElementById("planet-dots"),
    finaleScore: document.getElementById("finale-score"),
    finaleLine: document.getElementById("finale-line"),
    tunnels: document.getElementById("tunnels"),
    again: document.getElementById("btn-again"),
  };

  const state = {
    rounds: [],
    index: 0,
    score: 0,
    history: [],
    selected: null,
    activeSuggest: -1,
    matches: [],
  };

  function show(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function polar(angle) {
    return {
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  }

  function catalog() {
    return CITIES.map((city) => {
      const antipode = Geo.antipode(city);
      const nearest = Geo.nearestCity(antipode, CITIES, city.id);
      return {
        city,
        antipode,
        best: nearest.city,
        bestDist: nearest.distance,
      };
    }).filter((entry) => entry.best && entry.bestDist < 3400);
  }

  function pickRounds() {
    const pool = catalog();
    const easy = shuffle(pool.filter((p) => p.bestDist < 800));
    const mid = shuffle(pool.filter((p) => p.bestDist >= 800 && p.bestDist < 1800));
    const hard = shuffle(pool.filter((p) => p.bestDist >= 1800));
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

    const signatures = new Set([
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
    take(shuffle(pool.filter((p) => signatures.has(p.city.name))), 3);
    take(easy, 2);
    take(mid, 2);
    take(hard, 2);
    take(shuffle(pool), ROUNDS - chosen.length);

    return shuffle(chosen.slice(0, ROUNDS));
  }

  function normalize(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function searchCities(query) {
    const q = normalize(query);
    if (q.length < 1) return [];
    const promptId = state.rounds[state.index].city.id;
    const scored = [];
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

  function setSuggest(matches) {
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

  function moveSuggest(delta) {
    if (!state.matches.length) return;
    state.activeSuggest =
      (state.activeSuggest + delta + state.matches.length) % state.matches.length;
    [...els.suggest.querySelectorAll(".suggest-item")].forEach((btn, i) => {
      btn.setAttribute("aria-selected", i === state.activeSuggest ? "true" : "false");
    });
    const active = state.matches[state.activeSuggest];
    els.input.setAttribute("aria-activedescendant", `suggest-${active.id}`);
  }

  function chooseCity(city) {
    state.selected = city;
    els.input.value = city.label;
    setSuggest([]);
    els.error.hidden = true;
    els.input.focus();
  }

  function findExact(value) {
    const q = normalize(value);
    const promptId = state.rounds[state.index].city.id;
    const hits = CITIES.filter((city) => {
      if (city.id === promptId) return false;
      return (
        normalize(city.label) === q ||
        normalize(city.name) === q ||
        city.search.startsWith(`${q},`)
      );
    });
    return hits;
  }

  function drawPlanet(prompt, guess, best, revealed) {
    const start = polar(-Math.PI / 2);
    const officialAngle =
      revealed && best
        ? -Math.PI / 2 + Geo.centralAngle(prompt, best)
        : Math.PI / 2;
    const officialEnd = polar(officialAngle);
    const guessAngle = guess
      ? -Math.PI / 2 + Geo.centralAngle(prompt, guess)
      : officialAngle;
    const guessEnd = polar(guessAngle);

    const guessLen = Math.hypot(guessEnd.x - start.x, guessEnd.y - start.y).toFixed(1);
    const officialPath = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${officialEnd.x.toFixed(1)} ${officialEnd.y.toFixed(1)}`;
    const guessPath = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${guessEnd.x.toFixed(1)} ${guessEnd.y.toFixed(1)}`;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showGuessPath = revealed && guess && (!best || guess.id !== best.id);

    els.lines.innerHTML = `
      <path class="true-bore" d="${officialPath}"></path>
      ${
        showGuessPath
          ? `<path class="guess-bore" d="${guessPath}" style="stroke-dasharray:${guessLen};stroke-dashoffset:${guessLen}"></path>
             ${
               reduceMotion
                 ? ""
                 : `<circle class="spark" r="4" fill="#fff6df">
                      <animateMotion dur="1.05s" fill="freeze" path="${guessPath}" />
                    </circle>`
             }`
          : revealed && guess
            ? `<path class="guess-bore" d="${officialPath}" style="stroke-dasharray:${guessLen};stroke-dashoffset:${guessLen}"></path>
               ${
                 reduceMotion
                   ? ""
                   : `<circle class="spark" r="4" fill="#fff6df">
                        <animateMotion dur="1.05s" fill="freeze" path="${officialPath}" />
                      </circle>`
               }`
            : ""
      }
    `;

    const dots = [
      `<circle cx="${start.x}" cy="${start.y}" r="5.2" fill="#eef3f5"></circle>`,
    ];
    if (revealed && best) {
      dots.push(
        `<circle cx="${officialEnd.x}" cy="${officialEnd.y}" r="5.2" fill="#f3e2c0"></circle>`
      );
      if (showGuessPath) {
        dots.push(
          `<circle cx="${guessEnd.x}" cy="${guessEnd.y}" r="4" fill="#eef3f5" stroke="#3e7d8b" stroke-width="1.4"></circle>`
        );
      }
    } else {
      const idle = polar(Math.PI / 2);
      dots.push(
        `<circle cx="${idle.x}" cy="${idle.y}" r="4.4" fill="none" stroke="#eef3f5" stroke-width="1.4" stroke-dasharray="2 2"></circle>`
      );
    }
    els.dots.innerHTML = dots.join("");
  }

  function renderRound() {
    const round = state.rounds[state.index];
    const city = round.city;
    screens.play.classList.remove("is-revealed");
    els.roundMark.textContent = `${state.index + 1} of ${ROUNDS}`;
    els.runningScore.textContent = state.score.toLocaleString("en-US");
    els.fromName.textContent = city.name;
    els.fromMeta.textContent = `${Geo.formatCoord(city.lat, city.lon)}  ·  ${city.country}`;
    els.form.hidden = false;
    els.reveal.hidden = true;
    els.input.value = "";
    state.selected = null;
    setSuggest([]);
    els.error.hidden = true;
    drawPlanet(city, null, round.best, false);
    els.next.textContent = state.index === ROUNDS - 1 ? "See the tunnels" : "Next city";
    els.input.focus();
  }

  function describe(round, guess, tally, skipped) {
    const best = round.best;
    const opposite = `The opposite city is ${best.name}, ${best.country}.`;

    if (skipped) return opposite;

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

  function renderScoreBreak(tally) {
    const rows = [
      ["Continent", tally.parts.continent],
      ["Country", tally.parts.country],
      ["City", tally.parts.city],
    ];
    els.scoreBreak.innerHTML = "";
    rows.forEach(([label, value]) => {
      const li = document.createElement("li");
      if (!value) li.className = "is-miss";
      li.innerHTML = `<span>${label}</span><span>${value ? `+${value}` : "—"}</span>`;
      els.scoreBreak.appendChild(li);
    });
  }

  function reveal(guess, skipped) {
    const round = state.rounds[state.index];
    const tally = skipped || !guess ? Geo.emptyScore() : Geo.scoreGuess(guess, round.best);
    const official = round.best;

    state.score += tally.points;
    state.history.push({
      from: round.city,
      guess: guess,
      best: round.best,
      points: tally.points,
      tally,
      skipped,
    });

    screens.play.classList.add("is-revealed");
    els.form.hidden = true;
    els.reveal.hidden = false;
    els.toName.textContent = official.name;
    els.toMeta.textContent = `${Geo.formatCoord(official.lat, official.lon)}  ·  ${official.country}`;
    els.verdict.textContent = describe(round, guess, tally, skipped);
    renderScoreBreak(tally);
    els.points.textContent = skipped ? "Skipped" : `+${tally.points.toLocaleString("en-US")}`;
    els.runningScore.textContent = state.score.toLocaleString("en-US");
    drawPlanet(round.city, guess, official, true);
    els.next.focus();
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
        ? "That city isn’t in the atlas. Pick a larger one from the list."
        : "Name a city, then send it through.";
      return;
    }
    if (guess.id === state.rounds[state.index].city.id) {
      els.error.hidden = false;
      els.error.textContent = "That’s this side. Name the city that comes out the other end.";
      return;
    }
    reveal(guess, false);
  }

  function renderFinale() {
    show("finale");
    els.finaleScore.textContent = state.score.toLocaleString("en-US");
    const best = state.history.slice().sort((a, b) => b.points - a.points)[0];
    const hits = state.history.filter((h) => h.tally && h.tally.city).length;
    if (best && best.guess) {
      els.finaleLine.textContent =
        hits >= 4
          ? `You found ${hits} near-antipodes. Best tunnel: ${best.from.name} → ${best.guess.name}.`
          : `Best tunnel: ${best.from.name} → ${best.guess.name}. The planet is mostly water; that’s the whole joke.`;
    } else {
      els.finaleLine.textContent = "Eight empty boreholes. Try again — the atlas is patient.";
    }

    els.tunnels.innerHTML = "";
    state.history.forEach((row) => {
      const li = document.createElement("li");
      const named = row.skipped ? "Skipped" : row.guess.label;
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
  }

  function startGame() {
    state.rounds = pickRounds();
    state.index = 0;
    state.score = 0;
    state.history = [];
    show("play");
    renderRound();
  }

  els.begin.addEventListener("click", startGame);
  els.again.addEventListener("click", startGame);
  els.skip.addEventListener("click", () => reveal(null, true));
  els.next.addEventListener("click", () => {
    if (state.index >= ROUNDS - 1) {
      renderFinale();
      return;
    }
    state.index += 1;
    renderRound();
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
    if (!els.form.contains(event.target)) setSuggest([]);
  });
})();
