const assert = require("assert");
const Geo = require("../js/geo.js");
const CITIES = require("../js/cities.js");

function city(name, country) {
  return CITIES.find(
    (c) => c.name === name && (!country || c.country === country)
  );
}

function nearest(from) {
  const antipode = Geo.antipode(from);
  return Geo.nearestCity(antipode, CITIES, from.id);
}

const chicago = city("Chicago");
const perth = city("Perth");
const bermuda = city("Hamilton", "Bermuda");
const shanghai = city("Shanghai");
const buenos = city("Buenos Aires");
const christchurch = city("Christchurch");
const coruna = city("A Coruña");

assert.ok(chicago && perth && bermuda && shanghai && buenos);

const chicagoBest = nearest(chicago);
assert.strictEqual(chicagoBest.city.id, perth.id, "Chicago's opposite is Perth");
assert.ok(chicagoBest.distance < 2500);

const perthBest = nearest(perth);
assert.strictEqual(perthBest.city.id, bermuda.id, "Perth's opposite is Hamilton, Bermuda");
assert.ok(perthBest.distance < 100);

assert.strictEqual(Geo.scoreGuess(chicagoBest.distance, chicagoBest.distance), 1000);
assert.ok(Geo.scoreGuess(chicagoBest.distance + 8000, chicagoBest.distance) < 20);

const lima = city("Lima");
const bangkok = city("Bangkok");
assert.ok(Geo.haversine(Geo.antipode(lima), bangkok) < 400);

const miss = Geo.chordMissKm(christchurch, coruna);
assert.ok(miss < Geo.INNER_CORE, "Christchurch–A Coruña passes through the inner core");

const ids = new Set(CITIES.map((c) => c.id));
assert.strictEqual(ids.size, CITIES.length);

console.log("geo tests passed", CITIES.length, "cities");
