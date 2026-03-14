import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyAction } from "../engine";
import { createGame, addPlayer, startGame } from "../state";
import { setRng, resetRng } from "../rng";
import type { GameState, TerritoryId, GameAction } from "../../../shared/types";
import { getAdjacent } from "../territories";

function createSequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function setupPlayingGame(): GameState {
  setRng(createSequenceRng([
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95,
    0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92,
    0.11, 0.21, 0.31, 0.41, 0.51, 0.61, 0.71, 0.81, 0.91,
    0.13, 0.23, 0.33, 0.43, 0.53, 0.63, 0.73, 0.83, 0.93,
    0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.94,
  ]));

  let state = createGame();
  state = addPlayer(state, "p1", "Alice");
  state = addPlayer(state, "p2", "Bob");
  state = addPlayer(state, "p3", "Carol");
  state = startGame(state);
  resetRng();

  // Force into playing state
  state.status = "playing";
  state.currentPhase = "reinforce";
  state.turnNumber = 1;
  state.conqueredThisTurn = false;

  // Calculate initial reinforcements
  const currentPlayer = state.turnOrder[state.currentTurnIndex];
  const ownedCount = Object.values(state.territories).filter(
    (t) => t.owner === currentPlayer,
  ).length;
  state.reinforcementsRemaining = Math.max(3, Math.floor(ownedCount / 3));

  return state;
}

function findAttackPair(
  state: GameState,
  playerId: string,
): { from: TerritoryId; to: TerritoryId } {
  const ownTerritories = Object.entries(state.territories)
    .filter(([, t]) => t.owner === playerId)
    .map(([id]) => id as TerritoryId);

  for (const tid of ownTerritories) {
    const adj = getAdjacent(tid);
    const enemy = adj.find((a) => {
      const t = state.territories[a];
      return t && t.owner !== null && t.owner !== playerId;
    });
    if (enemy) return { from: tid, to: enemy };
  }
  throw new Error("No valid attack pair found");
}

