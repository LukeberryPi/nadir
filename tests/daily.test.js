import { describe, expect, test } from "bun:test";
import Geo from "../js/geo.js";
import CITIES from "../js/cities.js";
import Daily from "../js/daily.js";
import Share from "../js/share.js";

describe("daily puzzle", () => {
  test("the same UTC date always yields the same eight city ids", () => {
    const a = Daily.pickDailyRounds(CITIES, Geo, "2026-08-15");
    const b = Daily.pickDailyRounds(CITIES, Geo, "2026-08-15");
    expect(a).toHaveLength(8);
    expect(a.map((row) => row.city.id)).toEqual(b.map((row) => row.city.id));
  });

  test("a different date yields a different set", () => {
    const a = Daily.pickDailyRounds(CITIES, Geo, "2026-08-15").map((row) => row.city.id);
    const b = Daily.pickDailyRounds(CITIES, Geo, "2026-08-16").map((row) => row.city.id);
    expect(a).not.toEqual(b);
  });

  test("no city is used twice in a day", () => {
    const rounds = Daily.pickDailyRounds(CITIES, Geo, "2026-08-15");
    const ids = rounds.flatMap((row) => [row.city.id, row.best.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("share text", () => {
  test("includes the date and the total score", () => {
    const chicago = CITIES.find((c) => c.name === "Chicago");
    const perth = CITIES.find((c) => c.name === "Perth" && c.country === "Australia");
    const london = CITIES.find((c) => c.name === "London");
    const text = Share.formatResults({
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
          tally: Geo.emptyScore(),
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
