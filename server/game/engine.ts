import type { GameState, GameAction, TerritoryId, CombatState } from "../../shared/types";
import { validateAction } from "./validation";
import {
  startGame,
  placeInitialTroop,
  getCurrentPlayerId,
  advanceTurn,
  addLogEntry,
  drawCard,
  checkVictory,
} from "./state";
import { calculateReinforcements } from "./reinforcements";
import { resolveCombat, buildCombatState } from "./combat";
import { getTradeInArmies } from "./cards";

export interface ActionResult {
  success: boolean;
  state: GameState;
  error?: string;
  combatResult?: CombatState;
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

    case "place_troops":
      return applyPlaceTroops(state, action);

    case "done_reinforcing":
      return applyDoneReinforcing(state, action.playerId);

    case "select_attack":
      return applySelectAttack(state, action);

    case "move_troops_after_conquest":
      return applyMoveTroopsAfterConquest(state, action);

    case "done_attacking":
      return applyDoneAttacking(state, action.playerId);

    case "fortify":
      return applyFortify(state, action);

    case "skip_fortify":
      return applySkipFortify(state, action.playerId);

    case "trade_cards":
      return applyTradeCards(state, action);

    default:
      return { success: false, state, error: "Unknown action type" };
  }
}

function applyPlaceTroops(
  state: GameState,
  action: Extract<GameAction, { type: "place_troops" }>,
): ActionResult {
  const territories = { ...state.territories };

  for (const placement of action.placements) {
    territories[placement.territoryId] = {
      ...territories[placement.territoryId],
      troops: territories[placement.territoryId].troops + placement.count,
    };
  }

  const totalPlaced = action.placements.reduce((sum, p) => sum + p.count, 0);
  let newState: GameState = {
    ...state,
    territories,
    reinforcementsRemaining: state.reinforcementsRemaining - totalPlaced,
    updatedAt: new Date().toISOString(),
  };

  const player = state.players.find((p) => p.id === action.playerId)!;
  newState = addLogEntry(
    newState,
    action.playerId,
    `${player.name} placed ${totalPlaced} troops`,
  );

  return { success: true, state: newState };
}

function applyDoneReinforcing(
  state: GameState,
  playerId: string,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  let newState: GameState = {
    ...state,
    currentPhase: "attack",
    // Track whether player has conquered a territory this turn
    combatState: null,
    updatedAt: new Date().toISOString(),
  };

  newState = addLogEntry(newState, playerId, `${player.name} finished reinforcing`);

  return { success: true, state: newState };
}

function applySelectAttack(
  state: GameState,
  action: Extract<GameAction, { type: "select_attack" }>,
): ActionResult {
  const attackerDiceCount = action.dice;
  const defenderTroops = state.territories[action.to].troops;
  const defenderDiceCount = Math.min(2, defenderTroops);

  const combatResult = resolveCombat(attackerDiceCount, defenderDiceCount);
  const combat = buildCombatState(action.from, action.to, combatResult);

  const territories = { ...state.territories };
  const attacker = state.players.find((p) => p.id === action.playerId)!;
  const defenderId = territories[action.to].owner!;
  const defender = state.players.find((p) => p.id === defenderId)!;

  // Apply losses
  territories[action.from] = {
    ...territories[action.from],
    troops: territories[action.from].troops - combatResult.attackerLosses,
  };
  territories[action.to] = {
    ...territories[action.to],
    troops: territories[action.to].troops - combatResult.defenderLosses,
  };

  let newState: GameState = {
    ...state,
    territories,
    updatedAt: new Date().toISOString(),
  };

  // Check if territory was conquered
  if (territories[action.to].troops <= 0) {
    // Territory conquered — transfer ownership but don't move troops yet
    territories[action.to] = {
      owner: action.playerId,
      troops: 0, // will be set when troops are moved in
    };

    // Mark combat as needing troop movement (not fully resolved)
    const pendingCombat: CombatState = {
      ...combat,
      resolved: false, // waiting for move_troops_after_conquest
    };

    newState = {
      ...newState,
      territories,
      combatState: pendingCombat,
    };

    newState = { ...newState, conqueredThisTurn: true };

    newState = addLogEntry(
      newState,
      action.playerId,
      `${attacker.name} conquered ${action.to} from ${defender.name}`,
      { from: action.from, to: action.to },
    );

    // Check for defender elimination
    const defenderOwned = Object.values(newState.territories).filter(
      (t) => t.owner === defenderId,
    ).length;

    if (defenderOwned === 0) {
      // Eliminate defender
      const players = newState.players.map((p) => {
        if (p.id === defenderId) {
          return { ...p, eliminated: true, cards: [], cardCount: 0 };
        }
        if (p.id === action.playerId) {
          // Inherit defender's cards
          const inheritedCards = [...p.cards, ...defender.cards];
          return { ...p, cards: inheritedCards, cardCount: inheritedCards.length };
        }
        return p;
      });

      newState = {
        ...newState,
        players,
      };

      newState = addLogEntry(
        newState,
        action.playerId,
        `${defender.name} has been eliminated!`,
      );
    }
  } else {
    // Territory not conquered — combat fully resolved
    newState = {
      ...newState,
      combatState: combat, // resolved: true
    };

    newState = addLogEntry(
      newState,
      action.playerId,
      `${attacker.name} attacked ${action.to} from ${action.from}`,
      {
        attackerDice: combatResult.attackerDice,
        defenderDice: combatResult.defenderDice,
        attackerLosses: combatResult.attackerLosses,
        defenderLosses: combatResult.defenderLosses,
      },
    );
  }

  return { success: true, state: newState, combatResult: combat };
}

