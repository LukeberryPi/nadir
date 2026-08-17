export type LatLon = {
  lat: number;
  lon: number;
};

export type CitySeed = LatLon & {
  name: string;
  country: string;
  aliases?: string[];
};

export type City = CitySeed & {
  id: number;
  label: string;
  continent: string;
  search: string;
};

export type ScoreTally = {
  continent: boolean;
  country: boolean;
  city: boolean;
  points: number;
  parts: {
    distance: number;
    continent: number;
    country: number;
  };
};

export type Round = {
  city: City;
  antipode: LatLon;
  best: City;
  bestDist: number;
};

export type HistoryRow = {
  from: City;
  guess: City | null;
  best: City;
  points: number;
  tally: ScoreTally;
  skipped: boolean;
};

export type SavedHistoryRow = {
  fromId: number;
  guessId: number | null;
  bestId: number;
  points: number;
  tally: ScoreTally;
  skipped: boolean;
};

export type SavedProgress = {
  index: number;
  score: number;
  revealed: boolean;
  finished: boolean;
  history: SavedHistoryRow[];
};
