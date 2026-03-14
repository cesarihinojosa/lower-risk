import type { TerritoryDef, TerritoryId, ContinentId } from "../../shared/types";

export const CONTINENT_BONUSES: Record<ContinentId, number> = {
  north_america: 5,
  south_america: 2,
  europe: 5,
  africa: 3,
  asia: 7,
  australia: 2,
};

export const CONTINENT_TERRITORY_COUNTS: Record<ContinentId, number> = {
  north_america: 9,
  south_america: 4,
  europe: 7,
  africa: 6,
  asia: 12,
  australia: 4,
};

export const TERRITORIES: TerritoryDef[] = [
  // ===== North America (9) =====
  {
    id: "alaska",
    name: "Alaska",
    continent: "north_america",
    adjacentTo: ["northwest_territory", "alberta", "kamchatka"],
    svgPathId: "path-alaska",
  },
  {
    id: "northwest_territory",
    name: "Northwest Territory",
    continent: "north_america",
    adjacentTo: ["alaska", "alberta", "ontario", "greenland"],
    svgPathId: "path-northwest_territory",
  },
  {
    id: "greenland",
    name: "Greenland",
    continent: "north_america",
    adjacentTo: ["northwest_territory", "ontario", "quebec", "iceland"],
    svgPathId: "path-greenland",
  },
  {
    id: "alberta",
    name: "Alberta",
    continent: "north_america",
    adjacentTo: ["alaska", "northwest_territory", "ontario", "western_us"],
    svgPathId: "path-alberta",
  },
  {
    id: "ontario",
    name: "Ontario",
    continent: "north_america",
    adjacentTo: [
      "northwest_territory",
      "alberta",
      "greenland",
      "quebec",
      "western_us",
      "eastern_us",
    ],
    svgPathId: "path-ontario",
  },
  {
    id: "quebec",
    name: "Quebec",
    continent: "north_america",
    adjacentTo: ["ontario", "greenland", "eastern_us"],
    svgPathId: "path-quebec",
  },
  {
    id: "western_us",
    name: "Western United States",
    continent: "north_america",
    adjacentTo: ["alberta", "ontario", "eastern_us", "central_america"],
    svgPathId: "path-western_us",
  },
  {
    id: "eastern_us",
    name: "Eastern United States",
    continent: "north_america",
    adjacentTo: ["ontario", "quebec", "western_us", "central_america"],
    svgPathId: "path-eastern_us",
  },
  {
    id: "central_america",
    name: "Central America",
    continent: "north_america",
    adjacentTo: ["western_us", "eastern_us", "venezuela"],
    svgPathId: "path-central_america",
  },

  // ===== South America (4) =====
  {
    id: "venezuela",
    name: "Venezuela",
    continent: "south_america",
    adjacentTo: ["central_america", "peru", "brazil"],
    svgPathId: "path-venezuela",
  },
  {
    id: "peru",
    name: "Peru",
    continent: "south_america",
    adjacentTo: ["venezuela", "brazil", "argentina"],
    svgPathId: "path-peru",
  },
  {
    id: "brazil",
    name: "Brazil",
    continent: "south_america",
    adjacentTo: ["venezuela", "peru", "argentina", "north_africa"],
    svgPathId: "path-brazil",
  },
  {
    id: "argentina",
    name: "Argentina",
    continent: "south_america",
    adjacentTo: ["peru", "brazil"],
    svgPathId: "path-argentina",
  },

  // ===== Europe (7) =====
  {
    id: "iceland",
    name: "Iceland",
    continent: "europe",
    adjacentTo: ["greenland", "scandinavia", "great_britain"],
    svgPathId: "path-iceland",
  },
  {
    id: "scandinavia",
    name: "Scandinavia",
    continent: "europe",
    adjacentTo: ["iceland", "great_britain", "northern_europe", "ukraine"],
    svgPathId: "path-scandinavia",
  },
  {
    id: "great_britain",
    name: "Great Britain",
    continent: "europe",
    adjacentTo: [
      "iceland",
      "scandinavia",
      "northern_europe",
      "western_europe",
    ],
    svgPathId: "path-great_britain",
  },
  {
    id: "northern_europe",
    name: "Northern Europe",
    continent: "europe",
    adjacentTo: [
      "scandinavia",
      "great_britain",
      "western_europe",
      "southern_europe",
      "ukraine",
    ],
    svgPathId: "path-northern_europe",
  },
  {
    id: "western_europe",
    name: "Western Europe",
    continent: "europe",
    adjacentTo: [
      "great_britain",
      "northern_europe",
      "southern_europe",
      "north_africa",
    ],
    svgPathId: "path-western_europe",
  },
  {
    id: "southern_europe",
    name: "Southern Europe",
    continent: "europe",
    adjacentTo: [
      "northern_europe",
      "western_europe",
      "ukraine",
      "north_africa",
      "egypt",
      "middle_east",
    ],
    svgPathId: "path-southern_europe",
  },
  {
    id: "ukraine",
    name: "Ukraine",
    continent: "europe",
    adjacentTo: [
      "scandinavia",
      "northern_europe",
      "southern_europe",
      "ural",
      "afghanistan",
      "middle_east",
    ],
    svgPathId: "path-ukraine",
  },

  // ===== Africa (6) =====
  {
    id: "north_africa",
    name: "North Africa",
    continent: "africa",
    adjacentTo: [
      "brazil",
      "western_europe",
      "southern_europe",
      "egypt",
      "east_africa",
      "congo",
    ],
    svgPathId: "path-north_africa",
  },
  {
    id: "egypt",
    name: "Egypt",
    continent: "africa",
    adjacentTo: [
      "southern_europe",
      "north_africa",
      "east_africa",
      "middle_east",
    ],
    svgPathId: "path-egypt",
  },
  {
    id: "east_africa",
    name: "East Africa",
    continent: "africa",
    adjacentTo: [
      "north_africa",
      "egypt",
      "congo",
      "south_africa",
      "madagascar",
      "middle_east",
    ],
    svgPathId: "path-east_africa",
  },
  {
    id: "congo",
    name: "Congo",
    continent: "africa",
    adjacentTo: ["north_africa", "east_africa", "south_africa"],
    svgPathId: "path-congo",
  },
  {
    id: "south_africa",
    name: "South Africa",
    continent: "africa",
    adjacentTo: ["congo", "east_africa", "madagascar"],
    svgPathId: "path-south_africa",
  },
  {
    id: "madagascar",
    name: "Madagascar",
    continent: "africa",
    adjacentTo: ["south_africa", "east_africa"],
    svgPathId: "path-madagascar",
  },

  // ===== Asia (12) =====
  {
    id: "ural",
    name: "Ural",
    continent: "asia",
    adjacentTo: ["ukraine", "siberia", "china", "afghanistan"],
    svgPathId: "path-ural",
  },
  {
    id: "siberia",
    name: "Siberia",
    continent: "asia",
    adjacentTo: ["ural", "yakutsk", "irkutsk", "mongolia", "china"],
    svgPathId: "path-siberia",
  },
  {
    id: "yakutsk",
    name: "Yakutsk",
    continent: "asia",
    adjacentTo: ["siberia", "kamchatka", "irkutsk"],
    svgPathId: "path-yakutsk",
  },
  {
    id: "kamchatka",
    name: "Kamchatka",
    continent: "asia",
    adjacentTo: ["alaska", "yakutsk", "irkutsk", "mongolia", "japan"],
    svgPathId: "path-kamchatka",
  },
  {
    id: "irkutsk",
    name: "Irkutsk",
    continent: "asia",
    adjacentTo: ["siberia", "yakutsk", "kamchatka", "mongolia"],
    svgPathId: "path-irkutsk",
  },
  {
    id: "mongolia",
    name: "Mongolia",
    continent: "asia",
    adjacentTo: ["siberia", "irkutsk", "kamchatka", "japan", "china"],
    svgPathId: "path-mongolia",
  },
  {
    id: "japan",
    name: "Japan",
    continent: "asia",
    adjacentTo: ["kamchatka", "mongolia"],
    svgPathId: "path-japan",
  },
  {
    id: "afghanistan",
    name: "Afghanistan",
    continent: "asia",
    adjacentTo: ["ukraine", "ural", "china", "india", "middle_east"],
    svgPathId: "path-afghanistan",
  },
  {
    id: "china",
    name: "China",
    continent: "asia",
    adjacentTo: [
      "ural",
      "siberia",
      "mongolia",
      "afghanistan",
      "india",
      "siam",
    ],
    svgPathId: "path-china",
  },
  {
    id: "middle_east",
    name: "Middle East",
    continent: "asia",
    adjacentTo: [
      "ukraine",
      "southern_europe",
      "egypt",
      "east_africa",
      "afghanistan",
      "india",
    ],
    svgPathId: "path-middle_east",
  },
  {
    id: "india",
    name: "India",
    continent: "asia",
    adjacentTo: ["afghanistan", "china", "middle_east", "siam"],
    svgPathId: "path-india",
  },
  {
    id: "siam",
    name: "Siam",
    continent: "asia",
    adjacentTo: ["china", "india", "indonesia"],
    svgPathId: "path-siam",
  },

  // ===== Australia (4) =====
  {
    id: "indonesia",
    name: "Indonesia",
    continent: "australia",
    adjacentTo: ["siam", "new_guinea", "western_australia"],
    svgPathId: "path-indonesia",
  },
  {
    id: "new_guinea",
    name: "New Guinea",
    continent: "australia",
    adjacentTo: ["indonesia", "western_australia", "eastern_australia"],
    svgPathId: "path-new_guinea",
  },
  {
    id: "western_australia",
    name: "Western Australia",
    continent: "australia",
    adjacentTo: ["indonesia", "new_guinea", "eastern_australia"],
    svgPathId: "path-western_australia",
  },
  {
    id: "eastern_australia",
    name: "Eastern Australia",
    continent: "australia",
    adjacentTo: ["new_guinea", "western_australia"],
    svgPathId: "path-eastern_australia",
  },
];

// Lookup maps built once at import time
const territoryById = new Map<TerritoryId, TerritoryDef>();
for (const t of TERRITORIES) {
  territoryById.set(t.id, t);
}

export function getTerritory(id: TerritoryId): TerritoryDef {
  const t = territoryById.get(id);
  if (!t) throw new Error(`Unknown territory: ${id}`);
  return t;
}

export function getAdjacent(id: TerritoryId): TerritoryId[] {
  return getTerritory(id).adjacentTo;
}

export function areAdjacent(a: TerritoryId, b: TerritoryId): boolean {
  return getTerritory(a).adjacentTo.includes(b);
}

export function getTerritoriesByContinent(
  continent: ContinentId,
): TerritoryDef[] {
  return TERRITORIES.filter((t) => t.continent === continent);
}

export function getAllTerritoryIds(): TerritoryId[] {
  return TERRITORIES.map((t) => t.id);
}
