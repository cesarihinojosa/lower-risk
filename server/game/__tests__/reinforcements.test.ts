import { describe, it, expect } from "vitest";
import {
  calculateReinforcements,
  calculateContinentBonuses,
  ownsContinent,
} from "../reinforcements";
import { createGame, addPlayer } from "../state";
import { getAllTerritoryIds, getTerritoriesByContinent } from "../territories";
import type { GameState, TerritoryId } from "../../../shared/types";

/**
 * Helper: assign the first `count` territories from allIds to the given player.
 */
function assignTerritories(
  state: GameState,
  playerId: string,
  territoryIds: TerritoryId[],
): GameState {
  const territories = { ...state.territories };
  for (const id of territoryIds) {
    territories[id] = { owner: playerId, troops: 1 };
  }
  return { ...state, territories };
}

function buildState(): GameState {
  let state = createGame();
  state = addPlayer(state, "p1", "Alice");
  state = addPlayer(state, "p2", "Bob");
  return state;
}

describe("calculateReinforcements", () => {
  it("gives minimum 3 armies when player owns 0 territories", () => {
    const state = buildState();
    // p1 owns nothing
    expect(calculateReinforcements(state, "p1")).toBe(3);
  });

  it("gives minimum 3 armies when player owns 9 territories", () => {
    const state = buildState();
    // Pick 9 territories that do NOT complete any continent.
    // NA has 9 — take only 6. SA has 4 — take 3. Total = 9, no continent complete.
    const naIds = getTerritoriesByContinent("north_america").map((t) => t.id);
    const saIds = getTerritoriesByContinent("south_america").map((t) => t.id);
    const nine = [...naIds.slice(0, 6), ...saIds.slice(0, 3)];
    expect(nine.length).toBe(9);

    const updated = assignTerritories(state, "p1", nine);
    // 9 / 3 = 3, which equals the minimum, no continent bonus
    expect(calculateReinforcements(updated, "p1")).toBe(3);
  });

  it("gives territories / 3 when player owns 12 territories", () => {
    const state = buildState();
    const allIds = getAllTerritoryIds();
    // Pick 12 territories that do NOT form a complete continent.
    // NA has 9, Africa has 6 — take all 9 NA + first 3 Africa = 12 territories.
    // Player does NOT own all of Africa (missing 3), so no continent bonus.
    const naIds = getTerritoriesByContinent("north_america").map((t) => t.id);
    const africaIds = getTerritoriesByContinent("africa").map((t) => t.id);
    const twelve = [...naIds, ...africaIds.slice(0, 3)];
    expect(twelve.length).toBe(12);

    // Assign the NA territories to p2 so p1 doesn't get a continent bonus for NA
    // Actually, p1 owns all 9 NA territories here, which would give +5.
    // Instead, pick territories that span continents without completing any.
    // Take 6 from NA (not all 9), 3 from Africa, 3 from Europe = 12, no continent complete.
    const europeIds = getTerritoriesByContinent("europe").map((t) => t.id);
    const twelveNoContinents = [
      ...naIds.slice(0, 6),
      ...africaIds.slice(0, 3),
      ...europeIds.slice(0, 3),
    ];
    expect(twelveNoContinents.length).toBe(12);

    const updated = assignTerritories(state, "p1", twelveNoContinents);
    // 12 / 3 = 4, no continent bonus
    expect(calculateReinforcements(updated, "p1")).toBe(4);
  });

  it("adds continent bonus for owning all of Australia (+2)", () => {
    const state = buildState();
    const australiaIds = getTerritoriesByContinent("australia").map((t) => t.id);
    // 4 territories => base = max(3, floor(4/3)) = max(3, 1) = 3; bonus = 2; total = 5
    const updated = assignTerritories(state, "p1", australiaIds);
    expect(calculateReinforcements(updated, "p1")).toBe(5);
  });

  it("adds multiple continent bonuses for NA + SA (+5 + +2 = +7)", () => {
    const state = buildState();
    const naIds = getTerritoriesByContinent("north_america").map((t) => t.id);
    const saIds = getTerritoriesByContinent("south_america").map((t) => t.id);
    const combined = [...naIds, ...saIds]; // 9 + 4 = 13 territories
    const updated = assignTerritories(state, "p1", combined);
    // base = max(3, floor(13/3)) = max(3, 4) = 4; bonus = 5 + 2 = 7; total = 11
    expect(calculateReinforcements(updated, "p1")).toBe(11);
  });

  it("gives no bonus for partial continent (11 of 12 Asia territories)", () => {
    const state = buildState();
    const asiaIds = getTerritoriesByContinent("asia").map((t) => t.id);
    expect(asiaIds.length).toBe(12);

    // Give p1 only 11 of 12 Asia territories
    const elevenAsia = asiaIds.slice(0, 11);
    const updated = assignTerritories(state, "p1", elevenAsia);
    // base = max(3, floor(11/3)) = max(3, 3) = 3; no continent bonus
    expect(calculateReinforcements(updated, "p1")).toBe(3);
  });

  it("combines territory count and continent bonus (15 territories + Australia = 7)", () => {
    const state = buildState();
    const australiaIds = getTerritoriesByContinent("australia").map((t) => t.id);
    // Need 15 total territories including the 4 in Australia.
    // So 11 more from non-Australia continents, without completing any continent.
    // NA: 9 territories (take 6), Europe: 7 (take 5) = 11 extra
    const naIds = getTerritoriesByContinent("north_america").map((t) => t.id);
    const europeIds = getTerritoriesByContinent("europe").map((t) => t.id);
    const extra = [...naIds.slice(0, 6), ...europeIds.slice(0, 5)];
    const allOwned = [...australiaIds, ...extra];
    expect(allOwned.length).toBe(15);

    const updated = assignTerritories(state, "p1", allOwned);
    // base = max(3, floor(15/3)) = max(3, 5) = 5; Australia bonus = 2; total = 7
    expect(calculateReinforcements(updated, "p1")).toBe(7);
  });
});

