/**
 * End-to-end game simulation with random valid moves.
 * Plays entire games to completion and checks invariants after every action.
 */
import { describe, it, expect, afterEach } from "vitest";
import { applyAction, type ActionResult } from "../engine";
import { createGame, addPlayer, startGame, getCurrentPlayerId } from "../state";
import { setRng, resetRng } from "../rng";
import { getAdjacent } from "../territories";
import { isValidCardSet } from "../validation";
import type { GameState, GameAction, TerritoryId } from "../../../shared/types";

function createSeededRng(seed: number): () => number {
  // Simple mulberry32 PRNG
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertInvariants(state: GameState): void {
  // Every territory has an owner and at least 1 troop (during playing/finished)
  if (state.status === "playing" || state.status === "finished") {
    for (const [id, territory] of Object.entries(state.territories)) {
      if (territory.owner === null) {
        // Only ok if combat just conquered it and troops haven't moved in yet
        if (
          state.combatState &&
          !state.combatState.resolved &&
          state.combatState.defendingTerritory === id
        ) {
          continue;
        }
      }
      // Territory with an owner should have >= 1 troop
      // Exception: just-conquered territory waiting for troop move
      if (
        territory.owner !== null &&
        territory.troops < 1 &&
        !(
          state.combatState &&
          !state.combatState.resolved &&
          state.combatState.defendingTerritory === id
        )
      ) {
        throw new Error(
          `Territory ${id} owned by ${territory.owner} has ${territory.troops} troops`,
        );
      }
    }
  }

  // Total territories === 42
  expect(Object.keys(state.territories)).toHaveLength(42);

  // No eliminated player owns territories
  for (const player of state.players) {
    if (player.eliminated) {
      const owned = Object.values(state.territories).filter(
        (t) => t.owner === player.id,
      );
      expect(owned).toHaveLength(0);
    }
  }

  // Turn index is valid
  expect(state.currentTurnIndex).toBeLessThan(state.turnOrder.length);

  // reinforcementsRemaining should never be negative
  expect(state.reinforcementsRemaining).toBeGreaterThanOrEqual(0);

  // Non-eliminated players should have consistent card counts
  for (const player of state.players) {
    expect(player.cards.length).toBe(player.cardCount);
  }
}

function getRandomValidAction(
  state: GameState,
  rng: () => number,
): GameAction | null {
  const playerId = getCurrentPlayerId(state);
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return null;

  // Handle pending troop movement after conquest
  if (state.combatState && !state.combatState.resolved) {
    const attackingTroops =
      state.territories[state.combatState.attackingTerritory]?.troops || 0;
    const minTroops = state.combatState.attackerDice.length;
    const maxTroops = Math.max(minTroops, attackingTroops - 1);
    const troops = minTroops + Math.floor(rng() * (maxTroops - minTroops + 1));
    return { type: "move_troops_after_conquest", playerId, troops };
  }

  if (state.currentPhase === "reinforce") {
    // Trade cards if we have 5+ or if we have a valid set (50% chance)
    if (player.cards.length >= 3) {
      const shouldTrade = player.cards.length >= 5 || rng() < 0.5;
      if (shouldTrade) {
        const tradeAction = findValidCardTrade(player.cards, playerId);
        if (tradeAction) return tradeAction;
      }
    }

    if (state.reinforcementsRemaining > 0) {
      // Place all reinforcements on frontline territories (those adjacent to enemies)
      const frontline = Object.entries(state.territories)
        .filter(([id, t]) => {
          if (t.owner !== playerId) return false;
          return getAdjacent(id as TerritoryId).some(
            (a) => state.territories[a]?.owner !== playerId,
          );
        })
        .map(([id]) => id as TerritoryId);

      const targets = frontline.length > 0
        ? frontline
        : Object.entries(state.territories)
            .filter(([, t]) => t.owner === playerId)
            .map(([id]) => id as TerritoryId);

      if (targets.length === 0) return null;

      const tid = targets[Math.floor(rng() * targets.length)];
      // Place all remaining at once for efficiency
      return {
        type: "place_troops",
        playerId,
        placements: [{ territoryId: tid, count: state.reinforcementsRemaining }],
      };
    }

    // Check forced trade-in at 5+ cards
    if (player.cards.length >= 5) {
      const tradeAction = findValidCardTrade(player.cards, playerId);
      if (tradeAction) return tradeAction;
    }

    return { type: "done_reinforcing", playerId };
  }

  if (state.currentPhase === "attack") {
    // Find all valid attacks, sorted by advantage (our troops - their troops)
    const attacks: { from: TerritoryId; to: TerritoryId; advantage: number }[] = [];
    for (const [id, t] of Object.entries(state.territories)) {
      if (t.owner !== playerId || t.troops < 2) continue;
      const from = id as TerritoryId;
      for (const adj of getAdjacent(from)) {
        const target = state.territories[adj];
        if (target && target.owner !== null && target.owner !== playerId) {
          attacks.push({ from, to: adj, advantage: t.troops - target.troops });
        }
      }
    }

    if (attacks.length === 0) {
      return { type: "done_attacking", playerId };
    }

    // Sort by advantage descending — attack weakest targets with strongest armies
    attacks.sort((a, b) => b.advantage - a.advantage);

    // Only stop attacking if we have no good attacks (advantage < -2) or 5% random chance
    const bestAdvantage = attacks[0].advantage;
    if (bestAdvantage < -2 && rng() < 0.7) {
      return { type: "done_attacking", playerId };
    }
    if (rng() < 0.05) {
      return { type: "done_attacking", playerId };
    }

    // Pick from top attacks with some randomness
    const topN = Math.min(3, attacks.length);
    const pick = attacks[Math.floor(rng() * topN)];
    const maxDice = Math.min(3, state.territories[pick.from].troops - 1);
    // Always use max dice
    return { type: "select_attack", playerId, from: pick.from, to: pick.to, dice: maxDice };
  }

  if (state.currentPhase === "fortify") {
    // 50% chance to fortify, 50% to skip
    if (rng() < 0.5) {
      return { type: "skip_fortify", playerId };
    }

    // Find a valid fortify pair
    const ownTerritories = Object.entries(state.territories)
      .filter(([, t]) => t.owner === playerId && t.troops >= 2)
      .map(([id]) => id as TerritoryId);

    for (const from of ownTerritories) {
      const adj = getAdjacent(from);
      const ownAdj = adj.filter((a) => state.territories[a]?.owner === playerId);
      if (ownAdj.length > 0) {
        const to = ownAdj[Math.floor(rng() * ownAdj.length)];
        const maxTroops = state.territories[from].troops - 1;
        const troops = 1 + Math.floor(rng() * maxTroops);
        return { type: "fortify", playerId, from, to, troops };
      }
    }

    return { type: "skip_fortify", playerId };
  }

  return null;
}

function findValidCardTrade(
  cards: { type: string; territory: TerritoryId }[],
  playerId: string,
): GameAction | null {
  // Try all combinations of 3
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (isValidCardSet([cards[i], cards[j], cards[k]])) {
          return {
            type: "trade_cards",
            playerId,
            cardIndices: [i, j, k] as [number, number, number],
          };
        }
      }
    }
  }
  return null;
}

