import type { Server, Socket } from "socket.io";
import type { GameAction, GameState } from "../../shared/types";
import { applyAction } from "../game/engine";
import { filterStateForPlayer, getCurrentPlayerId } from "../game/state";
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

// Per-game action locks to prevent concurrent state mutations
const actionLocks = new Map<string, boolean>();

// Turn timers per game
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTurnTimer(roomCode: string) {
  const existing = turnTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    turnTimers.delete(roomCode);
  }
}

function startTurnTimer(io: Server, roomCode: string) {
  clearTurnTimer(roomCode);
  const state = gameCache.get(roomCode);
  if (!state || state.status !== "playing" || !state.settings.turnTimerSeconds) return;

  const timerMs = state.settings.turnTimerSeconds * 1000;
  const turnNumberAtStart = state.turnNumber;
  const phaseAtStart = state.currentPhase;

  const timer = setTimeout(() => {
    turnTimers.delete(roomCode);
    const currentState = gameCache.get(roomCode);
    if (!currentState || currentState.status !== "playing") return;
    // Only auto-advance if we're still on the same turn and phase
    if (currentState.turnNumber !== turnNumberAtStart || currentState.currentPhase !== phaseAtStart) return;

    const playerId = getCurrentPlayerId(currentState);

    // Auto-advance based on phase
    let action: GameAction;
    if (currentState.currentPhase === "reinforce") {
      // If reinforcements remain, place them randomly then advance
      if (currentState.reinforcementsRemaining > 0) {
        const ownedTerritory = Object.entries(currentState.territories)
          .find(([, t]) => t.owner === playerId);
        if (ownedTerritory) {
          const placeResult = applyAction(currentState, {
            type: "place_troops",
            playerId,
            placements: [{ territoryId: ownedTerritory[0] as any, count: currentState.reinforcementsRemaining }],
          });
          if (placeResult.success) {
            gameCache.set(roomCode, placeResult.state);
            saveGame(placeResult.state);
          }
        }
      }
      action = { type: "done_reinforcing", playerId };
    } else if (currentState.currentPhase === "attack") {
      // Check for pending conquest troop movement
      if (currentState.combatState && !currentState.combatState.resolved) {
        const minTroops = currentState.combatState.attackerDice.length;
        const moveResult = applyAction(currentState, {
          type: "move_troops_after_conquest",
          playerId,
          troops: minTroops,
        });
        if (moveResult.success) {
          gameCache.set(roomCode, moveResult.state);
          saveGame(moveResult.state);
        }
      }
      action = { type: "done_attacking", playerId };
    } else {
      action = { type: "skip_fortify", playerId };
    }

    const freshState = gameCache.get(roomCode);
    if (!freshState) return;
    const result = applyAction(freshState, action);
    if (result.success) {
      gameCache.set(roomCode, result.state);
      saveGame(result.state);
      broadcastState(io, roomCode);
      // Start timer for next turn/phase
      startTurnTimer(io, roomCode);
    }
  }, timerMs);

  turnTimers.set(roomCode, timer);

  // Broadcast timer start to clients
  io.to(roomCode).emit("turn_timer", {
    expiresAt: Date.now() + timerMs,
    durationMs: timerMs,
  });
}

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

      // Serialize actions per game to prevent race conditions
      if (actionLocks.get(meta.roomCode)) {
        socket.emit("action_error", { message: "Action in progress, try again" });
        return;
      }
      actionLocks.set(meta.roomCode, true);

      try {
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

        // If combat occurred, broadcast the result for animations
        if (result.combatResult) {
          io.to(meta.roomCode).emit("combat_result", result.combatResult);
        }

        // Broadcast new state to all players
        broadcastState(io, meta.roomCode);

        // Restart turn timer on phase/turn changes
        if (result.state.status === "playing" && result.state.settings.turnTimerSeconds) {
          startTurnTimer(io, meta.roomCode);
        }
        // Clear timer if game ended
        if (result.state.status === "finished") {
          clearTurnTimer(meta.roomCode);
        }
      } finally {
        actionLocks.delete(meta.roomCode);
      }
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