describe("full turn cycle", () => {
  let state: GameState;

  beforeEach(() => {
    state = setupPlayingGame();
  });

  afterEach(() => {
    resetRng();
  });

  it("should complete reinforce → attack → fortify → next player", () => {
    const player1 = state.turnOrder[state.currentTurnIndex];
    const initialReinforcements = state.reinforcementsRemaining;
    expect(initialReinforcements).toBeGreaterThanOrEqual(3);

    // 1. Place all reinforcements on own territory
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === player1,
    )!;
    const tid = ownTerritory[0] as TerritoryId;
    const originalTroops = state.territories[tid].troops;

    let result = applyAction(state, {
      type: "place_troops",
      playerId: player1,
      placements: [{ territoryId: tid, count: initialReinforcements }],
    });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.territories[tid].troops).toBe(originalTroops + initialReinforcements);
    expect(state.reinforcementsRemaining).toBe(0);

    // 2. Done reinforcing → attack phase
    result = applyAction(state, { type: "done_reinforcing", playerId: player1 });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.currentPhase).toBe("attack");

    // 3. Done attacking → fortify phase (skip attacking)
    result = applyAction(state, { type: "done_attacking", playerId: player1 });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.currentPhase).toBe("fortify");

    // 4. Skip fortify → next player's turn
    const turnBefore = state.turnNumber;
    result = applyAction(state, { type: "skip_fortify", playerId: player1 });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.currentPhase).toBe("reinforce");
    expect(state.turnNumber).toBe(turnBefore + 1);

    // Next player should be different
    const player2 = state.turnOrder[state.currentTurnIndex];
    expect(player2).not.toBe(player1);
    expect(state.reinforcementsRemaining).toBeGreaterThanOrEqual(3);
  });

  it("should handle attack and conquest", () => {
    const player1 = state.turnOrder[state.currentTurnIndex];

    // Place reinforcements
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === player1,
    )!;
    let result = applyAction(state, {
      type: "place_troops",
      playerId: player1,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: state.reinforcementsRemaining }],
    });
    state = result.state;

    // Done reinforcing
    result = applyAction(state, { type: "done_reinforcing", playerId: player1 });
    state = result.state;
    expect(state.currentPhase).toBe("attack");

    // Set up a guaranteed win: attacker has lots of troops, defender has 1
    const { from, to } = findAttackPair(state, player1);
    state.territories[from] = { ...state.territories[from], troops: 10 };
    state.territories[to] = { ...state.territories[to], troops: 1 };

    // Seed dice so attacker wins: attacker rolls 6,6,6 and defender rolls 1
    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));

    result = applyAction(state, {
      type: "select_attack",
      playerId: player1,
      from,
      to,
      dice: 3,
    });
    expect(result.success).toBe(true);
    state = result.state;
    resetRng();

    // Territory should be conquered
    expect(state.territories[to].owner).toBe(player1);
    expect(state.combatState).not.toBeNull();
    expect(state.combatState!.resolved).toBe(false);

    // Move troops after conquest
    result = applyAction(state, {
      type: "move_troops_after_conquest",
      playerId: player1,
      troops: 3,
    });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.territories[to].troops).toBe(3);
    expect(state.combatState!.resolved).toBe(true);
    expect(state.conqueredThisTurn).toBe(true);
  });

  it("should draw a card when done attacking after a conquest", () => {
    const player1 = state.turnOrder[state.currentTurnIndex];
    const player1Data = state.players.find((p) => p.id === player1)!;
    const initialCards = player1Data.cards.length;

    // Place reinforcements
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === player1,
    )!;
    let result = applyAction(state, {
      type: "place_troops",
      playerId: player1,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: state.reinforcementsRemaining }],
    });
    state = result.state;

    result = applyAction(state, { type: "done_reinforcing", playerId: player1 });
    state = result.state;

    // Attack and conquer
    const { from, to } = findAttackPair(state, player1);
    state.territories[from] = { ...state.territories[from], troops: 10 };
    state.territories[to] = { ...state.territories[to], troops: 1 };
    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));

    result = applyAction(state, {
      type: "select_attack",
      playerId: player1,
      from,
      to,
      dice: 3,
    });
    state = result.state;
    resetRng();

    result = applyAction(state, {
      type: "move_troops_after_conquest",
      playerId: player1,
      troops: 3,
    });
    state = result.state;

    // Done attacking — should draw a card
    result = applyAction(state, { type: "done_attacking", playerId: player1 });
    state = result.state;

    const updatedPlayer = state.players.find((p) => p.id === player1)!;
    expect(updatedPlayer.cards.length).toBe(initialCards + 1);
  });

  it("should handle fortify between connected territories", () => {
    const player1 = state.turnOrder[state.currentTurnIndex];

    // Skip to fortify phase
    state.reinforcementsRemaining = 0;
    let result = applyAction(state, { type: "done_reinforcing", playerId: player1 });
    state = result.state;
    result = applyAction(state, { type: "done_attacking", playerId: player1 });
    state = result.state;
    expect(state.currentPhase).toBe("fortify");

    // Find two adjacent own territories
    const ownTerritories = Object.entries(state.territories)
      .filter(([, t]) => t.owner === player1)
      .map(([id]) => id as TerritoryId);

    let from: TerritoryId | null = null;
    let to: TerritoryId | null = null;
    for (const tid of ownTerritories) {
      const adj = getAdjacent(tid);
      const adjOwn = adj.find((a) => state.territories[a]?.owner === player1);
      if (adjOwn) {
        from = tid;
        to = adjOwn;
        break;
      }
    }

    if (!from || !to) return; // skip if no adjacent own territories

    state.territories[from] = { ...state.territories[from], troops: 5 };

    result = applyAction(state, {
      type: "fortify",
      playerId: player1,
      from,
      to,
      troops: 3,
    });
    expect(result.success).toBe(true);
    state = result.state;

    // Troops should have moved
    expect(state.territories[from].troops).toBe(2);
    // Turn should advance
    expect(state.currentPhase).toBe("reinforce");
    expect(state.turnOrder[state.currentTurnIndex]).not.toBe(player1);
  });
});

