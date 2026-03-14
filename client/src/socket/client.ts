import { io, Socket } from "socket.io-client";
import type { GameAction, GameState } from "@shared/types";
import { useGameStore } from "../store/gameStore";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
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
  }
  return socket;
}

export function connectToGame(roomCode: string, playerId: string) {
  const s = getSocket();
  const emitJoin = () => s.emit("join_game", { roomCode, playerId });

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
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
