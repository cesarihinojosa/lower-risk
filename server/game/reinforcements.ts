import type { GameState, ContinentId } from "../../shared/types";
import { CONTINENT_BONUSES, getTerritoriesByContinent } from "./territories";

/**
 * Calculate how many reinforcement troops a player gets at the start of their turn.
 * Formula: max(3, territories / 3) + continent bonuses
 */
export function calculateReinforcements(
  state: GameState,
  playerId: string,
): number {
  const ownedCount = Object.values(state.territories).filter(
    (t) => t.owner === playerId,
  ).length;

  // Base: territories / 3, minimum 3
  const base = Math.max(3, Math.floor(ownedCount / 3));

  // Continent bonuses
  const continentBonus = calculateContinentBonuses(state, playerId);

  return base + continentBonus;
}

/**
 * Calculate continent bonuses for a player.
 * A player gets the bonus for a continent if they own ALL territories in it.
 */
export function calculateContinentBonuses(
  state: GameState,
  playerId: string,
): number {
  let bonus = 0;
  const continents: ContinentId[] = [
    "north_america",
    "south_america",
    "europe",
    "africa",
    "asia",
    "australia",
  ];

  for (const continent of continents) {
    if (ownsContinent(state, playerId, continent)) {
      bonus += CONTINENT_BONUSES[continent];
    }
  }

  return bonus;
}

/**
 * Check if a player owns all territories in a continent.
 */
export function ownsContinent(
  state: GameState,
  playerId: string,
  continent: ContinentId,
): boolean {
  const continentTerritories = getTerritoriesByContinent(continent);
  return continentTerritories.every(
    (t) => state.territories[t.id]?.owner === playerId,
  );
}
