import type { GameState, GameAction, TerritoryId } from "../../shared/types";
import { getHostId, getSetupTroopsRemaining } from "./state";

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

// ===== Playing Phase Validators (stubs for later phases) =====

function validatePlaceTroops(
  state: GameState,
  _action: GameAction,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateDoneReinforcing(
  state: GameState,
  _playerId: string,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateSelectAttack(
  state: GameState,
  _action: GameAction,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateMoveTroopsAfterConquest(
  state: GameState,
  _action: GameAction,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateDoneAttacking(
  state: GameState,
  _playerId: string,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateFortify(
  state: GameState,
  _action: GameAction,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateSkipFortify(
  state: GameState,
  _playerId: string,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}

function validateTradeCards(
  state: GameState,
  _action: GameAction,
): ValidationResult {
  if (state.status !== "playing") return fail("Game is not in playing phase");
  return fail("Not implemented yet");
}
