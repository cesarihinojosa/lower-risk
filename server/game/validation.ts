import type { GameState, GameAction, TerritoryId } from "../../shared/types";
import { getHostId, getSetupTroopsRemaining, getCurrentPlayerId } from "./state";
import { areAdjacent } from "./territories";
import { areConnectedThroughOwned } from "./pathfinding";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

function ok(): ValidationResult {
  return { valid: true };
}

function fail(error: string): ValidationResult {
  return { valid: false, error };
}

export function validateAction(
  state: GameState,
  action: GameAction,
): ValidationResult {
  switch (action.type) {
    case "start_game":
      return validateStartGame(state, action.playerId);
    case "update_settings":
      return validateUpdateSettings(state, action.playerId);
    case "place_initial_troop":
      return validatePlaceInitialTroop(state, action.playerId, action.territoryId);
    case "place_troops":
      return validatePlaceTroops(state, action);
    case "done_reinforcing":
      return validateDoneReinforcing(state, action.playerId);
    case "select_attack":
      return validateSelectAttack(state, action);
    case "move_troops_after_conquest":
      return validateMoveTroopsAfterConquest(state, action);
    case "done_attacking":
      return validateDoneAttacking(state, action.playerId);
    case "fortify":
      return validateFortify(state, action);
    case "skip_fortify":
      return validateSkipFortify(state, action.playerId);
    case "trade_cards":
      return validateTradeCards(state, action);
    default:
      return fail("Unknown action type");
  }
}

// ===== Lobby Validators =====

export function validateStartGame(
  state: GameState,
  playerId: string,
): ValidationResult {
  if (state.status !== "lobby") {
    return fail("Game is not in lobby");
  }
  if (getHostId(state) !== playerId) {
    return fail("Only the host can start the game");
  }
  if (state.players.length < 3) {
    return fail("Need at least 3 players to start");
  }
  if (state.players.length > state.settings.maxPlayers) {
    return fail("Too many players");
  }
  return ok();
}

export function validateUpdateSettings(
  state: GameState,
  playerId: string,
): ValidationResult {
  if (state.status !== "lobby") {
    return fail("Can only update settings in lobby");
  }
  if (getHostId(state) !== playerId) {
    return fail("Only the host can update settings");
  }
  return ok();
}

export function validateJoin(
  state: GameState,
  playerId: string,
  name: string,
): ValidationResult {
  if (state.status !== "lobby") {
    return fail("Game has already started");
  }
  if (state.players.length >= state.settings.maxPlayers) {
    return fail("Game is full");
  }
  if (state.players.some((p) => p.id === playerId)) {
    return fail("Already in this game");
  }
  if (!name || name.trim().length === 0) {
    return fail("Name is required");
  }
  if (name.trim().length > 20) {
    return fail("Name too long");
  }
  if (state.players.some((p) => p.name === name.trim())) {
    return fail("Name already taken");
  }
  return ok();
}

// ===== Setup Validators =====

export function validatePlaceInitialTroop(
  state: GameState,
  playerId: string,
  territoryId: TerritoryId,
): ValidationResult {
  if (state.status !== "setup") {
    return fail("Game is not in setup phase");
  }

  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  if (currentPlayerId !== playerId) {
    return fail("Not your turn");
  }

  const territory = state.territories[territoryId];
  if (!territory) {
    return fail("Invalid territory");
  }
  if (territory.owner !== playerId) {
    return fail("You don't own this territory");
  }

  const remaining = getSetupTroopsRemaining(state, playerId);
  if (remaining <= 0) {
    return fail("No troops remaining to place");
  }

  return ok();
}

// ===== Playing Phase Validators =====

function checkTurn(state: GameState, playerId: string): ValidationResult | null {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  if (getCurrentPlayerId(state) !== playerId) return fail("Not your turn");
  return null; // passed
}

export function validatePlaceTroops(
  state: GameState,
  action: GameAction,
): ValidationResult {
  if (action.type !== "place_troops") return fail("Invalid action type");
  const turnCheck = checkTurn(state, action.playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "reinforce") {
    return fail("Can only place troops during reinforce phase");
  }

  // Check for pending combat (must move troops after conquest first)
  if (state.combatState && !state.combatState.resolved) {
    return fail("Must resolve combat first");
  }

  const available = state.reinforcementsRemaining;

  // Check all placements
  let totalPlaced = 0;
  for (const placement of action.placements) {
    if (placement.count <= 0) {
      return fail("Troop count must be positive");
    }
    const territory = state.territories[placement.territoryId];
    if (!territory) {
      return fail("Invalid territory");
    }
    if (territory.owner !== action.playerId) {
      return fail("You don't own this territory");
    }
    totalPlaced += placement.count;
  }

  if (totalPlaced > available) {
    return fail("Not enough reinforcements");
  }

  return ok();
}

export function validateDoneReinforcing(
  state: GameState,
  playerId: string,
): ValidationResult {
  const turnCheck = checkTurn(state, playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "reinforce") {
    return fail("Not in reinforce phase");
  }

  if (state.reinforcementsRemaining > 0) {
    return fail("Must place all reinforcements before continuing");
  }

  // Check if player has 5+ cards and must trade in
  const player = state.players.find((p) => p.id === playerId);
  if (player && player.cards.length >= 5) {
    return fail("Must trade in cards first (5+ cards)");
  }

  return ok();
}