function runSimulation(seed: number): {
  state: GameState;
  moveCount: number;
} {
  const rng = createSeededRng(seed);

  // Use seeded RNG for game setup too
  setRng(rng);

  let state = createGame();
  state = addPlayer(state, "p1", "Alice");
  state = addPlayer(state, "p2", "Bob");
  state = addPlayer(state, "p3", "Carol");
  state = startGame(state);

  const MAX_MOVES = 15000;
  let moveCount = 0;

  while (state.status !== "finished" && moveCount < MAX_MOVES) {
    // Use a separate RNG for move selection vs dice rolls
    const action = getRandomValidAction(state, rng);
    if (!action) {
      throw new Error(
        `No valid action found at move ${moveCount}, phase=${state.currentPhase}, status=${state.status}`,
      );
    }

    // Set dice RNG for combat
    setRng(rng);
    const result: ActionResult = applyAction(state, action);

    if (!result.success) {
      continue;
    }

    state = result.state;
    moveCount++;

    // Check invariants after every action
    assertInvariants(state);
  }

  return { state, moveCount };
}

describe("full game simulation", () => {
  afterEach(() => resetRng());

  it("should complete a 3-player game with seed 1", () => {
    const { state, moveCount } = runSimulation(1);
    expect(state.status).toBe("finished");
    expect(state.winner).toBeTruthy();
    expect(moveCount).toBeLessThan(15000);
  });

  it("should complete a 3-player game with seed 42", () => {
    const { state, moveCount } = runSimulation(42);
    expect(state.status).toBe("finished");
    expect(state.winner).toBeTruthy();
    expect(moveCount).toBeLessThan(15000);
  });

  it("should complete a 3-player game with seed 999", () => {
    const { state, moveCount } = runSimulation(999);
    expect(state.status).toBe("finished");
    expect(state.winner).toBeTruthy();
    expect(moveCount).toBeLessThan(15000);
  });

  it("should complete a 3-player game with seed 12345", () => {
    const { state, moveCount } = runSimulation(12345);
    expect(state.status).toBe("finished");
    expect(state.winner).toBeTruthy();
    expect(moveCount).toBeLessThan(15000);
  });

  it("should complete a 3-player game with seed 77777", () => {
    const { state, moveCount } = runSimulation(77777);
    expect(state.status).toBe("finished");
    expect(state.winner).toBeTruthy();
    expect(moveCount).toBeLessThan(15000);
  });
});
