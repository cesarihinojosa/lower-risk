import { describe, it, expect } from "vitest";
import {
  TERRITORIES,
  CONTINENT_BONUSES,
  CONTINENT_TERRITORY_COUNTS,
  getTerritory,
  getAdjacent,
  areAdjacent,
  getTerritoriesByContinent,
} from "../territories";
import type { ContinentId, TerritoryId } from "../../../shared/types";

describe("territory data integrity", () => {
  it("should have exactly 42 territories", () => {
    expect(TERRITORIES).toHaveLength(42);
  });

  it("should have unique territory IDs", () => {
    const ids = TERRITORIES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(42);
  });

  it("should have correct continent territory counts", () => {
    const counts: Record<string, number> = {};
    for (const t of TERRITORIES) {
      counts[t.continent] = (counts[t.continent] || 0) + 1;
    }

    expect(counts["north_america"]).toBe(9);
    expect(counts["south_america"]).toBe(4);
    expect(counts["europe"]).toBe(7);
    expect(counts["africa"]).toBe(6);
    expect(counts["asia"]).toBe(12);
    expect(counts["australia"]).toBe(4);
  });

  it("should match CONTINENT_TERRITORY_COUNTS constant", () => {
    const counts: Partial<Record<ContinentId, number>> = {};
    for (const t of TERRITORIES) {
      counts[t.continent] = (counts[t.continent] || 0) + 1;
    }

    for (const [continent, expectedCount] of Object.entries(
      CONTINENT_TERRITORY_COUNTS,
    )) {
      expect(counts[continent as ContinentId]).toBe(expectedCount);
    }
  });

  it("should assign every territory to exactly one continent", () => {
    const validContinents: ContinentId[] = [
      "north_america",
      "south_america",
      "europe",
      "africa",
      "asia",
      "australia",
    ];

    for (const t of TERRITORIES) {
      expect(validContinents).toContain(t.continent);
    }
  });

  it("should have bidirectional adjacency", () => {
    for (const territory of TERRITORIES) {
      for (const neighborId of territory.adjacentTo) {
        const neighbor = getTerritory(neighborId);
        expect(
          neighbor.adjacentTo,
          `${neighborId} should list ${territory.id} as adjacent (bidirectional)`,
        ).toContain(territory.id);
      }
    }
  });

  it("should have no self-adjacency", () => {
    for (const territory of TERRITORIES) {
      expect(
        territory.adjacentTo,
        `${territory.id} should not be adjacent to itself`,
      ).not.toContain(territory.id);
    }
  });

  it("should have no duplicate adjacencies", () => {
    for (const territory of TERRITORIES) {
      const unique = new Set(territory.adjacentTo);
      expect(
        unique.size,
        `${territory.id} has duplicate adjacencies`,
      ).toBe(territory.adjacentTo.length);
    }
  });

  it("should only reference valid territory IDs in adjacency lists", () => {
    const allIds = new Set(TERRITORIES.map((t) => t.id));
    for (const territory of TERRITORIES) {
      for (const neighborId of territory.adjacentTo) {
        expect(
          allIds.has(neighborId),
          `${territory.id} references unknown territory ${neighborId}`,
        ).toBe(true);
      }
    }
  });

  it("should have correct continent bonus values", () => {
    expect(CONTINENT_BONUSES.north_america).toBe(5);
    expect(CONTINENT_BONUSES.south_america).toBe(2);
    expect(CONTINENT_BONUSES.europe).toBe(5);
    expect(CONTINENT_BONUSES.africa).toBe(3);
    expect(CONTINENT_BONUSES.asia).toBe(7);
    expect(CONTINENT_BONUSES.australia).toBe(2);
  });

  it("should have exactly 6 continents with bonuses", () => {
    expect(Object.keys(CONTINENT_BONUSES)).toHaveLength(6);
  });
});

describe("territory lookup functions", () => {
  it("getTerritory returns correct territory", () => {
    const alaska = getTerritory("alaska");
    expect(alaska.name).toBe("Alaska");
    expect(alaska.continent).toBe("north_america");
  });

  it("getTerritory throws for unknown territory", () => {
    expect(() => getTerritory("atlantis" as TerritoryId)).toThrow(
      "Unknown territory",
    );
  });

  it("getAdjacent returns adjacency list", () => {
    const neighbors = getAdjacent("alaska");
    expect(neighbors).toContain("northwest_territory");
    expect(neighbors).toContain("alberta");
    expect(neighbors).toContain("kamchatka");
    expect(neighbors).toHaveLength(3);
  });

  it("areAdjacent returns true for adjacent territories", () => {
    expect(areAdjacent("alaska", "kamchatka")).toBe(true);
  });

  it("areAdjacent returns false for non-adjacent territories", () => {
    expect(areAdjacent("alaska", "brazil")).toBe(false);
  });

  it("getTerritoriesByContinent returns correct territories", () => {
    const australia = getTerritoriesByContinent("australia");
    expect(australia).toHaveLength(4);
    const ids = australia.map((t) => t.id);
    expect(ids).toContain("indonesia");
    expect(ids).toContain("new_guinea");
    expect(ids).toContain("western_australia");
    expect(ids).toContain("eastern_australia");
  });
});

describe("cross-continent adjacency", () => {
  it("North America connects to South America via central_america-venezuela", () => {
    expect(areAdjacent("central_america", "venezuela")).toBe(true);
  });

  it("North America connects to Europe via greenland-iceland", () => {
    expect(areAdjacent("greenland", "iceland")).toBe(true);
  });

  it("North America connects to Asia via alaska-kamchatka", () => {
    expect(areAdjacent("alaska", "kamchatka")).toBe(true);
  });

  it("South America connects to Africa via brazil-north_africa", () => {
    expect(areAdjacent("brazil", "north_africa")).toBe(true);
  });

  it("Europe connects to Africa via western_europe-north_africa and southern_europe-north_africa/egypt", () => {
    expect(areAdjacent("western_europe", "north_africa")).toBe(true);
    expect(areAdjacent("southern_europe", "north_africa")).toBe(true);
    expect(areAdjacent("southern_europe", "egypt")).toBe(true);
  });

  it("Europe connects to Asia via ukraine-ural/afghanistan/middle_east and southern_europe-middle_east", () => {
    expect(areAdjacent("ukraine", "ural")).toBe(true);
    expect(areAdjacent("ukraine", "afghanistan")).toBe(true);
    expect(areAdjacent("ukraine", "middle_east")).toBe(true);
    expect(areAdjacent("southern_europe", "middle_east")).toBe(true);
  });

  it("Africa connects to Asia via egypt-middle_east and east_africa-middle_east", () => {
    expect(areAdjacent("egypt", "middle_east")).toBe(true);
    expect(areAdjacent("east_africa", "middle_east")).toBe(true);
  });

  it("Asia connects to Australia via siam-indonesia", () => {
    expect(areAdjacent("siam", "indonesia")).toBe(true);
  });
});
