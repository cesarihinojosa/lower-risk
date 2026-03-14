import type {
  GameState,
  GameSettings,
  Player,
  PlayerColor,
  TerritoryId,
  TerritoryState,
  Card,
} from "../../shared/types";
import { TERRITORIES, getAllTerritoryIds } from "./territories";
import { shuffle } from "./rng";

const AVAILABLE_COLORS: PlayerColor[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
];

// Total starting troops per player count (spec section 5.2)
export const STARTING_TROOPS: Record<number, number> = {
  3: 35,
  4: 30,
  5: 25,
  6: 20,
};

function generateId(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function createGame(settingsOverrides?: Partial<GameSettings>): GameState {
  const now = new Date().toISOString();
  const territories: Record<string, TerritoryState> = {};
  for (const id of getAllTerritoryIds()) {
    territories[id] = { owner: null, troops: 0 };
  }

  return {
    id: generateId(8),
    roomCode: generateRoomCode(),
    status: "lobby",
    createdAt: now,
    updatedAt: now,
    settings: {
      maxPlayers: 6,
      autoAssignTerritories: true,
      capitalMode: false,
      turnTimerSeconds: null,
      ...settingsOverrides,
    },
    players: [],
    territories: territories as Record<TerritoryId, TerritoryState>,
    turnOrder: [],
    currentTurnIndex: 0,
    currentPhase: "reinforce",
    turnNumber: 0,
    cardDeck: [],
    discardPile: [],
    tradeInCount: 0,
    combatState: null,
    log: [],
    winner: null,
  };
}

export function addPlayer(
  state: GameState,
  playerId: string,
  name: string,
): GameState {
  const usedColors = new Set(state.players.map((p) => p.color));
  const color = AVAILABLE_COLORS.find((c) => !usedColors.has(c));
  if (!color) throw new Error("No colors available");

  const player: Player = {
    id: playerId,
    name,
    color,
    connected: true,
    eliminated: false,
    cardCount: 0,
    cards: [],
  };

  return {
    ...state,
    players: [...state.players, player],
    updatedAt: new Date().toISOString(),
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.filter((p) => p.id !== playerId),
    updatedAt: new Date().toISOString(),
  };
}

export function getHostId(state: GameState): string | null {
  return state.players.length > 0 ? state.players[0].id : null;
}

export function getStartingTroopsPerPlayer(playerCount: number): number {
  return STARTING_TROOPS[playerCount] ?? 20;
}

export function getSetupTroopsRemaining(
  state: GameState,
  playerId: string,
): number {
  const playerCount = state.players.length;
  const total = getStartingTroopsPerPlayer(playerCount);
  const placed = Object.values(state.territories)
    .filter((t) => t.owner === playerId)
    .reduce((sum, t) => sum + t.troops, 0);
  return total - placed;
}

export function isSetupComplete(state: GameState): boolean {
  return state.players.every(
    (p) => getSetupTroopsRemaining(state, p.id) === 0,
  );
}

export function buildCardDeck(): Card[] {
  const types: Array<"infantry" | "cavalry" | "artillery"> = [
    "infantry",
    "cavalry",
    "artillery",
  ];
  const cards: Card[] = [];

  const allIds = getAllTerritoryIds();
  for (let i = 0; i < allIds.length; i++) {
    cards.push({
      territory: allIds[i],
      type: types[i % 3],
    });
  }

  // 2 wild cards
  cards.push({ territory: "alaska", type: "wild" });
  cards.push({ territory: "alaska", type: "wild" });

  return shuffle(cards);
}

export function startGame(state: GameState): GameState {
  const playerCount = state.players.length;
  const playerIds = state.players.map((p) => p.id);
  const turnOrder = shuffle([...playerIds]);

  const territories = { ...state.territories };

  if (state.settings.autoAssignTerritories) {
    const shuffledTerritories = shuffle(getAllTerritoryIds());
    for (let i = 0; i < shuffledTerritories.length; i++) {
      const ownerId = turnOrder[i % playerCount];
      territories[shuffledTerritories[i]] = { owner: ownerId, troops: 1 };
    }
  }

  return {
    ...state,
    status: "setup",
    territories,
    turnOrder,
    currentTurnIndex: 0,
    currentPhase: "reinforce",
    turnNumber: 0,
    cardDeck: buildCardDeck(),
    discardPile: [],
    updatedAt: new Date().toISOString(),
  };
}

export function placeInitialTroop(
  state: GameState,
  playerId: string,
  territoryId: TerritoryId,
): GameState {
  const territories = { ...state.territories };
  territories[territoryId] = {
    ...territories[territoryId],
    troops: territories[territoryId].troops + 1,
  };

  // Advance to next player who still has troops to place
  let nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  const updatedState: GameState = {
    ...state,
    territories,
    currentTurnIndex: nextIndex,
    updatedAt: new Date().toISOString(),
  };

  // Check if setup is complete after this placement
  if (isSetupComplete(updatedState)) {
    return {
      ...updatedState,
      status: "playing",
      currentTurnIndex: 0,
      currentPhase: "reinforce",
      turnNumber: 1,
    };
  }

  // Skip players who have no troops remaining
  let attempts = 0;
  while (
    getSetupTroopsRemaining(updatedState, updatedState.turnOrder[nextIndex]) <=
      0 &&
    attempts < state.turnOrder.length
  ) {
    nextIndex = (nextIndex + 1) % state.turnOrder.length;
    attempts++;
  }
  updatedState.currentTurnIndex = nextIndex;

  return updatedState;
}

export function filterStateForPlayer(
  state: GameState,
  playerId: string,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      cards: p.id === playerId ? p.cards : [],
      cardCount: p.cards.length,
    })),
    cardDeck: [],
  };
}