describe("conquest + elimination", () => {
  afterEach(() => resetRng());

  it("should eliminate defender and inherit cards when conquering last territory", () => {
    let state = setupPlayingGame();
    const attacker = state.turnOrder[state.currentTurnIndex];
    const defender = state.turnOrder.find((id) => id !== attacker)!;
    const thirdPlayer = state.turnOrder.find((id) => id !== attacker && id !== defender)!;

    // Give defender cards
    state.players = state.players.map((p) => {
      if (p.id === defender) {
        return {
          ...p,
          cards: [
            { territory: "alaska" as TerritoryId, type: "infantry" as const },
            { territory: "brazil" as TerritoryId, type: "cavalry" as const },
          ],
          cardCount: 2,
        };
      }
      return p;
    });

    // Give attacker all territories except one for defender
    for (const tid of Object.keys(state.territories)) {
      state.territories[tid as TerritoryId] = { owner: attacker, troops: 5 };
    }
    state.territories["northwest_territory"] = { owner: defender, troops: 1 };
    // Third player is already eliminated
    state.players = state.players.map((p) => {
      if (p.id === thirdPlayer) return { ...p, eliminated: true };
      return p;
    });

    // Skip to attack phase
    state.currentPhase = "attack";
    state.reinforcementsRemaining = 0;

    // Attack with guaranteed win
    const from: TerritoryId = "alaska";
    state.territories[from] = { owner: attacker, troops: 10 };
    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));

    let result = applyAction(state, {
      type: "select_attack",
      playerId: attacker,
      from,
      to: "northwest_territory",
      dice: 3,
    });
    expect(result.success).toBe(true);
    state = result.state;
    resetRng();

    // Defender should be eliminated
    const defenderPlayer = state.players.find((p) => p.id === defender)!;
    expect(defenderPlayer.eliminated).toBe(true);
    expect(defenderPlayer.cards).toEqual([]);

    // Attacker should have inherited defender's cards
    const attackerPlayer = state.players.find((p) => p.id === attacker)!;
    expect(attackerPlayer.cards.length).toBe(2);
    expect(attackerPlayer.cards[0].territory).toBe("alaska");
    expect(attackerPlayer.cards[1].territory).toBe("brazil");
  });

  it("should force trade-in when inheriting cards brings total to 5+", () => {
    let state = setupPlayingGame();
    const attacker = state.turnOrder[state.currentTurnIndex];
    const defender = state.turnOrder.find((id) => id !== attacker)!;
    const thirdPlayer = state.turnOrder.find((id) => id !== attacker && id !== defender)!;

    // Give attacker 3 cards already
    state.players = state.players.map((p) => {
      if (p.id === attacker) {
        return {
          ...p,
          cards: [
            { territory: "argentina" as TerritoryId, type: "infantry" as const },
            { territory: "brazil" as TerritoryId, type: "infantry" as const },
            { territory: "peru" as TerritoryId, type: "infantry" as const },
          ],
          cardCount: 3,
        };
      }
      if (p.id === defender) {
        return {
          ...p,
          cards: [
            { territory: "alaska" as TerritoryId, type: "cavalry" as const },
            { territory: "greenland" as TerritoryId, type: "artillery" as const },
          ],
          cardCount: 2,
        };
      }
      return p;
    });

    // Set up board so defender has only one territory
    for (const tid of Object.keys(state.territories)) {
      state.territories[tid as TerritoryId] = { owner: attacker, troops: 5 };
    }
    state.territories["northwest_territory"] = { owner: defender, troops: 1 };
    state.players = state.players.map((p) => {
      if (p.id === thirdPlayer) return { ...p, eliminated: true };
      return p;
    });

    state.currentPhase = "attack";
    state.reinforcementsRemaining = 0;

    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));
    let result = applyAction(state, {
      type: "select_attack",
      playerId: attacker,
      from: "alaska",
      to: "northwest_territory",
      dice: 3,
    });
    state = result.state;
    resetRng();

    // Attacker should now have 5 cards (3 + 2 inherited)
    const attackerPlayer = state.players.find((p) => p.id === attacker)!;
    expect(attackerPlayer.cards.length).toBe(5);
    expect(attackerPlayer.cardCount).toBe(5);
  });
});