describe("calculateContinentBonuses", () => {
  it("returns 0 when player owns no territories", () => {
    const state = buildState();
    expect(calculateContinentBonuses(state, "p1")).toBe(0);
  });

  it("returns correct bonus for each continent individually", () => {
    const expectedBonuses: Record<string, number> = {
      north_america: 5,
      south_america: 2,
      europe: 5,
      africa: 3,
      asia: 7,
      australia: 2,
    };

    for (const [continent, expectedBonus] of Object.entries(expectedBonuses)) {
      const state = buildState();
      const ids = getTerritoriesByContinent(continent as any).map((t) => t.id);
      const updated = assignTerritories(state, "p1", ids);
      expect(calculateContinentBonuses(updated, "p1")).toBe(expectedBonus);
    }
  });
});

describe("ownsContinent", () => {
  it("returns true when player owns all territories in a continent", () => {
    const state = buildState();
    const saIds = getTerritoriesByContinent("south_america").map((t) => t.id);
    const updated = assignTerritories(state, "p1", saIds);
    expect(ownsContinent(updated, "p1", "south_america")).toBe(true);
  });

  it("returns false when player owns some but not all territories", () => {
    const state = buildState();
    const saIds = getTerritoriesByContinent("south_america").map((t) => t.id);
    // Assign all but the last territory
    const updated = assignTerritories(state, "p1", saIds.slice(0, -1));
    expect(ownsContinent(updated, "p1", "south_america")).toBe(false);
  });

  it("returns false when another player owns one territory in the continent", () => {
    const state = buildState();
    const saIds = getTerritoriesByContinent("south_america").map((t) => t.id);
    // p1 gets all but last, p2 gets the last
    let updated = assignTerritories(state, "p1", saIds.slice(0, -1));
    updated = assignTerritories(updated, "p2", [saIds[saIds.length - 1]]);
    expect(ownsContinent(updated, "p1", "south_america")).toBe(false);
  });

  it("returns false when player owns no territories in the continent", () => {
    const state = buildState();
    expect(ownsContinent(state, "p1", "australia")).toBe(false);
  });
});
