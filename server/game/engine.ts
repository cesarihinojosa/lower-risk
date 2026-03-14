import type { GameState, GameAction } from "../../shared/types";
import { validateAction } from "./validation";
import { startGame, placeInitialTroop } from "./state";

export interface ActionResult {
  success: boolean;
  state: GameState;
  error?: string;
}

export function applyAction(
  state: GameState,
  action: GameAction,
): ActionResult {
  const validation = validateAction(state, action);
  if (!validation.valid) {
    return { success: false, state, error: validation.error };
  }

  switch (action.type) {
    case "start_game":
      return { success: true, state: startGame(state) };

    case "update_settings":
      return {
        success: true,
        state: {
          ...state,
          settings: { ...state.settings, ...action.settings },
          updatedAt: new Date().toISOString(),
        },
      };

    case "place_initial_troop":
      return {
        success: true,
        state: placeInitialTroop(state, action.playerId, action.territoryId),
      };

    default:
      return { success: false, state, error: "Action not implemented yet" };
  }
}
