import { describe, expect, test } from "bun:test";
import Geo from "../js/geo.js";
import CITIES from "../js/cities.js";

function city(name, country) {
  return CITIES.find((c) => c.name === name && (!country || c.country === country));
}

function nearest(from) {
  return Geo.nearestCity(Geo.antipode(from), CITIES, from.id);
}

describe("atlas", () => {
  test("every city has a continent", () => {
    for (const place of CITIES) {
      expect(place.continent).toBeTruthy();
    }
  });

  test("Chicago's opposite is Perth, Australia", () => {
    const chicago = city("Chicago");
    const perth = city("Perth");
    const best = nearest(chicago);
    expect(best.city.id).toBe(perth.id);
    expect(best.city.country).toBe("Australia");
  });

  test("Perth's opposite is Hamilton, Bermuda", () => {
    const perth = city("Perth");
    const bermuda = city("Hamilton", "Bermuda");
    expect(nearest(perth).city.id).toBe(bermuda.id);
  });
});

describe("scoring", () => {
  test("exact city scores 1,000", () => {
    const chicago = city("Chicago");
    const perth = city("Perth");
    const tally = Geo.scoreGuess(perth, nearest(chicago).city);
    expect(tally.city).toBe(true);
    expect(tally.country).toBe(true);
    expect(tally.continent).toBe(true);
    expect(tally.points).toBe(Geo.MAX_ROUND);
  });

  test("same country, wrong city scores continent + country", () => {
    const perth = city("Perth");
    const adelaide = city("Adelaide");
    const tally = Geo.scoreGuess(adelaide, perth);
    expect(tally.city).toBe(false);
    expect(tally.country).toBe(true);
    expect(tally.continent).toBe(true);
    expect(tally.points).toBe(Geo.POINTS.continent + Geo.POINTS.country);
  });

  test("same continent, wrong country scores continent only", () => {
    const perth = city("Perth");
    const auckland = city("Auckland");
    const tally = Geo.scoreGuess(auckland, perth);
    expect(tally.country).toBe(false);
    expect(tally.continent).toBe(true);
    expect(tally.points).toBe(Geo.POINTS.continent);
  });

  test("wrong continent scores nothing", () => {
    const perth = city("Perth");
    const lima = city("Lima");
    const tally = Geo.scoreGuess(lima, perth);
    expect(tally.points).toBe(0);
    expect(tally.continent).toBe(false);
  });

  test("Honolulu counts as Oceania", () => {
    const honolulu = city("Honolulu");
    const perth = city("Perth");
    expect(honolulu.continent).toBe("Oceania");
    expect(Geo.scoreGuess(honolulu, perth).continent).toBe(true);
    expect(Geo.scoreGuess(honolulu, perth).country).toBe(false);
  });
});

describe("geometry", () => {
  test("Lima sits near Bangkok through the planet", () => {
    const lima = city("Lima");
    const bangkok = city("Bangkok");
    expect(Geo.haversine(Geo.antipode(lima), bangkok)).toBeLessThan(400);
  });

  test("Christchurch–A Coruña passes through the inner core", () => {
    const christchurch = city("Christchurch");
    const coruna = city("A Coruña");
    expect(Geo.chordMissKm(christchurch, coruna)).toBeLessThan(Geo.INNER_CORE);
  });
});
