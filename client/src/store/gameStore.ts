import { create } from "zustand";
import type { GameState } from "@shared/types";

function getPlayerId(): string {
  // Use sessionStorage so each tab is a separate player.
  // This allows testing with multiple tabs in the same browser.
  let id = sessionStorage.getItem("risk_player_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("risk_player_id", id);
  }
  return id;
}

interface GameStore {
  playerId: string;
  playerName: string;
  gameState: GameState | null;
  error: string | null;
  turnTimerExpiresAt: number | null;
  connected: boolean;

  setPlayerName: (name: string) => void;
  setGameState: (state: GameState) => void;
  setError: (error: string | null) => void;
  setTurnTimer: (expiresAt: number | null) => void;
  setConnected: (connected: boolean) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  playerId: getPlayerId(),
  playerName: localStorage.getItem("risk_player_name") || "",
  gameState: null,
  error: null,
  turnTimerExpiresAt: null,
  connected: false,

  setPlayerName: (name: string) => {
    localStorage.setItem("risk_player_name", name);
    set({ playerName: name });
  },

  setGameState: (state: GameState) => {
    set({ gameState: state, error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setTurnTimer: (expiresAt: number | null) => {
    set({ turnTimerExpiresAt: expiresAt });
  },

  setConnected: (connected: boolean) => {
    set({ connected });
  },

  clearGame: () => {
    set({ gameState: null, error: null, turnTimerExpiresAt: null });
  },
}));
