import { describe, it, expect, beforeEach } from "vitest";
import {
  validateAction,
  validateJoin,
  validateStartGame,
  validatePlaceTroops,
  validateSelectAttack,
  validateDoneReinforcing,
  validateDoneAttacking,
  validateFortify,
  validateSkipFortify,
} from "../validation";
import {
  createGame,
  addPlayer,
  startGame,
  getSetupTroopsRemaining,
  STARTING_TROOPS,
} from "../state";
import { setRng, resetRng } from "../rng";
import { getAdjacent, areAdjacent } from "../territories";
import type { GameState, TerritoryId } from "../../../shared/types";

// Deterministic RNG for tests
function createSequenceRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

describe("validateJoin", () => {
  let state: GameState;

  beforeEach(() => {
    state = createGame();
  });

  it("should allow joining a lobby game", () => {
    const result = validateJoin(state, "p1", "Alice");
    expect(result.valid).toBe(true);
  });

  it("should reject joining a started game", () => {
    state.status = "playing";
    const result = validateJoin(state, "p1", "Alice");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Game has already started");
  });

  it("should reject joining a full game", () => {
    state.settings.maxPlayers = 3;
    state = addPlayer(state, "p1", "Alice");
    state = addPlayer(state, "p2", "Bob");
    state = addPlayer(state, "p3", "Carol");
    const result = validateJoin(state, "p4", "Dave");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Game is full");
  });

  it("should reject duplicate player ID", () => {
    state = addPlayer(state, "p1", "Alice");
    const result = validateJoin(state, "p1", "Bob");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Already in this game");
  });

  it("should reject empty name", () => {
    const result = validateJoin(state, "p1", "");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Name is required");
  });

  it("should reject whitespace-only name", () => {
    const result = validateJoin(state, "p1", "   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Name is required");
  });

  it("should reject name over 20 characters", () => {
    const result = validateJoin(state, "p1", "A".repeat(21));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Name too long");
  });

  it("should reject duplicate name", () => {
    state = addPlayer(state, "p1", "Alice");
    const result = validateJoin(state, "p2", "Alice");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Name already taken");
  });
});

describe("validateStartGame", () => {
  let state: GameState;

  beforeEach(() => {
    state = createGame();
    state = addPlayer(state, "host", "Alice");
    state = addPlayer(state, "p2", "Bob");
    state = addPlayer(state, "p3", "Carol");
  });

  it("should allow host to start with 3+ players", () => {
    const result = validateStartGame(state, "host");
    expect(result.valid).toBe(true);
  });

  it("should reject non-host starting", () => {
    const result = validateStartGame(state, "p2");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Only the host can start the game");
  });

  it("should reject starting with fewer than 3 players", () => {
    state.players = state.players.slice(0, 2);
    const result = validateStartGame(state, "host");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Need at least 3 players to start");
  });

  it("should reject starting when not in lobby", () => {
    state.status = "playing";
    const result = validateStartGame(state, "host");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Game is not in lobby");
  });

  it("should allow starting with max players", () => {
    state = addPlayer(state, "p4", "Dave");
    state = addPlayer(state, "p5", "Eve");
    state = addPlayer(state, "p6", "Frank");
    const result = validateStartGame(state, "host");
    expect(result.valid).toBe(true);
  });
});

describe("startGame auto-distribution", () => {
  let state: GameState;

  beforeEach(() => {
    setRng(createSequenceRng([
      0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
      0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95,
      0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92,
      0.11, 0.21, 0.31, 0.41, 0.51, 0.61, 0.71, 0.81, 0.91,
      0.13, 0.23, 0.33, 0.43, 0.53, 0.63, 0.73, 0.83, 0.93,
      0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.94,
    ]));

    state = createGame();
    state = addPlayer(state, "p1", "Alice");
    state = addPlayer(state, "p2", "Bob");
    state = addPlayer(state, "p3", "Carol");
    state = startGame(state);

    resetRng();
  });

  it("should skip setup and go straight to playing", () => {
    expect(state.status).toBe("playing");
    expect(state.currentPhase).toBe("reinforce");
  });

  it("should have assigned all 42 territories", () => {
    const assigned = Object.values(state.territories).filter((t) => t.owner !== null);
    expect(assigned).toHaveLength(42);
  });

  it("should have auto-distributed all starting troops", () => {
    // 3 players × 35 troops each = 105 total troops
    const totalTroops = Object.values(state.territories).reduce((sum, t) => sum + t.troops, 0);
    expect(totalTroops).toBe(105);
  });

  it("each territory should have at least 1 troop", () => {
    for (const territory of Object.values(state.territories)) {
      expect(territory.troops).toBeGreaterThanOrEqual(1);
    }
  });

  it("each player should have 35 total troops in a 3-player game", () => {
    for (const pid of ["p1", "p2", "p3"]) {
      const playerTroops = Object.values(state.territories)
        .filter((t) => t.owner === pid)
        .reduce((sum, t) => sum + t.troops, 0);
      expect(playerTroops).toBe(35);
    }
  });
});