function applyMoveTroopsAfterConquest(
  state: GameState,
  action: Extract<GameAction, { type: "move_troops_after_conquest" }>,
): ActionResult {
  if (!state.combatState) {
    return { success: false, state, error: "No combat to resolve" };
  }

  const { attackingTerritory, defendingTerritory } = state.combatState;
  const territories = { ...state.territories };

  territories[attackingTerritory] = {
    ...territories[attackingTerritory],
    troops: territories[attackingTerritory].troops - action.troops,
  };
  territories[defendingTerritory] = {
    ...territories[defendingTerritory],
    troops: action.troops,
  };

  // Track that player conquered at least one territory this turn
  // We use a flag in combatState by marking it resolved
  let newState: GameState = {
    ...state,
    territories,
    combatState: { ...state.combatState, resolved: true },
    updatedAt: new Date().toISOString(),
  };

  // Check for victory
  const winner = checkVictory(newState);
  if (winner) {
    newState = {
      ...newState,
      status: "finished",
      winner,
    };
    const winnerPlayer = newState.players.find((p) => p.id === winner)!;
    newState = addLogEntry(newState, winner, `${winnerPlayer.name} wins the game!`);
  }

  return { success: true, state: newState };
}

function applyDoneAttacking(
  state: GameState,
  playerId: string,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;

  // Check if player conquered any territory this turn — earn a card
  // We track this by checking if combatState exists and was a conquest
  let newState: GameState = {
    ...state,
    currentPhase: "fortify",
    combatState: null,
    updatedAt: new Date().toISOString(),
  };

  // If the player conquered at least one territory during the attack phase, draw a card
  if (state.conqueredThisTurn) {
    newState = drawCard(newState, playerId);
  }

  newState = addLogEntry(newState, playerId, `${player.name} finished attacking`);

  return { success: true, state: newState };
}

function applyFortify(
  state: GameState,
  action: Extract<GameAction, { type: "fortify" }>,
): ActionResult {
  const territories = { ...state.territories };
  const player = state.players.find((p) => p.id === action.playerId)!;

  territories[action.from] = {
    ...territories[action.from],
    troops: territories[action.from].troops - action.troops,
  };
  territories[action.to] = {
    ...territories[action.to],
    troops: territories[action.to].troops + action.troops,
  };

  let newState: GameState = {
    ...state,
    territories,
    updatedAt: new Date().toISOString(),
  };

  newState = addLogEntry(
    newState,
    action.playerId,
    `${player.name} moved ${action.troops} troops from ${action.from} to ${action.to}`,
  );

  // End turn
  newState = advanceTurn(newState);

  return { success: true, state: newState };
}

function applySkipFortify(
  state: GameState,
  playerId: string,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  let newState = addLogEntry(state, playerId, `${player.name} skipped fortify`);
  newState = advanceTurn(newState);

  return { success: true, state: newState };
}

function applyTradeCards(
  state: GameState,
  action: Extract<GameAction, { type: "trade_cards" }>,
): ActionResult {
  const player = state.players.find((p) => p.id === action.playerId)!;
  const cards = action.cardIndices.map((i) => player.cards[i]);

  // Calculate armies from trade-in
  const armies = getTradeInArmies(state.tradeInCount);

  // Remove traded cards from player, add to discard
  const remainingCards = player.cards.filter((_, i) => !action.cardIndices.includes(i));
  const players = state.players.map((p) => {
    if (p.id === action.playerId) {
      return { ...p, cards: remainingCards, cardCount: remainingCards.length };
    }
    return p;
  });

  // Territory bonus: if a traded card matches a territory the player owns, +2 troops there
  // Official rules: max 2 extra armies per turn from territory bonuses
  const territories = { ...state.territories };
  let territoryBonusApplied = false;
  for (const card of cards) {
    if (
      !territoryBonusApplied &&
      card.type !== "wild" &&
      territories[card.territory]?.owner === action.playerId
    ) {
      territories[card.territory] = {
        ...territories[card.territory],
        troops: territories[card.territory].troops + 2,
      };
      territoryBonusApplied = true;
    }
  }

  let newState: GameState = {
    ...state,
    players,
    territories,
    tradeInCount: state.tradeInCount + 1,
    discardPile: [...state.discardPile, ...cards],
    reinforcementsRemaining: state.reinforcementsRemaining + armies,
    updatedAt: new Date().toISOString(),
  };

  newState = addLogEntry(
    newState,
    action.playerId,
    `${player.name} traded in cards for ${armies} armies`,
    { armies },
  );

  return { success: true, state: newState };
}
