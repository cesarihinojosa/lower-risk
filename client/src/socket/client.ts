import { io, Socket } from "socket.io-client";
import type { GameAction, GameState } from "@shared/types";
import { useGameStore } from "../store/gameStore";

let socket: Socket | null = null;
let currentRoomCode: string | null = null;
let currentPlayerId: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("game_state_update", (state: GameState) => {
      useGameStore.getState().setGameState(state);
    });

    socket.on("action_error", ({ message }: { message: string }) => {
      useGameStore.getState().setError(message);
    });

    socket.on("player_connected", ({ playerId }: { playerId: string }) => {
      console.log("Player connected:", playerId);
    });

    socket.on("player_disconnected", ({ playerId }: { playerId: string }) => {
      console.log("Player disconnected:", playerId);
    });

    socket.on("turn_timer", ({ expiresAt }: { expiresAt: number }) => {
      useGameStore.getState().setTurnTimer(expiresAt);
    });

    // Auto-rejoin game room on reconnect
    socket.on("connect", () => {
      useGameStore.getState().setConnected(true);
      if (currentRoomCode && currentPlayerId) {
        socket!.emit("join_game", {
          roomCode: currentRoomCode,
          playerId: currentPlayerId,
        });
      }
    });

    socket.on("disconnect", (reason: string) => {
      useGameStore.getState().setConnected(false);
      console.log("Disconnected:", reason);
      if (reason === "io server disconnect") {
        // Server kicked us — reconnect manually
        socket?.connect();
      }
      // Otherwise socket.io will auto-reconnect
    });
  }
  return socket;
}

export function connectToGame(roomCode: string, playerId: string) {
  currentRoomCode = roomCode;
  currentPlayerId = playerId;

  const s = getSocket();
  const emitJoin = () =>
    s.emit("join_game", { roomCode, playerId });

  if (s.connected) {
    emitJoin();
  } else {
    s.once("connect", emitJoin);
    s.connect();
  }
}

export function sendAction(action: GameAction) {
  const s = getSocket();
  s.emit("game_action", action);
}

export function disconnectSocket() {
  currentRoomCode = null;
  currentPlayerId = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
