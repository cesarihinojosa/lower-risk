import { Router } from "express";
import type { GameState } from "../../shared/types";
import { createGame, addPlayer, filterStateForPlayer } from "../game/state";
import { validateJoin } from "../game/validation";
import { saveGame, loadGameByRoomCode } from "../db";

const router = Router();

// POST /api/games — Create a new game
router.post("/", (_req, res) => {
  const state = createGame();
  saveGame(state);
  res.json({ gameId: state.id, roomCode: state.roomCode });
});

// GET /api/games/:roomCode — Get game state (filtered)
router.get("/:roomCode", (req, res) => {
  const state = loadGameByRoomCode(req.params.roomCode.toUpperCase());
  if (!state) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  const playerId = (req.query.playerId as string) || "";
  res.json(filterStateForPlayer(state, playerId));
});

// POST /api/games/:roomCode/join — Join a game
router.post("/:roomCode/join", (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase();
  const state = loadGameByRoomCode(roomCode);
  if (!state) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const { playerId, name } = req.body as { playerId: string; name: string };
  if (!playerId || !name) {
    res.status(400).json({ error: "playerId and name are required" });
    return;
  }

  // Allow rejoining if player is already in the game
  const existingPlayer = state.players.find((p) => p.id === playerId);
  if (existingPlayer) {
    res.json({ state: filterStateForPlayer(state, playerId) });
    return;
  }

  const validation = validateJoin(state, playerId, name);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const newState = addPlayer(state, playerId, name.trim());
  saveGame(newState);
  res.json({ state: filterStateForPlayer(newState, playerId) });
});

export default router;