describe("card lifecycle", () => {
  afterEach(() => resetRng());

  it("should earn exactly 1 card per turn regardless of conquests", () => {
    let state = setupPlayingGame();
    const player1 = state.turnOrder[state.currentTurnIndex];
    const player1Cards = state.players.find((p) => p.id === player1)!.cards.length;

    // Place reinforcements
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === player1,
    )!;
    let result = applyAction(state, {
      type: "place_troops",
      playerId: player1,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: state.reinforcementsRemaining }],
    });
    state = result.state;

    result = applyAction(state, { type: "done_reinforcing", playerId: player1 });
    state = result.state;

    // Conquer first territory
    const pair1 = findAttackPair(state, player1);
    state.territories[pair1.from] = { ...state.territories[pair1.from], troops: 10 };
    state.territories[pair1.to] = { ...state.territories[pair1.to], troops: 1 };
    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));
    result = applyAction(state, {
      type: "select_attack",
      playerId: player1,
      from: pair1.from,
      to: pair1.to,
      dice: 3,
    });
    state = result.state;
    resetRng();

    // Move troops
    result = applyAction(state, {
      type: "move_troops_after_conquest",
      playerId: player1,
      troops: 3,
    });
    state = result.state;

    // Conquer second territory
    const pair2 = findAttackPair(state, player1);
    state.territories[pair2.from] = { ...state.territories[pair2.from], troops: 10 };
    state.territories[pair2.to] = { ...state.territories[pair2.to], troops: 1 };
    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));
    result = applyAction(state, {
      type: "select_attack",
      playerId: player1,
      from: pair2.from,
      to: pair2.to,
      dice: 3,
    });
    state = result.state;
    resetRng();

    result = applyAction(state, {
      type: "move_troops_after_conquest",
      playerId: player1,
      troops: 3,
    });
    state = result.state;

    // Done attacking — should draw exactly 1 card
    result = applyAction(state, { type: "done_attacking", playerId: player1 });
    state = result.state;

    const updatedPlayer = state.players.find((p) => p.id === player1)!;
    expect(updatedPlayer.cards.length).toBe(player1Cards + 1);
  });

  it("should trade in cards and receive escalating armies", () => {
    let state = setupPlayingGame();
    const player1 = state.turnOrder[state.currentTurnIndex];

    // Give player 3 infantry cards (valid set)
    state.players = state.players.map((p) => {
      if (p.id === player1) {
        return {
          ...p,
          cards: [
            { territory: "alaska" as TerritoryId, type: "infantry" as const },
            { territory: "brazil" as TerritoryId, type: "infantry" as const },
            { territory: "peru" as TerritoryId, type: "infantry" as const },
          ],
          cardCount: 3,
        };
      }
      return p;
    });

    const reinforcementsBefore = state.reinforcementsRemaining;
    const tradeCountBefore = state.tradeInCount;

    // Trade in
    let result = applyAction(state, {
      type: "trade_cards",
      playerId: player1,
      cardIndices: [0, 1, 2],
    });
    expect(result.success).toBe(true);
    state = result.state;

    // Should have received 4 armies (first trade-in)
    expect(state.reinforcementsRemaining).toBe(reinforcementsBefore + 4);
    expect(state.tradeInCount).toBe(tradeCountBefore + 1);

    // Cards should be removed
    const updatedPlayer = state.players.find((p) => p.id === player1)!;
    expect(updatedPlayer.cards.length).toBe(0);

    // Cards should be in discard pile
    expect(state.discardPile.length).toBe(3);
  });

  it("should apply territory bonus when traded card matches owned territory", () => {
    let state = setupPlayingGame();
    const player1 = state.turnOrder[state.currentTurnIndex];

    // Find a territory owned by player1
    const ownedTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === player1,
    )!;
    const ownedId = ownedTerritory[0] as TerritoryId;
    const troopsBefore = state.territories[ownedId].troops;

    // Give player cards including one that matches their territory
    state.players = state.players.map((p) => {
      if (p.id === player1) {
        return {
          ...p,
          cards: [
            { territory: ownedId, type: "infantry" as const },
            { territory: "alaska" as TerritoryId, type: "cavalry" as const },
            { territory: "brazil" as TerritoryId, type: "artillery" as const },
          ],
          cardCount: 3,
        };
      }
      return p;
    });

    let result = applyAction(state, {
      type: "trade_cards",
      playerId: player1,
      cardIndices: [0, 1, 2],
    });
    expect(result.success).toBe(true);
    state = result.state;

    // Territory should have +2 bonus troops
    expect(state.territories[ownedId].troops).toBe(troopsBefore + 2);
  });

  it("should reshuffle discard pile into deck when deck is empty", () => {
    let state = setupPlayingGame();
    const player1 = state.turnOrder[state.currentTurnIndex];

    // Empty the deck, put cards in discard
    const allCards = [...state.cardDeck];
    state.cardDeck = [];
    state.discardPile = allCards;

    // Simulate earning a card draw: set up conquest
    state.reinforcementsRemaining = 0;
    state.currentPhase = "attack";
    state.conqueredThisTurn = true;

    // Done attacking with conquest — should trigger draw, which reshuffles discard
    let result = applyAction(state, { type: "done_attacking", playerId: player1 });
    expect(result.success).toBe(true);
    state = result.state;

    // Player should have drawn a card
    const updatedPlayer = state.players.find((p) => p.id === player1)!;
    expect(updatedPlayer.cards.length).toBe(1);

    // Discard should now be empty (reshuffled into deck)
    expect(state.discardPile).toEqual([]);
    // Deck should have the rest
    expect(state.cardDeck.length).toBe(allCards.length - 1);
  });
});

