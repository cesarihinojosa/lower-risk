// ===== Game State =====

export interface GameState {
  id: string;
  roomCode: string;
  status: "lobby" | "setup" | "playing" | "finished";
  createdAt: string;
  updatedAt: string;

  settings: GameSettings;
  players: Player[];
  territories: Record<TerritoryId, TerritoryState>;
  turnOrder: string[];
  currentTurnIndex: number;
  currentPhase: TurnPhase;
  turnNumber: number;

  cardDeck: Card[];
  discardPile: Card[];
  tradeInCount: number;

  combatState: CombatState | null;
  log: GameLogEntry[];
  winner: string | null;
}

export interface GameSettings {
  maxPlayers: number;
  autoAssignTerritories: boolean;
  capitalMode: boolean;
  turnTimerSeconds: number | null;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;
  eliminated: boolean;
  cardCount: number;
  cards: Card[];
}

export type PlayerColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "orange";

export interface TerritoryState {
  owner: string | null;
  troops: number;
}

export type TurnPhase = "reinforce" | "attack" | "fortify" | "end";

export interface CombatState {
  attackingTerritory: TerritoryId;
  defendingTerritory: TerritoryId;
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  resolved: boolean;
}

export interface Card {
  territory: TerritoryId;
  type: "infantry" | "cavalry" | "artillery" | "wild";
}

export interface GameLogEntry {
  timestamp: string;
  playerId: string;
  action: string;
  data?: Record<string, unknown>;
}

// ===== Territory Definitions =====

export type TerritoryId =
  // North America
  | "alaska"
  | "northwest_territory"
  | "greenland"
  | "alberta"
  | "ontario"
  | "quebec"
  | "western_us"
  | "eastern_us"
  | "central_america"
  // South America
  | "venezuela"
  | "peru"
  | "brazil"
  | "argentina"
  // Europe
  | "iceland"
  | "scandinavia"
  | "great_britain"
  | "northern_europe"
  | "western_europe"
  | "southern_europe"
  | "ukraine"
  // Africa
  | "north_africa"
  | "egypt"
  | "east_africa"
  | "congo"
  | "south_africa"
  | "madagascar"
  // Asia
  | "ural"
  | "siberia"
  | "yakutsk"
  | "kamchatka"
  | "irkutsk"
  | "mongolia"
  | "japan"
  | "afghanistan"
  | "china"
  | "middle_east"
  | "india"
  | "siam"
  // Australia
  | "indonesia"
  | "new_guinea"
  | "western_australia"
  | "eastern_australia";

export type ContinentId =
  | "north_america"
  | "south_america"
  | "europe"
  | "africa"
  | "asia"
  | "australia";

export interface TerritoryDef {
  id: TerritoryId;
  name: string;
  continent: ContinentId;
  adjacentTo: TerritoryId[];
  svgPathId: string;
}

// ===== Actions (Client → Server) =====

export type GameAction =
  | { type: "start_game"; playerId: string }
  | { type: "update_settings"; playerId: string; settings: Partial<GameSettings> }
  | { type: "place_initial_troop"; playerId: string; territoryId: TerritoryId }
  | { type: "trade_cards"; playerId: string; cardIndices: [number, number, number] }
  | {
      type: "place_troops";
      playerId: string;
      placements: { territoryId: TerritoryId; count: number }[];
    }
  | { type: "done_reinforcing"; playerId: string }
  | {
      type: "select_attack";
      playerId: string;
      from: TerritoryId;
      to: TerritoryId;
      dice: number;
    }
  | { type: "move_troops_after_conquest"; playerId: string; troops: number }
  | { type: "done_attacking"; playerId: string }
  | {
      type: "fortify";
      playerId: string;
      from: TerritoryId;
      to: TerritoryId;
      troops: number;
    }
  | { type: "skip_fortify"; playerId: string };

// ===== Server → Client Events =====

export interface GameStateUpdate {
  event: "game_state_update";
  state: GameState;
}

export interface CombatResultEvent {
  event: "combat_result";
  result: CombatState;
}

export interface PlayerConnectedEvent {
  event: "player_connected";
  playerId: string;
}

export interface PlayerDisconnectedEvent {
  event: "player_disconnected";
  playerId: string;
}

export interface ActionErrorEvent {
  event: "action_error";
  message: string;
}
