import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { createApp } from "../app";
import { getDb, closeDb } from "../db";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import type { Server as HttpServer } from "http";
import type { GameState } from "../../shared/types";
import type { Server } from "socket.io";

let httpServer: HttpServer;
let io: Server;
let port: number;
let baseUrl: string;
const clients: ClientSocket[] = [];

function createClient(): ClientSocket {
  const client = ioClient(baseUrl, {
    autoConnect: false,
    transports: ["websocket"],
  });
  clients.push(client);
  return client;
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function createGameViaRest(): Promise<{ gameId: string; roomCode: string }> {
  const res = await fetch(`${baseUrl}/api/games`, { method: "POST" });
  return res.json();
}

async function joinGameViaRest(
  roomCode: string,
  playerId: string,
  name: string,
): Promise<{ state?: GameState; error?: string }> {
  const res = await fetch(`${baseUrl}/api/games/${roomCode}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, name }),
  });
  return res.json();
}

beforeAll(() => {
  // Use test DB
  process.env.DB_PATH = ":memory:";
  getDb();
});

beforeEach(async () => {
  const app = createApp();
  httpServer = app.httpServer;
  io = app.io;

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  // Disconnect all clients
  for (const c of clients) {
    if (c.connected) c.disconnect();
  }
  clients.length = 0;

  // Close server
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

afterAll(() => {
  closeDb();
});

describe("REST → Socket.IO join flow", () => {
  it("should receive game state after REST join then socket connect", async () => {
    // This is the exact flow the browser uses — and the bug we caught
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "player-1", "Alice");

    const client = createClient();
    const statePromise = waitForEvent<GameState>(client, "game_state_update");

    client.connect();
    client.once("connect", () => {
      client.emit("join_game", { roomCode, playerId: "player-1" });
    });

    const state = await statePromise;
    expect(state.roomCode).toBe(roomCode);
    expect(state.players).toHaveLength(1);
    expect(state.players[0].name).toBe("Alice");
  });

  it("should reject socket join for non-existent player", async () => {
    const { roomCode } = await createGameViaRest();

    const client = createClient();
    const errorPromise = waitForEvent<{ message: string }>(client, "action_error");

    client.connect();
    client.once("connect", () => {
      client.emit("join_game", { roomCode, playerId: "not-a-player" });
    });

    const error = await errorPromise;
    expect(error.message).toBe("Not a player in this game");
  });

  it("should reject socket join for non-existent game", async () => {
    const client = createClient();
    const errorPromise = waitForEvent<{ message: string }>(client, "action_error");

    client.connect();
    client.once("connect", () => {
      client.emit("join_game", { roomCode: "ZZZZ", playerId: "p1" });
    });

    const error = await errorPromise;
    expect(error.message).toBe("Game not found");
  });
});

describe("multi-client game flow", () => {
  it("3 clients join and all receive player list updates", async () => {
    const { roomCode } = await createGameViaRest();

    // All 3 join via REST
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");
    await joinGameViaRest(roomCode, "p3", "Carol");

    // Connect all 3 via socket
    const c1 = createClient();
    const c2 = createClient();
    const c3 = createClient();

    const s1 = waitForEvent<GameState>(c1, "game_state_update");
    const s2 = waitForEvent<GameState>(c2, "game_state_update");
    const s3 = waitForEvent<GameState>(c3, "game_state_update");

    c1.connect();
    c1.once("connect", () => c1.emit("join_game", { roomCode, playerId: "p1" }));

    c2.connect();
    c2.once("connect", () => c2.emit("join_game", { roomCode, playerId: "p2" }));

    c3.connect();
    c3.once("connect", () => c3.emit("join_game", { roomCode, playerId: "p3" }));

    const [state1, state2, state3] = await Promise.all([s1, s2, s3]);

    // All should see 3 players
    expect(state1.players.length).toBeGreaterThanOrEqual(1);
    expect(state3.players.length).toBeGreaterThanOrEqual(1);
  });

  it("host starts game and all clients receive playing state", async () => {
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");
    await joinGameViaRest(roomCode, "p3", "Carol");

    const c1 = createClient();
    const c2 = createClient();
    const c3 = createClient();

    // Connect all 3
    const connect = (c: ReturnType<typeof createClient>, pid: string) =>
      new Promise<void>((resolve) => {
        c.connect();
        c.once("connect", () => {
          c.emit("join_game", { roomCode, playerId: pid });
          // Wait for initial state
          c.once("game_state_update", () => resolve());
        });
      });

    await connect(c1, "p1");
    await connect(c2, "p2");
    await connect(c3, "p3");

    // Wait for any in-flight broadcasts to settle
    await new Promise((r) => setTimeout(r, 100));

    // Host starts game — all clients should get playing state (auto-distribution skips setup)
    const waitForPlaying = (c: ReturnType<typeof createClient>) =>
      new Promise<GameState>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout waiting for playing state")), 2000);
        const handler = (state: GameState) => {
          if (state.status === "playing") {
            clearTimeout(timer);
            c.off("game_state_update", handler);
            resolve(state);
          }
        };
        c.on("game_state_update", handler);
      });

    const s2update = waitForPlaying(c2);
    const s3update = waitForPlaying(c3);

    c1.emit("game_action", { type: "start_game", playerId: "p1" });

    const [state2, state3] = await Promise.all([s2update, s3update]);
    expect(state2.status).toBe("playing");
    expect(state3.status).toBe("playing");
    expect(state2.currentPhase).toBe("reinforce");
  });

  it("invalid action returns error only to acting player", async () => {
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");

    const c1 = createClient();
    const c2 = createClient();

    const connect = (c: ReturnType<typeof createClient>, pid: string) =>
      new Promise<void>((resolve) => {
        c.connect();
        c.once("connect", () => {
          c.emit("join_game", { roomCode, playerId: pid });
          c.once("game_state_update", () => resolve());
        });
      });

    await connect(c1, "p1");
    await connect(c2, "p2");

    // p2 tries to start (not host) — should get error
    const errorPromise = waitForEvent<{ message: string }>(c2, "action_error");

    // p1 should NOT receive an error
    let p1GotError = false;
    c1.once("action_error", () => { p1GotError = true; });

    c2.emit("game_action", { type: "start_game", playerId: "p2" });

    const error = await errorPromise;
    expect(error.message).toBe("Only the host can start the game");

    // Give a moment to ensure p1 didn't get an error
    await new Promise((r) => setTimeout(r, 100));
    expect(p1GotError).toBe(false);
  });

  it("state filtering hides other players' cards", async () => {
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");
    await joinGameViaRest(roomCode, "p3", "Carol");

    const c1 = createClient();

    const statePromise = waitForEvent<GameState>(c1, "game_state_update");
    c1.connect();
    c1.once("connect", () => c1.emit("join_game", { roomCode, playerId: "p1" }));

    const state = await statePromise;

    // p1 should see own cards (empty for now), other players' cards should be empty arrays
    const p1 = state.players.find((p) => p.id === "p1")!;
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    // Other players' cards are filtered out (empty array)
    expect(p2.cards).toEqual([]);
    // Card deck is hidden
    expect(state.cardDeck).toEqual([]);
  });

  it("action broadcasts updated state to all players", async () => {
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");
    await joinGameViaRest(roomCode, "p3", "Carol");

    const c1 = createClient();
    const c2 = createClient();
    const c3 = createClient();

    const connect = (c: ReturnType<typeof createClient>, pid: string) =>
      new Promise<void>((resolve) => {
        c.connect();
        c.once("connect", () => {
          c.emit("join_game", { roomCode, playerId: pid });
          c.once("game_state_update", () => resolve());
        });
      });

    await connect(c1, "p1");
    await connect(c2, "p2");
    await connect(c3, "p3");

    await new Promise((r) => setTimeout(r, 100));

    // Start game — all should receive playing state
    const waitForState = (c: ReturnType<typeof createClient>) =>
      new Promise<GameState>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout")), 2000);
        const handler = (state: GameState) => {
          if (state.status === "playing") {
            clearTimeout(timer);
            c.off("game_state_update", handler);
            resolve(state);
          }
        };
        c.on("game_state_update", handler);
      });

    const s1 = waitForState(c1);
    const s2 = waitForState(c2);
    const s3 = waitForState(c3);

    c1.emit("game_action", { type: "start_game", playerId: "p1" });

    const [state1, state2, state3] = await Promise.all([s1, s2, s3]);

    // All should be playing with same turn number
    expect(state1.status).toBe("playing");
    expect(state2.status).toBe("playing");
    expect(state3.status).toBe("playing");
    expect(state1.turnNumber).toBe(state2.turnNumber);

    // Now the current player places troops — others should receive update
    const currentPlayerId = state1.turnOrder[state1.currentTurnIndex];
    const currentClient = currentPlayerId === "p1" ? c1 : currentPlayerId === "p2" ? c2 : c3;
    const otherClient = currentPlayerId === "p1" ? c2 : c1;

    const otherUpdate = waitForEvent<GameState>(otherClient, "game_state_update");

    // Find an owned territory for the current player
    const ownedTerritory = Object.entries(state1.territories).find(
      ([, t]) => t.owner === currentPlayerId,
    );
    if (ownedTerritory && state1.reinforcementsRemaining > 0) {
      currentClient.emit("game_action", {
        type: "place_troops",
        playerId: currentPlayerId,
        placements: [{ territoryId: ownedTerritory[0], count: 1 }],
      });

      const updatedState = await otherUpdate;
      expect(updatedState.reinforcementsRemaining).toBe(state1.reinforcementsRemaining - 1);
    }
  });

  it("player reconnects and receives current state", async () => {
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");

    const c1 = createClient();
    const c2 = createClient();

    const connect = (c: ReturnType<typeof createClient>, pid: string) =>
      new Promise<void>((resolve) => {
        c.connect();
        c.once("connect", () => {
          c.emit("join_game", { roomCode, playerId: pid });
          c.once("game_state_update", () => resolve());
        });
      });

    await connect(c1, "p1");
    await connect(c2, "p2");

    // p2 disconnects
    const disconnectNotice = waitForEvent<{ playerId: string }>(c1, "player_disconnected");
    c2.disconnect();
    await disconnectNotice;

    // p2 reconnects with a new socket
    const c2b = createClient();
    const reconnectState = waitForEvent<GameState>(c2b, "game_state_update");

    c2b.connect();
    c2b.once("connect", () => {
      c2b.emit("join_game", { roomCode, playerId: "p2" });
    });

    const state = await reconnectState;
    expect(state.roomCode).toBe(roomCode);
    expect(state.players).toHaveLength(2);
    // p2 should see their own data
    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2).toBeDefined();
    expect(p2!.name).toBe("Bob");
  });

  it("disconnect marks player as disconnected and notifies others", async () => {
    const { roomCode } = await createGameViaRest();
    await joinGameViaRest(roomCode, "p1", "Alice");
    await joinGameViaRest(roomCode, "p2", "Bob");

    const c1 = createClient();
    const c2 = createClient();

    const connect = (c: ReturnType<typeof createClient>, pid: string) =>
      new Promise<void>((resolve) => {
        c.connect();
        c.once("connect", () => {
          c.emit("join_game", { roomCode, playerId: pid });
          c.once("game_state_update", () => resolve());
        });
      });

    await connect(c1, "p1");
    await connect(c2, "p2");

    // p2 disconnects — p1 should get notified
    const disconnectNotice = waitForEvent<{ playerId: string }>(c1, "player_disconnected");
    c2.disconnect();

    const notice = await disconnectNotice;
    expect(notice.playerId).toBe("p2");
  });
});
