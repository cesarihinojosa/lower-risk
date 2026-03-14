import { describe, it, expect, beforeEach } from "vitest";
import {
  validateAction,
  validateJoin,
  validateStartGame,
  validatePlaceInitialTroop,
} from "../validation";
import {
  createGame,
  addPlayer,
  startGame,
  getSetupTroopsRemaining,
  STARTING_TROOPS,
} from "../state";
import { setRng, resetRng } from "../rng";
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

describe("validatePlaceInitialTroop", () => {
  let state: GameState;

  beforeEach(() => {
    // Use deterministic RNG for territory assignment
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

  it("should be in setup phase after starting", () => {
    expect(state.status).toBe("setup");
  });

  it("should have assigned all 42 territories", () => {
    const assigned = Object.values(state.territories).filter((t) => t.owner !== null);
    expect(assigned).toHaveLength(42);
  });

  it("should have placed 1 troop on each territory", () => {
    for (const territory of Object.values(state.territories)) {
      expect(territory.troops).toBe(1);
    }
  });

  it("should allow placing troop on own territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([_, t]) => t.owner === currentPlayer,
    )!;
    const result = validatePlaceInitialTroop(
      state,
      currentPlayer,
      ownTerritory[0] as TerritoryId,
    );
    expect(result.valid).toBe(true);
  });

  it("should reject placing troop on enemy territory", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const enemyTerritory = Object.entries(state.territories).find(
      ([_, t]) => t.owner !== null && t.owner !== currentPlayer,
    )!;
    const result = validatePlaceInitialTroop(
      state,
      currentPlayer,
      enemyTerritory[0] as TerritoryId,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("You don't own this territory");
  });

  it("should reject placing troop when not your turn", () => {
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const otherPlayer = state.turnOrder.find((id) => id !== currentPlayer)!;
    const ownTerritory = Object.entries(state.territories).find(
      ([_, t]) => t.owner === otherPlayer,
    )!;
    const result = validatePlaceInitialTroop(
      state,
      otherPlayer,
      ownTerritory[0] as TerritoryId,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Not your turn");
  });

  it("should reject placing troop when not in setup phase", () => {
    state.status = "playing";
    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    const ownTerritory = Object.entries(state.territories).find(
      ([_, t]) => t.owner === currentPlayer,
    )!;
    const result = validatePlaceInitialTroop(
      state,
      currentPlayer,
      ownTerritory[0] as TerritoryId,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Game is not in setup phase");
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

  it("each player should have 21 remaining troops in 3-player game", () => {
    // 35 starting - 14 territories = 21 remaining
    for (const pid of ["p1", "p2", "p3"]) {
      expect(getSetupTroopsRemaining(state, pid)).toBe(21);
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
