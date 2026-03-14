import { describe, it, expect } from "vitest";
import { areConnectedThroughOwned } from "../pathfinding";
import { getAllTerritoryIds } from "../territories";
import type { TerritoryId, TerritoryState } from "../../../shared/types";

/**
 * Build a full territories record with all territories unowned (null),
 * then apply ownership overrides.
 */
function buildTerritories(
  overrides: Partial<Record<TerritoryId, { owner: string; troops: number }>>,
): Record<TerritoryId, TerritoryState> {
  const territories = {} as Record<TerritoryId, TerritoryState>;
  for (const id of getAllTerritoryIds()) {
    territories[id] = { owner: null, troops: 0 };
  }
  for (const [id, state] of Object.entries(overrides)) {
    territories[id as TerritoryId] = state;
  }
  return territories;
}

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

describe("areConnectedThroughOwned", () => {
  describe("direct neighbors", () => {
    it("returns true when player owns two adjacent territories", () => {
      // alaska <-> northwest_territory are adjacent
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 3 },
        northwest_territory: { owner: PLAYER_A, troops: 2 },
      });

      expect(
        areConnectedThroughOwned("alaska", "northwest_territory", PLAYER_A, territories),
      ).toBe(true);
    });

    it("returns true in both directions", () => {
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 3 },
        alberta: { owner: PLAYER_A, troops: 2 },
      });

      expect(
        areConnectedThroughOwned("alberta", "alaska", PLAYER_A, territories),
      ).toBe(true);
      expect(
        areConnectedThroughOwned("alaska", "alberta", PLAYER_A, territories),
      ).toBe(true);
    });
  });

  describe("chain through owned territories", () => {
    it("returns true when connected through a chain of owned territories", () => {
      // alaska -> northwest_territory -> ontario (chain of 3)
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 3 },
        northwest_territory: { owner: PLAYER_A, troops: 1 },
        ontario: { owner: PLAYER_A, troops: 2 },
      });

      expect(
        areConnectedThroughOwned("alaska", "ontario", PLAYER_A, territories),
      ).toBe(true);
    });

    it("returns true for a longer chain", () => {
      // alaska -> northwest_territory -> ontario -> quebec
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 1 },
        northwest_territory: { owner: PLAYER_A, troops: 1 },
        ontario: { owner: PLAYER_A, troops: 1 },
        quebec: { owner: PLAYER_A, troops: 1 },
      });

      expect(
        areConnectedThroughOwned("alaska", "quebec", PLAYER_A, territories),
      ).toBe(true);
    });
  });

  describe("blocked by enemy territory", () => {
    it("returns false when enemy territory breaks the chain", () => {
      // alaska -> [northwest_territory owned by B] -> ontario
      // No other path from alaska to ontario without going through northwest_territory or alberta
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 3 },
        northwest_territory: { owner: PLAYER_B, troops: 2 },
        alberta: { owner: PLAYER_B, troops: 2 },
        ontario: { owner: PLAYER_A, troops: 2 },
      });

      // alaska is adjacent to: northwest_territory, alberta, kamchatka
      // All neighbors not owned by A, so alaska is isolated from ontario
      expect(
        areConnectedThroughOwned("alaska", "ontario", PLAYER_A, territories),
      ).toBe(false);
    });

    it("returns false when the destination is not owned by the player", () => {
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 3 },
        northwest_territory: { owner: PLAYER_B, troops: 2 },
      });

      expect(
        areConnectedThroughOwned("alaska", "northwest_territory", PLAYER_A, territories),
      ).toBe(false);
    });
  });

  describe("island territory (no adjacent owned territories)", () => {
    it("returns false when territory has no owned neighbors", () => {
      // japan is adjacent to kamchatka and mongolia only
      const territories = buildTerritories({
        japan: { owner: PLAYER_A, troops: 5 },
        kamchatka: { owner: PLAYER_B, troops: 1 },
        mongolia: { owner: PLAYER_B, troops: 1 },
        alaska: { owner: PLAYER_A, troops: 2 },
      });

      expect(
        areConnectedThroughOwned("japan", "alaska", PLAYER_A, territories),
      ).toBe(false);
    });

    it("returns false when only the source is owned and all neighbors are unowned", () => {
      // madagascar is adjacent to south_africa and east_africa
      const territories = buildTerritories({
        madagascar: { owner: PLAYER_A, troops: 3 },
        // south_africa and east_africa are unowned (null)
      });

      expect(
        areConnectedThroughOwned("madagascar", "south_africa", PLAYER_A, territories),
      ).toBe(false);
    });
  });

  describe("multiple paths", () => {
    it("returns true when multiple paths exist (either works)", () => {
      // Two paths from alaska to ontario:
      // Path 1: alaska -> northwest_territory -> ontario
      // Path 2: alaska -> alberta -> ontario
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 1 },
        northwest_territory: { owner: PLAYER_A, troops: 1 },
        alberta: { owner: PLAYER_A, troops: 1 },
        ontario: { owner: PLAYER_A, troops: 1 },
      });

      expect(
        areConnectedThroughOwned("alaska", "ontario", PLAYER_A, territories),
      ).toBe(true);
    });

    it("returns true when one path is blocked but another exists", () => {
      // Path via northwest_territory is blocked (owned by B)
      // Path via alberta still works: alaska -> alberta -> ontario
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 1 },
        northwest_territory: { owner: PLAYER_B, troops: 1 },
        alberta: { owner: PLAYER_A, troops: 1 },
        ontario: { owner: PLAYER_A, troops: 1 },
      });

      expect(
        areConnectedThroughOwned("alaska", "ontario", PLAYER_A, territories),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns true when source and destination are the same territory", () => {
      const territories = buildTerritories({
        alaska: { owner: PLAYER_A, troops: 1 },
      });

      expect(
        areConnectedThroughOwned("alaska", "alaska", PLAYER_A, territories),
      ).toBe(true);
    });
  });
});
