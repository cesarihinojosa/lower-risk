import type { CombatState, TerritoryId } from "../../shared/types";
import { rollDie } from "./rng";

export interface CombatResult {
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
}

/**
 * Roll dice and resolve combat between attacker and defender.
 * Attacker can roll 1-3 dice, defender rolls 1-2.
 * Dice are sorted descending and compared pairwise.
 * Ties go to the defender.
 */
export function resolveCombat(
  attackerDiceCount: number,
  defenderDiceCount: number,
): CombatResult {
  const attackerDice: number[] = [];
  for (let i = 0; i < attackerDiceCount; i++) {
    attackerDice.push(rollDie());
  }
  attackerDice.sort((a, b) => b - a);

  const defenderDice: number[] = [];
  for (let i = 0; i < defenderDiceCount; i++) {
    defenderDice.push(rollDie());
  }
  defenderDice.sort((a, b) => b - a);

  let attackerLosses = 0;
  let defenderLosses = 0;

  const pairs = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < pairs; i++) {
    if (attackerDice[i] > defenderDice[i]) {
      defenderLosses++;
    } else {
      attackerLosses++; // ties go to defender
    }
  }

  return { attackerDice, defenderDice, attackerLosses, defenderLosses };
}

/**
 * Build a CombatState object from a combat result.
 */
export function buildCombatState(
  attackingTerritory: TerritoryId,
  defendingTerritory: TerritoryId,
  result: CombatResult,
): CombatState {
  return {
    attackingTerritory,
    defendingTerritory,
    attackerDice: result.attackerDice,
    defenderDice: result.defenderDice,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    resolved: true,
  };
}