export function validateSelectAttack(
  state: GameState,
  action: GameAction,
): ValidationResult {
  if (action.type !== "select_attack") return fail("Invalid action type");
  const turnCheck = checkTurn(state, action.playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "attack") {
    return fail("Can only attack during attack phase");
  }

  // Can't start a new attack while waiting for troop movement after conquest
  if (state.combatState && !state.combatState.resolved) {
    return fail("Must move troops after conquest first");
  }

  const fromTerritory = state.territories[action.from];
  if (!fromTerritory) return fail("Invalid attacking territory");
  if (fromTerritory.owner !== action.playerId) {
    return fail("You don't own the attacking territory");
  }
  if (fromTerritory.troops < 2) {
    return fail("Need at least 2 troops to attack");
  }

  const toTerritory = state.territories[action.to];
  if (!toTerritory) return fail("Invalid defending territory");
  if (toTerritory.owner === action.playerId) {
    return fail("Cannot attack your own territory");
  }

  if (!areAdjacent(action.from, action.to)) {
    return fail("Territories are not adjacent");
  }

  const maxDice = Math.min(3, fromTerritory.troops - 1);
  if (action.dice < 1 || action.dice > maxDice) {
    return fail(`Must use between 1 and ${maxDice} dice`);
  }

  return ok();
}

export function validateMoveTroopsAfterConquest(
  state: GameState,
  action: GameAction,
): ValidationResult {
  if (action.type !== "move_troops_after_conquest") return fail("Invalid action type");
  const turnCheck = checkTurn(state, action.playerId);
  if (turnCheck) return turnCheck;

  if (!state.combatState) {
    return fail("No active combat to resolve");
  }

  const attackingTerritory = state.territories[state.combatState.attackingTerritory];
  if (!attackingTerritory) return fail("Invalid attacking territory");

  // The combat state stores how many dice the attacker used — that's the minimum troops to move
  // We use the attacker dice count as minimum
  const minTroops = state.combatState.attackerDice.length;
  const maxTroops = attackingTerritory.troops - 1;

  if (action.troops < minTroops) {
    return fail(`Must move at least ${minTroops} troops`);
  }
  if (action.troops > maxTroops) {
    return fail(`Can only move up to ${maxTroops} troops`);
  }

  return ok();
}

export function validateDoneAttacking(
  state: GameState,
  playerId: string,
): ValidationResult {
  const turnCheck = checkTurn(state, playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "attack") {
    return fail("Not in attack phase");
  }

  // Can't end attack while waiting for troop movement after conquest
  if (state.combatState && !state.combatState.resolved) {
    return fail("Must move troops after conquest first");
  }

  return ok();
}

export function validateFortify(
  state: GameState,
  action: GameAction,
): ValidationResult {
  if (action.type !== "fortify") return fail("Invalid action type");
  const turnCheck = checkTurn(state, action.playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "fortify") {
    return fail("Can only fortify during fortify phase");
  }

  const fromTerritory = state.territories[action.from];
  if (!fromTerritory) return fail("Invalid source territory");
  if (fromTerritory.owner !== action.playerId) {
    return fail("You don't own the source territory");
  }

  const toTerritory = state.territories[action.to];
  if (!toTerritory) return fail("Invalid destination territory");
  if (toTerritory.owner !== action.playerId) {
    return fail("You don't own the destination territory");
  }

  if (!areConnectedThroughOwned(action.from, action.to, action.playerId, state.territories)) {
    return fail("Territories are not connected");
  }

  if (action.troops < 1) {
    return fail("Must move at least 1 troop");
  }
  if (action.troops >= fromTerritory.troops) {
    return fail("Must leave at least 1 troop behind");
  }

  return ok();
}

export function validateSkipFortify(
  state: GameState,
  playerId: string,
): ValidationResult {
  const turnCheck = checkTurn(state, playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "fortify") {
    return fail("Not in fortify phase");
  }

  return ok();
}

export function validateTradeCards(
  state: GameState,
  action: GameAction,
): ValidationResult {
  if (action.type !== "trade_cards") return fail("Invalid action type");
  const turnCheck = checkTurn(state, action.playerId);
  if (turnCheck) return turnCheck;

  if (state.currentPhase !== "reinforce") {
    return fail("Can only trade cards during reinforce phase");
  }

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return fail("Player not found");

  const indices = action.cardIndices;
  // Check indices are valid and unique
  const uniqueIndices = new Set(indices);
  if (uniqueIndices.size !== 3) return fail("Must select exactly 3 different cards");

  for (const idx of indices) {
    if (idx < 0 || idx >= player.cards.length) {
      return fail("Invalid card index");
    }
  }

  // Check if the 3 cards form a valid set
  const cards = indices.map((i) => player.cards[i]);
  if (!isValidCardSet(cards)) {
    return fail("Cards do not form a valid set");
  }

  return ok();
}

/**
 * Check if 3 cards form a valid trade-in set:
 * - 3 of the same type
 * - 1 of each type (infantry + cavalry + artillery)
 * - Any 2 + 1 wild
 */
export function isValidCardSet(
  cards: { type: string }[],
): boolean {
  if (cards.length !== 3) return false;

  const types = cards.map((c) => c.type);
  const wildCount = types.filter((t) => t === "wild").length;

  if (wildCount >= 1) {
    // Any 2 + 1 wild, or 2 wilds + 1 anything, or 3 wilds
    return true;
  }

  // No wilds: check for 3 of a kind or 1 of each
  const uniqueTypes = new Set(types);
  if (uniqueTypes.size === 1) return true; // 3 of same type
  if (uniqueTypes.size === 3) return true; // 1 of each type

  return false;
}