describe("victory detection", () => {
  it("should detect victory when a player owns all 42 territories", () => {
    let state = setupPlayingGame();
    const player1 = state.turnOrder[state.currentTurnIndex];

    const defenderId = state.turnOrder.find((id) => id !== player1)!;

    // Give player1 all territories except one
    for (const tid of Object.keys(state.territories)) {
      state.territories[tid as TerritoryId] = { owner: player1, troops: 5 };
    }

    // Pick a specific territory pair for the final attack
    // alaska is adjacent to northwest_territory
    const from: TerritoryId = "alaska";
    const to: TerritoryId = "northwest_territory";
    state.territories[to] = { owner: defenderId, troops: 1 };

    // Make sure only this defender has territories
    // (eliminate other players)
    state.players = state.players.map((p) => {
      if (p.id !== player1 && p.id !== defenderId) {
        return { ...p, eliminated: true };
      }
      return p;
    });

    // Skip to attack phase
    state.currentPhase = "attack";
    state.reinforcementsRemaining = 0;

    // Attack with guaranteed win
    state.territories[from] = { ...state.territories[from], troops: 10 };
    setRng(createSequenceRng([0.99, 0.99, 0.99, 0.0]));

    let result = applyAction(state, {
      type: "select_attack",
      playerId: player1,
      from,
      to,
      dice: 3,
    });
    state = result.state;
    resetRng();

    // Move troops in
    result = applyAction(state, {
      type: "move_troops_after_conquest",
      playerId: player1,
      troops: 3,
    });
    state = result.state;

    expect(state.status).toBe("finished");
    expect(state.winner).toBe(player1);
  });
});
