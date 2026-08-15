import { describe, expect, test } from "bun:test";
import { CITIES } from "../src/cities.ts";
import { pickDailyRounds } from "../src/daily.ts";
import { emptyScore } from "../src/geo.ts";
import { formatResults } from "../src/share.ts";

describe("daily puzzle", () => {
  test("the same UTC date always yields the same eight city ids", () => {
    const a = pickDailyRounds(CITIES, "2026-08-15");
    const b = pickDailyRounds(CITIES, "2026-08-15");
    expect(a).toHaveLength(8);
    expect(a.map((row) => row.city.id)).toEqual(b.map((row) => row.city.id));
  });

  test("a different date yields a different set", () => {
    const a = pickDailyRounds(CITIES, "2026-08-15").map((row) => row.city.id);
    const b = pickDailyRounds(CITIES, "2026-08-16").map((row) => row.city.id);
    expect(a).not.toEqual(b);
  });

  test("no city is used twice in a day", () => {
    const rounds = pickDailyRounds(CITIES, "2026-08-15");
    const ids = rounds.flatMap((row) => [row.city.id, row.best.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("share text", () => {
  test("includes the date and the total score", () => {
    const chicago = CITIES.find((place) => place.name === "Chicago");
    const perth = CITIES.find((place) => place.name === "Perth" && place.country === "Australia");
    const london = CITIES.find((place) => place.name === "London");
    if (!chicago || !perth || !london) throw new Error("missing cities");
    const text = formatResults({
      dateKey: "2026-08-15",
      score: 6240,
      maxScore: 8000,
      history: [
        {
          from: chicago,
          guess: perth,
          points: 1000,
          tally: { city: true, country: true, continent: true },
          skipped: false,
        },
        {
          from: london,
          guess: null,
          points: 0,
          tally: emptyScore(),
          skipped: true,
        },
      ],
    });
    expect(text).toContain("Nadir 2026-08-15");
    expect(text).toContain("6,240/8,000");
    expect(text).toContain("Chicago → Perth");
    expect(text).toContain("1000");
  });
});
