import Database from "better-sqlite3";
import type { GameState } from "../shared/types";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "risk.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        room_code TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'lobby',
        state JSON NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_room_code ON games(room_code);
      CREATE INDEX IF NOT EXISTS idx_status ON games(status);
    `);
  }
  return db;
}

export function saveGame(state: GameState): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO games (id, room_code, status, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      state = excluded.state,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    state.id,
    state.roomCode,
    state.status,
    JSON.stringify(state),
    state.createdAt,
    state.updatedAt,
  );
}

export function loadGameByRoomCode(roomCode: string): GameState | null {
  const db = getDb();
  const row = db
    .prepare("SELECT state FROM games WHERE room_code = ?")
    .get(roomCode) as { state: string } | undefined;
  return row ? JSON.parse(row.state) : null;
}

export function loadGameById(id: string): GameState | null {
  const db = getDb();
  const row = db
    .prepare("SELECT state FROM games WHERE id = ?")
    .get(id) as { state: string } | undefined;
  return row ? JSON.parse(row.state) : null;
}

export function loadAllActiveGames(): GameState[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT state FROM games WHERE status IN ('lobby', 'setup', 'playing')")
    .all() as { state: string }[];
  return rows.map((r) => JSON.parse(r.state));
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
