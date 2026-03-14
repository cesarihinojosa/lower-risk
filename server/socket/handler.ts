import type { Server, Socket } from "socket.io";
import type { GameAction, GameState } from "../../shared/types";
import { applyAction } from "../game/engine";
import { filterStateForPlayer } from "../game/state";
import { saveGame, loadGameByRoomCode } from "../db";

// In-memory game state cache for active games (room code → state)
// Authoritative state lives in SQLite; this is a hot cache for performance.
const gameCache = new Map<string, GameState>();

// Track which socket belongs to which player/game
interface SocketMeta {
  playerId: string;
  roomCode: string;
}
const socketMeta = new Map<string, SocketMeta>();

export function getGameState(roomCode: string): GameState | undefined {
  let state: GameState | undefined = gameCache.get(roomCode);
  if (!state) {
    const loaded = loadGameByRoomCode(roomCode);
    if (loaded) {
      state = loaded;
      gameCache.set(roomCode, loaded);
    }
  }
  return state;
}

function broadcastState(io: Server, roomCode: string) {
  const state = gameCache.get(roomCode);
  if (!state) return;

  const room = io.sockets.adapter.rooms.get(roomCode);
  if (!room) return;

  for (const socketId of room) {
    const meta = socketMeta.get(socketId);
    if (meta) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("game_state_update", filterStateForPlayer(state, meta.playerId));
      }
    }
  }
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("join_game", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      const code = roomCode.toUpperCase();
      // Always read fresh from DB on join — the REST route may have added the player
      gameCache.delete(code);
      const state = getGameState(code);
      if (!state) {
        socket.emit("action_error", { message: "Game not found" });
        return;
      }

      const player = state.players.find((p: any) => p.id === playerId);
      if (!player) {
        socket.emit("action_error", { message: "Not a player in this game" });
        return;
      }

      // Track socket and join room
      socketMeta.set(socket.id, { playerId, roomCode: code });
      socket.join(code);

      // Mark player as connected
      player.connected = true;
      gameCache.set(code, state);
      saveGame(state);

      // Send current state to the joining player
      socket.emit("game_state_update", filterStateForPlayer(state, playerId));

      // Notify others
      socket.to(code).emit("player_connected", { playerId });
      broadcastState(io, code);
    });

    socket.on("game_action", (action: GameAction) => {
      const meta = socketMeta.get(socket.id);
      if (!meta) {
        socket.emit("action_error", { message: "Not connected to a game" });
        return;
      }

      const state = getGameState(meta.roomCode);
      if (!state) {
        socket.emit("action_error", { message: "Game not found" });
        return;
      }

      const result = applyAction(state, action);
      if (!result.success) {
        socket.emit("action_error", { message: result.error });
        return;
      }

      // Update cache and persist
      gameCache.set(meta.roomCode, result.state);
      saveGame(result.state);

      // Broadcast new state to all players
      broadcastState(io, meta.roomCode);
    });

    socket.on("disconnect", () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
        const state = gameCache.get(meta.roomCode);
        if (state) {
          const player = state.players.find((p: any) => p.id === meta.playerId);
          if (player) {
            player.connected = false;
            gameCache.set(meta.roomCode, state);
            saveGame(state);
          }
          socket.to(meta.roomCode).emit("player_disconnected", { playerId: meta.playerId });
          broadcastState(io, meta.roomCode);
        }
        socketMeta.delete(socket.id);
      }
    });
  });
}

export function invalidateCache(roomCode: string) {
  gameCache.delete(roomCode);
}
