import { describe, expect, test } from "bun:test";
import { CITIES } from "../src/cities.ts";
import { Geo } from "../src/geo.ts";
import type { City } from "../src/types.ts";

function city(name: string, country?: string): City {
  const found = CITIES.find((place) => place.name === name && (!country || place.country === country));
  if (!found) throw new Error(`Missing city ${name}`);
  return found;
}

function nearest(from: City) {
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
    expect(best.city?.id).toBe(perth.id);
    expect(best.city?.country).toBe("Australia");
  });

  test("Perth's opposite is Hamilton, Bermuda", () => {
    const perth = city("Perth");
    const bermuda = city("Hamilton", "Bermuda");
    expect(nearest(perth).city?.id).toBe(bermuda.id);
  });
});

describe("scoring", () => {
  test("distance outweighs continent and country baselines", () => {
    expect(Geo.POINTS.distance).toBeGreaterThan(Geo.POINTS.continent + Geo.POINTS.country);
    expect(Geo.MAX_ROUND).toBe(Geo.POINTS.distance + Geo.POINTS.continent + Geo.POINTS.country);
  });

  test("exact city scores 1,000, mostly from distance", () => {
    const chicago = city("Chicago");
    const perth = city("Perth");
    const official = nearest(chicago).city;
    if (!official) throw new Error("missing official");
    const tally = Geo.scoreGuess(perth, official, Geo.antipode(chicago));
    expect(tally.city).toBe(true);
    expect(tally.country).toBe(true);
    expect(tally.continent).toBe(true);
    expect(tally.parts.distance).toBe(Geo.POINTS.distance);
    expect(tally.parts.continent).toBe(Geo.POINTS.continent);
    expect(tally.parts.country).toBe(Geo.POINTS.country);
    expect(tally.points).toBe(Geo.MAX_ROUND);
  });

  test("same country adds a baseline and keeps distance in play", () => {
    const chicago = city("Chicago");
    const perth = nearest(chicago).city;
    if (!perth) throw new Error("missing perth");
    const adelaide = city("Adelaide");
    const tally = Geo.scoreGuess(adelaide, perth, Geo.antipode(chicago));
    expect(tally.city).toBe(false);
    expect(tally.country).toBe(true);
    expect(tally.continent).toBe(true);
    expect(tally.parts.continent).toBe(Geo.POINTS.continent);
    expect(tally.parts.country).toBe(Geo.POINTS.country);
    expect(tally.parts.distance).toBeGreaterThan(0);
    expect(tally.parts.distance).toBeLessThan(Geo.POINTS.distance);
    expect(tally.points).toBeLessThan(Geo.MAX_ROUND);
    expect(tally.parts.distance).toBeGreaterThan(tally.parts.continent + tally.parts.country);
  });

  test("same continent, wrong country scores a smaller baseline", () => {
    const chicago = city("Chicago");
    const perth = nearest(chicago).city;
    if (!perth) throw new Error("missing perth");
    const auckland = city("Auckland");
    const tally = Geo.scoreGuess(auckland, perth, Geo.antipode(chicago));
    expect(tally.country).toBe(false);
    expect(tally.continent).toBe(true);
    expect(tally.parts.country).toBe(0);
    expect(tally.parts.continent).toBe(Geo.POINTS.continent);
    expect(tally.points).toBe(tally.parts.distance + Geo.POINTS.continent);
  });

  test("wrong continent scores distance only", () => {
    const chicago = city("Chicago");
    const perth = nearest(chicago).city;
    if (!perth) throw new Error("missing perth");
    const lima = city("Lima");
    const tally = Geo.scoreGuess(lima, perth, Geo.antipode(chicago));
    expect(tally.continent).toBe(false);
    expect(tally.parts.continent).toBe(0);
    expect(tally.parts.country).toBe(0);
    expect(tally.points).toBe(tally.parts.distance);
  });

  test("Honolulu counts as Oceania", () => {
    const honolulu = city("Honolulu");
    const perth = city("Perth");
    expect(honolulu.continent).toBe("Oceania");
    const tally = Geo.scoreGuess(honolulu, perth, Geo.antipode(city("Chicago")));
    expect(tally.continent).toBe(true);
    expect(tally.country).toBe(false);
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