describe("validateAction dispatch", () => {
  it("should dispatch to correct validator for start_game", () => {
    let state = createGame();
    state = addPlayer(state, "host", "Alice");
    // Only 1 player, so start should fail with "not enough players"
    const result = validateAction(state, { type: "start_game", playerId: "host" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Need at least 3 players to start");
  });

  it("should reject unknown action types", () => {
    const state = createGame();
    const result = validateAction(state, { type: "nonexistent" } as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Unknown action type");
  });

  it("should reject playing-phase actions when not playing", () => {
    const state = createGame();
    const result = validateAction(state, {
      type: "done_attacking",
      playerId: "p1",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Game is not in playing phase");
  });
});

describe("setup flow integration", () => {
  let state: GameState;

  beforeEach(() => {
    setRng(createSequenceRng([
      0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
      0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95,
      0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92,
      0.11, 0.21, 0.31, 0.41, 0.51, 0.61, 0.71, 0.81, 0.91,
      0.13, 0.23, 0.33, 0.43, 0.53, 0.63, 0.73, 0.83, 0.93,
      0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.94,
    ]));

    state = createGame();
    state = addPlayer(state, "p1", "Alice");
    state = addPlayer(state, "p2", "Bob");
    state = addPlayer(state, "p3", "Carol");
    state = startGame(state);
    resetRng();
  });

  it("should distribute territories evenly among 3 players", () => {
    const counts: Record<string, number> = {};
    for (const t of Object.values(state.territories)) {
      counts[t.owner!] = (counts[t.owner!] || 0) + 1;
    }
    // 42 / 3 = 14 each
    expect(counts["p1"]).toBe(14);
    expect(counts["p2"]).toBe(14);
    expect(counts["p3"]).toBe(14);
  });

  it("all starting troops should be placed (no remaining)", () => {
    // With auto-distribution, all troops are placed during startGame
    for (const pid of ["p1", "p2", "p3"]) {
      expect(getSetupTroopsRemaining(state, pid)).toBe(0);
    }
  });

  it("should have 3 players in turn order", () => {
    expect(state.turnOrder).toHaveLength(3);
    expect(new Set(state.turnOrder).size).toBe(3);
  });

  it("should set the card deck", () => {
    // 42 territory cards + 2 wilds = 44
    expect(state.cardDeck).toHaveLength(44);
  });
});

// ===== Playing Phase Validation Tests =====

function createPlayingState(): GameState {
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
  state.reinforcementsRemaining = 5;
  state.conqueredThisTurn = false;

  return state;
}

describe("validatePlaceTroops", () => {
  let state: GameState;

  beforeEach(() => {
    state = createPlayingState();
  });

  it("should allow placing troops on own territory during reinforce", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === currentPlayer,
    )!;
    const result = validatePlaceTroops(state, {
      type: "place_troops",
      playerId: currentPlayer,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: 3 }],
    });
    expect(result.valid).toBe(true);
  });

  it("should reject placing troops on enemy territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const enemyTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner !== null && t.owner !== currentPlayer,
    )!;
    const result = validatePlaceTroops(state, {
      type: "place_troops",
      playerId: currentPlayer,
      placements: [{ territoryId: enemyTerritory[0] as TerritoryId, count: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("You don't own this territory");
  });

  it("should reject placing more troops than available", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === currentPlayer,
    )!;
    const result = validatePlaceTroops(state, {
      type: "place_troops",
      playerId: currentPlayer,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: 100 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Not enough reinforcements");
  });

  it("should reject placing troops when not your turn", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const otherPlayer = state.turnOrder.find((id) => id !== currentPlayer)!;
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === otherPlayer,
    )!;
    const result = validatePlaceTroops(state, {
      type: "place_troops",
      playerId: otherPlayer,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Not your turn");
  });

  it("should reject placing troops during attack phase", () => {
    state.currentPhase = "attack";
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === currentPlayer,
    )!;
    const result = validatePlaceTroops(state, {
      type: "place_troops",
      playerId: currentPlayer,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Can only place troops during reinforce phase");
  });

  it("should reject negative troop count", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === currentPlayer,
    )!;
    const result = validatePlaceTroops(state, {
      type: "place_troops",
      playerId: currentPlayer,
      placements: [{ territoryId: ownTerritory[0] as TerritoryId, count: -1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Troop count must be positive");
  });
});

describe("validateSelectAttack", () => {
  let state: GameState;

  beforeEach(() => {
    state = createPlayingState();
    state.currentPhase = "attack";
    state.reinforcementsRemaining = 0;
  });

  it("should allow valid attack", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    // Find an own territory with adjacent enemy
    const { from, to } = findAttackPair(state, currentPlayer);
    // Ensure attacker has 2+ troops
    state.territories[from].troops = 3;

    const result = validateSelectAttack(state, {
      type: "select_attack",
      playerId: currentPlayer,
      from,
      to,
      dice: 2,
    });
    expect(result.valid).toBe(true);
  });

  it("should reject attacking own territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritories = Object.entries(state.territories)
      .filter(([, t]) => t.owner === currentPlayer)
      .map(([id]) => id as TerritoryId);

    // Find two adjacent own territories
    // using imported getAdjacent
    let from: TerritoryId | null = null;
    let to: TerritoryId | null = null;
    for (const tid of ownTerritories) {
      const adj = getAdjacent(tid);
      const adjOwn = adj.find((a: TerritoryId) => state.territories[a]?.owner === currentPlayer);
      if (adjOwn) {
        from = tid;
        to = adjOwn;
        break;
      }
    }
    if (!from || !to) return; // skip if no adjacent own territories

    state.territories[from].troops = 3;
    const result = validateSelectAttack(state, {
      type: "select_attack",
      playerId: currentPlayer,
      from,
      to,
      dice: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Cannot attack your own territory");
  });

  it("should reject attacking with only 1 troop", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const { from, to } = findAttackPair(state, currentPlayer);
    state.territories[from].troops = 1;

    const result = validateSelectAttack(state, {
      type: "select_attack",
      playerId: currentPlayer,
      from,
      to,
      dice: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Need at least 2 troops to attack");
  });

  it("should reject attacking non-adjacent territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritories = Object.entries(state.territories)
      .filter(([, t]) => t.owner === currentPlayer)
      .map(([id]) => id as TerritoryId);
    const enemyTerritories = Object.entries(state.territories)
      .filter(([, t]) => t.owner !== null && t.owner !== currentPlayer)
      .map(([id]) => id as TerritoryId);

    // Find non-adjacent pair
    // using imported areAdjacent
    const from = ownTerritories[0];
    state.territories[from].troops = 5;
    const to = enemyTerritories.find((e) => !areAdjacent(from, e))!;
    if (!to) return;

    const result = validateSelectAttack(state, {
      type: "select_attack",
      playerId: currentPlayer,
      from,
      to,
      dice: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Territories are not adjacent");
  });

  it("should reject using too many dice", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const { from, to } = findAttackPair(state, currentPlayer);
    state.territories[from].troops = 2; // max 1 die

    const result = validateSelectAttack(state, {
      type: "select_attack",
      playerId: currentPlayer,
      from,
      to,
      dice: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Must use between 1 and 1 dice/);
  });

  it("should reject attacking during reinforce phase", () => {
    state.currentPhase = "reinforce";
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const { from, to } = findAttackPair(state, currentPlayer);
    state.territories[from].troops = 3;

    const result = validateSelectAttack(state, {
      type: "select_attack",
      playerId: currentPlayer,
      from,
      to,
      dice: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Can only attack during attack phase");
  });
});

describe("validateDoneReinforcing", () => {
  let state: GameState;

  beforeEach(() => {
    state = createPlayingState();
  });

  it("should reject when reinforcements remain", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const result = validateDoneReinforcing(state, currentPlayer);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Must place all reinforcements before continuing");
  });

  it("should allow when all reinforcements placed", () => {
    state.reinforcementsRemaining = 0;
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const result = validateDoneReinforcing(state, currentPlayer);
    expect(result.valid).toBe(true);
  });
});

describe("validateFortify", () => {
  let state: GameState;

  beforeEach(() => {
    state = createPlayingState();
    state.currentPhase = "fortify";
  });

  it("should reject fortifying from enemy territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const enemyTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner !== null && t.owner !== currentPlayer,
    )!;
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === currentPlayer,
    )!;

    const result = validateFortify(state, {
      type: "fortify",
      playerId: currentPlayer,
      from: enemyTerritory[0] as TerritoryId,
      to: ownTerritory[0] as TerritoryId,
      troops: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("You don't own the source territory");
  });

  it("should reject fortifying to enemy territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner === currentPlayer,
    )!;
    const enemyTerritory = Object.entries(state.territories).find(
      ([, t]) => t.owner !== null && t.owner !== currentPlayer,
    )!;

    state.territories[ownTerritory[0] as TerritoryId].troops = 5;
    const result = validateFortify(state, {
      type: "fortify",
      playerId: currentPlayer,
      from: ownTerritory[0] as TerritoryId,
      to: enemyTerritory[0] as TerritoryId,
      troops: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("You don't own the destination territory");
  });

  it("should reject leaving 0 troops behind", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    // using imported getAdjacent

    // Find two adjacent own territories
    const ownTerritories = Object.entries(state.territories)
      .filter(([, t]) => t.owner === currentPlayer)
      .map(([id]) => id as TerritoryId);

    let from: TerritoryId | null = null;
    let to: TerritoryId | null = null;
    for (const tid of ownTerritories) {
      const adj = getAdjacent(tid);
      const adjOwn = adj.find((a: TerritoryId) => state.territories[a]?.owner === currentPlayer);
      if (adjOwn) {
        from = tid;
        to = adjOwn;
        break;
      }
    }
    if (!from || !to) return;

    state.territories[from].troops = 3;
    const result = validateFortify(state, {
      type: "fortify",
      playerId: currentPlayer,
      from,
      to,
      troops: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Must leave at least 1 troop behind");
  });

  it("should reject fortifying during attack phase", () => {
    state.currentPhase = "attack";
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const result = validateFortify(state, {
      type: "fortify",
      playerId: currentPlayer,
      from: "alaska" as TerritoryId,
      to: "alberta" as TerritoryId,
      troops: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Can only fortify during fortify phase");
  });
});

describe("validateSkipFortify", () => {
  it("should allow skipping during fortify phase", () => {
    const state = createPlayingState();
    state.currentPhase = "fortify";
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const result = validateSkipFortify(state, currentPlayer);
    expect(result.valid).toBe(true);
  });

  it("should reject skipping during attack phase", () => {
    const state = createPlayingState();
    state.currentPhase = "attack";
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const result = validateSkipFortify(state, currentPlayer);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Not in fortify phase");
  });
});

// Helper to find an own territory adjacent to an enemy territory
function findAttackPair(state: GameState, playerId: string): { from: TerritoryId; to: TerritoryId } {
  const ownTerritories = Object.entries(state.territories)
    .filter(([, t]) => t.owner === playerId)
    .map(([id]) => id as TerritoryId);

  for (const tid of ownTerritories) {
    const adj = getAdjacent(tid);
    const enemy = adj.find((a: TerritoryId) => {
      const t = state.territories[a];
      return t && t.owner !== null && t.owner !== playerId;
    });
    if (enemy) {
      return { from: tid, to: enemy };
    }
  }
  throw new Error("No valid attack pair found");
}
