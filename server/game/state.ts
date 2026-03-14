import type {
  GameState,
  GameSettings,
  Player,
  PlayerColor,
  TerritoryId,
  TerritoryState,
  Card,
  GameLogEntry,
} from "../../shared/types";
import { TERRITORIES, getAllTerritoryIds } from "./territories";
import { shuffle, getRng } from "./rng";
import { calculateReinforcements } from "./reinforcements";

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
    reinforcementsRemaining: 0,
    conqueredThisTurn: false,
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
  const rng = getRng();

  const territories = { ...state.territories };

  if (state.settings.autoAssignTerritories) {
    // Auto-assign territories evenly
    const shuffledTerritories = shuffle(getAllTerritoryIds());
    for (let i = 0; i < shuffledTerritories.length; i++) {
      const ownerId = turnOrder[i % playerCount];
      territories[shuffledTerritories[i]] = { owner: ownerId, troops: 1 };
    }

    // Auto-distribute remaining troops randomly across owned territories
    const totalPerPlayer = getStartingTroopsPerPlayer(playerCount);
    const territoriesPerPlayer = Math.floor(42 / playerCount);
    const remainingPerPlayer = totalPerPlayer - territoriesPerPlayer;

    for (const playerId of playerIds) {
      const ownedIds = Object.entries(territories)
        .filter(([, t]) => t.owner === playerId)
        .map(([id]) => id as TerritoryId);

      for (let i = 0; i < remainingPerPlayer; i++) {
        // Pick a random owned territory to reinforce
        const idx = Math.floor(rng() * ownedIds.length);
        const tid = ownedIds[idx];
        territories[tid] = {
          ...territories[tid],
          troops: territories[tid].troops + 1,
        };
      }
    }
  }

  // Skip setup phase entirely — go straight to playing
  const firstPlayerId = turnOrder[0];
  const newState: GameState = {
    ...state,
    status: "playing",
    territories,
    turnOrder,
    currentTurnIndex: 0,
    currentPhase: "reinforce",
    turnNumber: 1,
    cardDeck: buildCardDeck(),
    discardPile: [],
    conqueredThisTurn: false,
    reinforcementsRemaining: 0,
    updatedAt: new Date().toISOString(),
  };
  newState.reinforcementsRemaining = calculateReinforcements(newState, firstPlayerId);

  return newState;
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
    const firstPlayerId = updatedState.turnOrder[0];
    const playingState: GameState = {
      ...updatedState,
      status: "playing",
      currentTurnIndex: 0,
      currentPhase: "reinforce",
      turnNumber: 1,
      conqueredThisTurn: false,
      reinforcementsRemaining: 0,
    };
    playingState.reinforcementsRemaining = calculateReinforcements(playingState, firstPlayerId);
    return playingState;
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

/**
 * Get the current player's ID (whose turn it is).
 */
export function getCurrentPlayerId(state: GameState): string {
  return state.turnOrder[state.currentTurnIndex];
}

/**
 * Advance to the next non-eliminated player's turn.
 * Transitions to reinforce phase and increments turn number.
 */
export function advanceTurn(state: GameState): GameState {
  let nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;

  // Skip eliminated players
  let attempts = 0;
  while (attempts < state.turnOrder.length) {
    const nextPlayerId = state.turnOrder[nextIndex];
    const player = state.players.find((p) => p.id === nextPlayerId);
    if (player && !player.eliminated) break;
    nextIndex = (nextIndex + 1) % state.turnOrder.length;
    attempts++;
  }

  const nextPlayerId = state.turnOrder[nextIndex];
  const nextState: GameState = {
    ...state,
    currentTurnIndex: nextIndex,
    currentPhase: "reinforce",
    turnNumber: state.turnNumber + 1,
    combatState: null,
    conqueredThisTurn: false,
    updatedAt: new Date().toISOString(),
    reinforcementsRemaining: 0, // will be set below
  };
  nextState.reinforcementsRemaining = calculateReinforcements(nextState, nextPlayerId);

  return nextState;
}

/**
 * Add a log entry to the game state.
 * Keeps only the last 100 entries.
 */
export function addLogEntry(
  state: GameState,
  playerId: string,
  action: string,
  data?: Record<string, unknown>,
): GameState {
  const entry: GameLogEntry = {
    timestamp: new Date().toISOString(),
    playerId,
    action,
    data,
  };
  const log = [...state.log, entry].slice(-100);
  return { ...state, log };
}

/**
 * Draw a card from the deck for a player.
 * If deck is empty, reshuffles discard pile into deck.
 */
export function drawCard(state: GameState, playerId: string): GameState {
  let deck = [...state.cardDeck];
  let discard = [...state.discardPile];

  if (deck.length === 0) {
    deck = shuffle(discard);
    discard = [];
  }

  if (deck.length === 0) return state; // no cards at all

  const card = deck.shift()!;
  const players = state.players.map((p) => {
    if (p.id === playerId) {
      const newCards = [...p.cards, card];
      return { ...p, cards: newCards, cardCount: newCards.length };
    }
    return p;
  });

  return {
    ...state,
    players,
    cardDeck: deck,
    discardPile: discard,
  };
}

/**
 * Check if a player has won (owns all 42 territories).
 */
export function checkVictory(state: GameState): string | null {
  for (const player of state.players) {
    if (player.eliminated) continue;
    const ownedCount = Object.values(state.territories).filter(
      (t) => t.owner === player.id,
    ).length;
    if (ownedCount === 42) return player.id;
  }
  return null;
}

/**
 * Count how many non-eliminated players remain.
 */
export function getActivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.eliminated);
}
