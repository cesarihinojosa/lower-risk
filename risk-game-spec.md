# RISK: Friends-Only Web Game — Technical Specification

## 1. Project Overview

A web-based implementation of the classic RISK board game designed for private games between 3–6 friends. No matchmaking, no public lobbies — just shareable room codes. The game supports real-time play with persistent state so games can be paused and resumed across sessions.

### Core Principles
- **Server is the authority**: All game logic (combat, reinforcement counts, territory validation) runs server-side. The client is a rendering layer that sends action requests.
- **Test-driven game logic**: Every game engine function must have comprehensive tests before it is considered done. Tests are not a follow-up task — they are written alongside or before the implementation. No phase is complete until its tests pass.
- **Simple infrastructure**: This is a small-scale app (1–10 concurrent games). Don't over-engineer.
- **Fun first**: Prioritize dice roll animations, clear map feedback, and smooth turn flow over edge-case perfection.

---

## 2. Tech Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **State management**: Zustand (lightweight, good for game state syncing)
- **Map rendering**: Inline SVG with React components per territory
- **Styling**: Tailwind CSS
- **Real-time**: Socket.IO client
- **Animations**: Framer Motion (dice rolls, troop placement, combat results)
- **Build tool**: Vite

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Real-time**: Socket.IO server
- **Database**: SQLite via better-sqlite3 (single file, zero config, plenty for this scale)
- **Validation**: Zod for action/message validation

### Testing
- **Test runner**: Vitest (shared config for client and server, native TypeScript, fast)
- **Socket testing**: socket.io-client (simulate multiple players in integration tests)
- **Coverage**: Vitest built-in coverage via v8
- **Seeded RNG**: All randomness (dice rolls, card shuffles, territory assignment) must go through a seedable wrapper so tests are deterministic

### Deployment
- Single server (VPS like Railway, Render, or a $5 DigitalOcean droplet)
- SQLite file persists on disk
- No containerization needed initially

---

## 3. Data Models

### 3.1 Game State (stored as JSON in SQLite)

```typescript
interface GameState {
  id: string;                    // 8-char alphanumeric game ID
  roomCode: string;              // 4-char uppercase join code (e.g., "XKRM")
  status: "lobby" | "setup" | "playing" | "finished";
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp

  settings: GameSettings;
  players: Player[];
  territories: Record<TerritoryId, TerritoryState>;
  turnOrder: string[];           // player IDs in turn order
  currentTurnIndex: number;
  currentPhase: TurnPhase;
  turnNumber: number;

  cardDeck: Card[];              // remaining cards in deck
  discardPile: Card[];
  tradeInCount: number;          // how many times cards have been traded (for escalating armies)

  combatState: CombatState | null;  // non-null only during active combat
  log: GameLogEntry[];              // last 100 actions for activity feed
  winner: string | null;            // player ID of winner
}

interface GameSettings {
  maxPlayers: number;            // 3–6, default 6
  autoAssignTerritories: boolean; // true = random, false = draft pick
  capitalMode: boolean;          // optional variant: each player has a capital
  turnTimerSeconds: number | null; // null = no timer, or e.g. 300 for 5 min turns
}

interface Player {
  id: string;                    // UUID
  name: string;                  // display name, chosen on join
  color: PlayerColor;
  connected: boolean;            // WebSocket connection status
  eliminated: boolean;
  cardCount: number;             // visible to all (exact cards are private)
  cards: Card[];                 // only sent to the owning player
}

type PlayerColor = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

interface TerritoryState {
  owner: string | null;          // player ID
  troops: number;
}

type TurnPhase =
  | "reinforce"       // place new troops
  | "attack"          // optional combat phase
  | "fortify"         // move troops between connected owned territories
  | "end";            // cleanup before next player

interface CombatState {
  attackingTerritory: TerritoryId;
  defendingTerritory: TerritoryId;
  attackerDice: number[];        // values rolled
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  resolved: boolean;
}

interface Card {
  territory: TerritoryId;
  type: "infantry" | "cavalry" | "artillery" | "wild";
}

interface GameLogEntry {
  timestamp: string;
  playerId: string;
  action: string;                // human-readable: "Alice attacked Alaska from Kamchatka"
  data?: Record<string, any>;    // structured data for replay/undo
}
```

### 3.2 SQLite Schema

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  state JSON NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_room_code ON games(room_code);
CREATE INDEX idx_status ON games(status);
```

One row per game. The entire `GameState` object is serialized into the `state` JSON column. This is simple, atomic, and fast enough for this use case.

---

## 4. Territory Map Data

### 4.1 Territory Definitions

Define all 42 RISK territories with their continent, display name, and adjacency list. This is a static data file.

```typescript
// territories.ts

interface TerritoryDef {
  id: TerritoryId;
  name: string;
  continent: ContinentId;
  adjacentTo: TerritoryId[];
  // SVG path data or reference to path element for rendering
  svgPathId: string;
}

type ContinentId =
  | "north_america"   // 9 territories, bonus: 5
  | "south_america"   // 4 territories, bonus: 2
  | "europe"          // 7 territories, bonus: 5
  | "africa"          // 6 territories, bonus: 3
  | "asia"            // 12 territories, bonus: 7
  | "australia";      // 4 territories, bonus: 2

const CONTINENT_BONUSES: Record<ContinentId, number> = {
  north_america: 5,
  south_america: 2,
  europe: 5,
  africa: 3,
  asia: 7,
  australia: 2,
};

// Full territory list (all 42):
// North America: alaska, northwest_territory, greenland, alberta, ontario, quebec, western_us, eastern_us, central_america
// South America: venezuela, peru, brazil, argentina
// Europe: iceland, scandinavia, great_britain, northern_europe, western_europe, southern_europe, ukraine
// Africa: north_africa, egypt, east_africa, congo, south_africa, madagascar
// Asia: ural, siberia, yakutsk, kamchatka, irkutsk, mongolia, japan, afghanistan, china, middle_east, india, siam
// Australia: indonesia, new_guinea, western_australia, eastern_australia

// Each territory needs its full adjacency list. Example:
const TERRITORIES: TerritoryDef[] = [
  {
    id: "alaska",
    name: "Alaska",
    continent: "north_america",
    adjacentTo: ["northwest_territory", "alberta", "kamchatka"],
    svgPathId: "path-alaska",
  },
  // ... all 42 territories
];
```

### 4.2 SVG Map

The map is an SVG file where each territory is a `<path>` element with an ID matching the territory's `svgPathId`. The SVG should be approximately 1000x600 viewBox.

**Approach**: Find or create a RISK map SVG (there are open-source ones available). Each territory path gets wrapped in a React component:

```tsx
interface TerritoryProps {
  id: TerritoryId;
  owner: Player | null;
  troops: number;
  onClick: (id: TerritoryId) => void;
  highlighted: boolean;       // valid attack/fortify target
  selected: boolean;          // currently selected source
}
```

Territory colors are filled based on owner. Troop counts are rendered as `<text>` elements positioned at each territory's centroid (store centroid x,y in territory data).

---

## 5. Game Flow & State Machine

### 5.1 Lobby Phase (`status: "lobby"`)

1. Creator hits "New Game" → server generates game with `roomCode`
2. Creator lands on lobby screen showing the room code prominently
3. Friends join via URL (`/game/:roomCode`) or by entering code on home page
4. Each joiner picks a display name and color (first come first served on colors)
5. Creator sees all players, can adjust settings, hits "Start Game"
6. Minimum 3 players to start

### 5.2 Setup Phase (`status: "setup"`)

**If `autoAssignTerritories: true`** (recommended default):
1. Server randomly shuffles all 42 territories and deals them evenly to players
2. Server places 1 troop on each territory
3. Players take turns placing remaining initial troops (total starting troops based on player count: 3p=35, 4p=30, 5p=25, 6p=20)
4. Each player places troops one at a time in round-robin order on their own territories

**If `autoAssignTerritories: false`**:
1. Players draft territories one at a time in turn order (snake draft)
2. Then place remaining troops as above

### 5.3 Playing Phase (`status: "playing"`)

Each turn follows this state machine:

```
┌──────────────────────────────────────────────────┐
│                    REINFORCE                      │
│  1. Calculate reinforcements:                     │
│     - territories / 3 (min 3)                     │
│     - continent bonuses                           │
│     - card trade-in bonus                         │
│  2. Player places all troops on owned territories │
│  3. Player clicks "Done Reinforcing"              │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│                     ATTACK                        │
│  1. Player selects attacking territory (2+ troops)│
│  2. Player selects adjacent enemy territory       │
│  3. Player chooses 1–3 dice (max: troops - 1)    │
│  4. Defender auto-rolls 1–2 dice (2 if 2+ troops)│
│  5. Resolve combat (compare highest dice pairs)   │
│  6. If territory conquered:                       │
│     - Move troops in (min = dice used)            │
│     - If defender eliminated, take their cards    │
│     - If all 42 territories owned, game over      │
│  7. Player can attack again or click "Done"       │
│  8. If player conquered ≥1 territory, draw 1 card │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│                    FORTIFY                         │
│  1. Player may move troops from one territory to  │
│     another connected owned territory (optional)  │
│  2. Only one fortify move per turn                │
│  3. Must leave at least 1 troop behind            │
│  4. Player clicks "End Turn"                      │
└──────────────┬───────────────────────────────────┘
               ▼
         Next player's REINFORCE phase
```

### 5.4 Combat Resolution Algorithm

```typescript
function resolveCombat(attackerDiceCount: number, defenderDiceCount: number): CombatResult {
  // Roll dice
  const attackerDice = rollDice(attackerDiceCount).sort((a, b) => b - a);
  const defenderDice = rollDice(defenderDiceCount).sort((a, b) => b - a);

  let attackerLosses = 0;
  let defenderLosses = 0;

  // Compare pairs (highest vs highest, second vs second)
  const pairs = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < pairs; i++) {
    if (attackerDice[i] > defenderDice[i]) {
      defenderLosses++;
    } else {
      attackerLosses++; // ties go to defender
    }
  }

  return { attackerDice, defenderDice, attackerLosses, defenderLosses };
}
```

### 5.5 Card Trade-In Rules

Cards can be traded in sets of 3 during the reinforce phase:
- 3 of the same type (3 infantry, 3 cavalry, or 3 artillery)
- 1 of each type
- Any 2 + 1 wild

Escalating bonus armies for each trade-in across the whole game:
- 1st trade: 4 armies
- 2nd: 6
- 3rd: 8
- 4th: 10
- 5th: 12
- 6th: 15
- Then +5 for each subsequent trade

If a traded card matches a territory you own, +2 bonus armies on that territory.

Players MUST trade in if they have 5+ cards at the start of their reinforce phase.

---

## 6. API & Socket Events

### 6.1 REST Endpoints

```
POST   /api/games                 — Create a new game (returns gameId + roomCode)
GET    /api/games/:roomCode       — Get game state (filtered: hide other players' cards)
POST   /api/games/:roomCode/join  — Join a game (body: { name: string })
```

### 6.2 Socket.IO Events

**Client → Server (actions)**:

```typescript
// All actions follow this pattern:
interface GameAction {
  type: string;
  playerId: string;
  // ... action-specific fields
}

// Lobby
{ type: "start_game" }
{ type: "update_settings", settings: Partial<GameSettings> }

// Setup
{ type: "place_initial_troop", territoryId: TerritoryId }

// Reinforce
{ type: "trade_cards", cardIndices: [number, number, number] }
{ type: "place_troops", placements: { territoryId: TerritoryId, count: number }[] }
{ type: "done_reinforcing" }

// Attack
{ type: "select_attack", from: TerritoryId, to: TerritoryId, dice: number }
{ type: "move_troops_after_conquest", troops: number }
{ type: "done_attacking" }

// Fortify
{ type: "fortify", from: TerritoryId, to: TerritoryId, troops: number }
{ type: "skip_fortify" }
```

**Server → Client (broadcasts)**:

```typescript
// Sent to all players after every state change
{ event: "game_state_update", state: FilteredGameState }

// Sent alongside state update for combat for animation purposes
{ event: "combat_result", result: CombatState }

// Player connectivity
{ event: "player_connected", playerId: string }
{ event: "player_disconnected", playerId: string }

// Errors (sent only to the acting player)
{ event: "action_error", message: string }
```

### 6.3 State Filtering

Before sending state to a client, filter out private information:
- Other players' `cards` arrays → replace with `cardCount` only
- The `cardDeck` contents → send only `deckCount`

---

## 7. Frontend Architecture

### 7.1 Page Structure

```
/                           — Home: "Create Game" button + "Join Game" code input
/game/:roomCode             — Main game view (lobby, setup, playing, results)
```

Only two pages. Keep it minimal.

### 7.2 Component Tree

```
App
├── HomePage
│   ├── CreateGameButton
│   └── JoinGameForm
│
└── GamePage
    ├── Lobby (when status === "lobby")
    │   ├── RoomCodeDisplay (big, copyable)
    │   ├── PlayerList
    │   ├── SettingsPanel (host only)
    │   └── StartButton (host only)
    │
    ├── GameBoard (when status === "setup" | "playing")
    │   ├── MapView
    │   │   ├── TerritoryPath (×42, SVG paths)
    │   │   └── TroopMarker (×42, positioned at centroids)
    │   │
    │   ├── Sidebar
    │   │   ├── TurnIndicator (whose turn, what phase)
    │   │   ├── PlayerStatusList (colors, territories, troops, card count)
    │   │   ├── CardHand (your cards, trade-in button)
    │   │   └── PhaseActions
    │   │       ├── ReinforceControls (troop placement)
    │   │       ├── AttackControls (dice selection, attack/done buttons)
    │   │       └── FortifyControls (source, target, troop slider)
    │   │
    │   ├── DiceRollOverlay (animated dice when combat happens)
    │   └── ActivityLog (scrolling log of recent actions)
    │
    └── GameOver (when status === "finished")
        ├── WinnerAnnouncement
        └── PlayAgainButton
```

### 7.3 Map Interaction States

The map needs different click behaviors per phase:

| Phase     | Click Behavior |
|-----------|---------------|
| Reinforce | Click own territory → place 1 troop (or shift+click for 5) |
| Attack    | 1st click: select own territory (2+ troops) as source. 2nd click: select adjacent enemy territory as target. |
| Fortify   | 1st click: select own territory as source. 2nd click: select connected own territory as destination. Slider for troop count. |

Highlight valid targets on hover. Grey out invalid territories per phase.

### 7.4 Key UX Details

- **Troop placement in reinforce**: Show remaining troops to place. Allow clicking individual territories (adds 1 each click) and a "confirm" button when done. Show a running total.
- **Attack dice selection**: After selecting attacker and defender, show 1/2/3 dice buttons (max = troops on territory minus 1, capped at 3). Defender auto-rolls.
- **Dice animation**: Show physical-looking dice that tumble for ~1 second, then land on the rolled values. Highlight winning pairs in green, losing in red.
- **Post-conquest troop movement**: After conquering, show a slider (min: dice used, max: troops on attacking territory minus 1) for how many troops to move in.
- **Card hand**: Show cards as small icons. When 3+ cards are selected that form a valid set, enable "Trade In" button. Force trade-in at 5 cards.

---

## 8. Server-Side Validation

Every action must be validated before applying. Reject with an error message if invalid.

### Validation Checklist Per Action

**place_troops**:
- It is the player's turn
- Current phase is "reinforce"
- All target territories are owned by this player
- Total troops placed ≤ available reinforcements
- No negative troop counts

**select_attack**:
- It is the player's turn
- Current phase is "attack"
- `from` territory is owned by player
- `from` territory has ≥ 2 troops
- `to` territory is adjacent to `from`
- `to` territory is NOT owned by player
- `dice` is between 1 and min(3, troops on `from` - 1)

**fortify**:
- It is the player's turn
- Current phase is "fortify"
- Both territories owned by player
- Territories are connected (BFS/DFS through owned territories only)
- `troops` is between 1 and (troops on source - 1)

**trade_cards**:
- It is the player's turn
- Current phase is "reinforce"
- Player owns the cards at the specified indices
- The 3 cards form a valid set

### Connectivity Check (for fortify)

```typescript
function areConnectedThroughOwned(
  from: TerritoryId,
  to: TerritoryId,
  ownerId: string,
  territories: Record<TerritoryId, TerritoryState>
): boolean {
  // BFS from `from`, only traversing territories owned by ownerId
  const visited = new Set<TerritoryId>();
  const queue: TerritoryId[] = [from];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;

    for (const neighbor of getAdjacent(current)) {
      if (!visited.has(neighbor) && territories[neighbor].owner === ownerId) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}
```

---

## 9. Reconnection & Persistence

### Player Reconnection
- When a player disconnects, mark them as `connected: false` and broadcast to others
- Their turn is NOT skipped — the game waits (or optionally a turn timer can auto-skip)
- When they reconnect (same browser, Socket.IO handles this via session), send them the full current state
- Use Socket.IO's built-in reconnection with the player's ID stored in `localStorage`

### Game Persistence
- After every state-mutating action, write the full game state to SQLite
- On server restart, load all active games from DB
- Games with `status: "lobby"` older than 24 hours → auto-delete
- Games with `status: "playing"` persist indefinitely (or until 7 days of inactivity)

### Player Identity
- On first visit, generate a UUID and store in `localStorage`
- When joining a game, associate this UUID with the player slot
- On reconnection, the UUID identifies the returning player
- No accounts, no passwords — if someone clears localStorage, the host can reassign their slot (stretch goal, not required for MVP)

---

## 10. Testing Strategy

Testing is a first-class priority in this project. Every game logic function must be tested alongside its implementation — not as a follow-up phase. The rule is: **if it touches game state, it has tests.**

### 10.1 Seedable RNG Wrapper

All randomness in the game (dice rolls, card shuffles, territory assignment) must go through a single injectable RNG function. This is critical for deterministic tests.

```typescript
// server/game/rng.ts

type RngFunction = () => number; // returns 0–1, like Math.random

let currentRng: RngFunction = Math.random;

export function setRng(rng: RngFunction): void {
  currentRng = rng;
}

export function resetRng(): void {
  currentRng = Math.random;
}

export function rollDie(): number {
  return Math.floor(currentRng() * 6) + 1;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(currentRng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

In tests, inject a seeded PRNG (e.g., `seedrandom` npm package) or a simple sequence:

```typescript
import { setRng, resetRng } from "../server/game/rng";

// Produce a predictable sequence of dice rolls
function createSequenceRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

beforeEach(() => {
  // Each value maps to a die face: (val * 6) + 1
  // 0.0 → 1, 0.166 → 1, 0.5 → 4, 0.999 → 6
  setRng(createSequenceRng([0.0, 0.5, 0.999]));
});

afterEach(() => resetRng());
```

**Every function that uses randomness must import from `rng.ts`, never call `Math.random()` directly.** This is a hard rule.

### 10.2 Unit Test Requirements

Unit tests cover pure functions with no I/O dependencies. These are the fastest to write and the highest-value tests in the project.

#### Territory Data Integrity
Test file: `server/game/__tests__/territories.test.ts`

| Test Case | What It Validates |
|-----------|-------------------|
| All 42 territories exist | Territory count matches expected |
| Continent membership is complete | Every territory belongs to exactly one continent, continent territory counts match (NA=9, SA=4, EU=7, AF=6, AS=12, AU=4) |
| Adjacency is bidirectional | If A lists B as adjacent, B must list A |
| No self-adjacency | No territory lists itself as a neighbor |
| No duplicate adjacencies | No territory lists the same neighbor twice |
| Continent bonus values are correct | NA=5, SA=2, EU=5, AF=3, AS=7, AU=2 |

#### Combat Resolution
Test file: `server/game/__tests__/combat.test.ts`

| Test Case | What It Validates |
|-----------|-------------------|
| 3v2 attacker wins both | Seed dice so attacker rolls higher on both pairs → defender loses 2 |
| 3v2 defender wins both | Seed dice so defender rolls higher/ties on both → attacker loses 2 |
| 3v2 split result | Attacker wins one pair, defender wins the other → 1 loss each |
| Ties go to defender | Equal dice values → attacker loses the troop |
| 1v1 combat | Only one pair compared |
| 3v1 combat | Only one pair compared (highest attacker vs single defender) |
| 2v2 combat | Two pairs compared |
| Dice are sorted descending | Highest dice are compared first regardless of roll order |

#### Reinforcement Calculation
Test file: `server/game/__tests__/reinforcements.test.ts`

| Test Case | What It Validates |
|-----------|-------------------|
| Minimum 3 armies | Player with 9 or fewer territories gets 3 |
| Territory count / 3 | Player with 12 territories gets 4 |
| Single continent bonus | Player holding all of Australia gets +2 |
| Multiple continent bonuses | Player holding NA + SA gets +5 +2 = +7 bonus |
| No bonus for partial continent | Player holding 11 of 12 Asia territories gets no Asia bonus |
| Combined calculation | 15 territories (=5) + Australia (=2) = 7 total |

#### Card Trade-In
Test file: `server/game/__tests__/cards.test.ts`

| Test Case | What It Validates |
|-----------|-------------------|
| Three of same type is valid | 3 infantry, 3 cavalry, 3 artillery |
| One of each type is valid | infantry + cavalry + artillery |
| Two + wild is valid | 2 infantry + 1 wild |
| Invalid set rejected | 2 infantry + 1 cavalry (no wild) |
| Escalating army values | 1st trade=4, 2nd=6, 3rd=8, 4th=10, 5th=12, 6th=15, 7th=20 |
| Territory bonus | If a traded card matches a territory you own, +2 on that territory |
| Forced trade-in at 5 cards | Player with 5+ cards must trade before placing troops |

#### Validation Functions
Test file: `server/game/__tests__/validation.test.ts`

For EVERY action type, test both the happy path AND every rejection case listed in Section 8. Each rejection reason in the validation checklist = one test case. Examples:

| Test Case | Expected Result |
|-----------|----------------|
| Place troops on own territory during reinforce | ✅ Allowed |
| Place troops on enemy territory | ❌ Rejected: "You don't own this territory" |
| Place more troops than available | ❌ Rejected: "Not enough reinforcements" |
| Attack from territory with 1 troop | ❌ Rejected: "Need at least 2 troops to attack" |
| Attack your own territory | ❌ Rejected: "Cannot attack your own territory" |
| Attack non-adjacent territory | ❌ Rejected: "Territories are not adjacent" |
| Fortify between unconnected territories | ❌ Rejected: "Territories are not connected" |
| Fortify leaving 0 troops | ❌ Rejected: "Must leave at least 1 troop" |
| Take action when it's not your turn | ❌ Rejected: "Not your turn" |
| Attack during reinforce phase | ❌ Rejected: "Wrong phase" |

#### Pathfinding (Fortify Connectivity)
Test file: `server/game/__tests__/pathfinding.test.ts`

Create small hand-crafted board states (not the full 42-territory map) to test:

| Test Case | Board Setup | Expected |
|-----------|-------------|----------|
| Direct neighbors | A owns X and Y, they're adjacent | Connected ✅ |
| Chain through owned | A owns X→Y→Z in a chain | X and Z connected ✅ |
| Blocked by enemy | A owns X and Z, enemy owns Y between them | X and Z NOT connected ❌ |
| Island territory | A owns X (no adjacent owned territories) | X not connected to anything ❌ |
| Multiple paths | A owns X→Y→Z and X→W→Z | Connected ✅ (either path works) |

### 10.3 Integration Test Requirements

Integration tests verify the full action lifecycle: action comes in → engine validates → state updates → correct new state comes out. These test the `applyAction` function (or equivalent game engine entry point) with real game state objects.

Test file: `server/game/__tests__/engine.integration.test.ts`

#### Full Turn Cycle
Set up a game mid-play with 3 players. Execute a complete turn:
1. Player gets reinforcements → state shows correct troop count to place
2. Player places troops → state reflects new troop positions
3. Player attacks → combat resolves, troops adjust on both territories
4. Player conquers territory → ownership changes, troops move in, card drawn
5. Player fortifies → troops move between connected territories
6. Turn advances → next player's reinforce phase, correct player ID

#### Territory Conquest & Elimination
1. Set up a board where defender has 1 troop on their last territory
2. Attacker conquers it → defender eliminated, attacker inherits cards
3. If attacker now has 5+ cards → forced trade-in triggers before continuing
4. If attacker owns all 42 territories → game status changes to "finished", winner set

#### Card Lifecycle
1. Player conquers a territory during attack phase → earns exactly 1 card (not more, even with multiple conquests)
2. Player trades in valid set during reinforce → armies added, cards removed, tradeInCount incremented
3. Card deck runs out → discard pile reshuffled into deck

### 10.4 Socket Integration Tests

Test file: `server/__tests__/socket.integration.test.ts`

These spin up a real Express + Socket.IO server and connect multiple `socket.io-client` instances to simulate a multiplayer game.

| Test Case | What It Validates |
|-----------|-------------------|
| Create and join game | 3 clients join with room code, all receive player list updates |
| Start game broadcast | Host starts game, all clients receive setup state |
| Action → broadcast cycle | Player 1 places troops, players 2 and 3 receive updated state |
| Invalid action rejected | Player 2 acts during Player 1's turn, gets error, no state broadcast |
| State filtering | Player 1's cards are visible only in Player 1's state payload |
| Disconnect/reconnect | Player disconnects, others see "disconnected" status, player reconnects and receives current state |

### 10.5 End-to-End Game Simulation

Test file: `server/game/__tests__/simulation.test.ts`

Write a test that plays an entire game to completion programmatically:

```typescript
describe("full game simulation", () => {
  it("should complete a 3-player game with only valid moves", () => {
    const rng = seedrandom("test-seed-123");
    setRng(rng);

    let state = createGame({ maxPlayers: 3 });
    state = addPlayer(state, "Alice");
    state = addPlayer(state, "Bob");
    state = addPlayer(state, "Carol");
    state = startGame(state);

    let moveCount = 0;
    const MAX_MOVES = 10000; // safety valve

    while (state.status !== "finished" && moveCount < MAX_MOVES) {
      const currentPlayer = state.players[state.turnOrder[state.currentTurnIndex]];
      const validActions = getValidActions(state, currentPlayer.id);

      // Pick a random valid action
      const action = validActions[Math.floor(rng() * validActions.length)];
      state = applyAction(state, action);
      moveCount++;

      // Invariant checks after every action
      assertInvariants(state);
    }

    expect(state.status).toBe("finished");
    expect(state.winner).toBeTruthy();
  });
});

function assertInvariants(state: GameState): void {
  // Every territory has an owner
  for (const [id, territory] of Object.entries(state.territories)) {
    expect(territory.owner).toBeTruthy();
    expect(territory.troops).toBeGreaterThanOrEqual(1);
  }
  // Total territories === 42
  expect(Object.keys(state.territories)).toHaveLength(42);
  // No eliminated player owns territories
  for (const player of state.players) {
    if (player.eliminated) {
      const owned = Object.values(state.territories).filter(t => t.owner === player.id);
      expect(owned).toHaveLength(0);
    }
  }
  // Turn index is valid
  expect(state.currentTurnIndex).toBeLessThan(state.turnOrder.length);
}
```

This is the single most valuable test in the project. It exercises the entire state machine under realistic conditions and catches state corruption, infinite loops, and edge cases that no individual unit test would find. Run it with multiple seeds.

### 10.6 What NOT to Mock

This is critical. Only mock I/O boundaries:

| ✅ Mock These | ❌ Never Mock These |
|---------------|---------------------|
| SQLite read/write | Combat resolution logic |
| Socket.IO emit/broadcast | Reinforcement calculation |
| System clock (for timestamps) | Validation functions |
| | Card trade-in logic |
| | Pathfinding / connectivity |
| | The `applyAction` engine |

If a test mocks the function it's supposed to be testing, the test is worthless. Tests must exercise real game logic with real state objects.

### 10.7 Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| `server/game/combat.ts` | 100% branch | Combat bugs ruin games and are invisible |
| `server/game/validation.ts` | 100% branch | Every rejection path must be tested |
| `server/game/reinforcements.ts` | 100% branch | Math errors compound over a game |
| `server/game/cards.ts` | 100% branch | Card economy affects balance |
| `server/game/territories.ts` | 100% line | Static data, but adjacency errors are subtle |
| `server/game/engine.ts` | >90% branch | Core state machine |
| `server/socket/` | >80% line | Integration-tested via socket tests |
| `client/` | Not a priority for MVP | UI testing is lower ROI for a friend-group game |

---

## 11. Implementation Order

Build in this order. **Every phase includes its tests. A phase is not done until its tests pass.**

### Phase 1: Foundation + Territory Tests
1. Project scaffolding (Vite + React + Express + Socket.IO + SQLite + **Vitest**)
2. Seedable RNG wrapper (`server/game/rng.ts`) — this must exist before any game logic
3. Territory data file (all 42 territories with adjacency lists)
4. **Territory data integrity tests** (all 42 exist, adjacency is bidirectional, continent membership correct, no self-adjacency)
5. SVG map rendering (just colored territories, no game logic)
6. Click handlers on territories (log to console)

### Phase 2: Lobby & Setup + Validation Foundation
7. REST endpoint to create a game
8. Room code join flow
9. Lobby UI with player list and start button
10. Socket.IO connection and player tracking
11. Random territory assignment (using seedable RNG)
12. Initial troop placement round
13. **Validation function stubs + tests** for setup actions (join, start, place initial troop)

### Phase 3: Core Game Loop + Core Unit Tests
14. Reinforcement calculation function
15. **Reinforcement unit tests** (territory count, continent bonuses, minimums, combined)
16. Combat resolution function
17. **Combat unit tests** (every dice combo: 3v2, 3v1, 2v2, 1v1, ties, split results)
18. Reinforce phase (place troops UI + server logic)
19. Attack phase (territory selection + dice rolling + conquest)
20. **Validation tests** for reinforce and attack actions (every accept + reject case)
21. Fortify pathfinding function
22. **Pathfinding unit tests** (direct, chain, blocked, island, multiple paths)
23. Fortify phase (UI + server logic)
24. **Validation tests** for fortify actions
25. Turn advancement + victory detection
26. **Full turn cycle integration test** (reinforce → attack → fortify → next player)

### Phase 4: Cards, Elimination + Integration Tests
27. Card deck, drawing, and trade-in logic
28. **Card unit tests** (valid/invalid sets, escalating values, territory bonus, forced trade-in)
29. Card hand UI
30. Player elimination handling (inherit cards, forced trade-in)
31. **Conquest + elimination integration test** (attack last territory → eliminate → inherit cards)
32. **Card lifecycle integration test** (earn card on conquest, trade in, deck reshuffle)
33. Dice roll animations
34. Activity log
35. Game over screen

### Phase 5: Sockets, Resilience + E2E
36. **Socket integration tests** (multi-client join, action→broadcast, invalid action rejection, state filtering, disconnect/reconnect)
37. Full state persistence to SQLite
38. Reconnection handling
39. Turn timer (optional)
40. **End-to-end game simulation test** (3 bots play to completion with invariant checks, multiple seeds)
41. Edge case hardening (simultaneous actions, race conditions)

---

## 12. File & Folder Structure

```
risk-game/
├── package.json
├── tsconfig.json
├── vitest.config.ts                # Shared Vitest configuration
│
├── server/
│   ├── index.ts                    # Express + Socket.IO setup
│   ├── db.ts                       # SQLite connection + queries
│   ├── routes/
│   │   └── games.ts                # REST endpoints
│   ├── game/
│   │   ├── state.ts                # GameState type + initial state factory
│   │   ├── engine.ts               # Core game logic: apply action → new state
│   │   ├── validation.ts           # Action validation rules
│   │   ├── combat.ts               # Dice rolling + combat resolution
│   │   ├── cards.ts                # Card deck + trade-in logic
│   │   ├── reinforcements.ts       # Troop calculation
│   │   ├── territories.ts          # Territory data + adjacency + pathfinding
│   │   ├── rng.ts                  # Seedable RNG wrapper (all randomness goes through here)
│   │   └── __tests__/
│   │       ├── territories.test.ts       # Territory data integrity tests
│   │       ├── combat.test.ts            # Combat resolution with seeded dice
│   │       ├── reinforcements.test.ts    # Troop calculation tests
│   │       ├── cards.test.ts             # Card trade-in logic tests
│   │       ├── validation.test.ts        # Action validation (accept + reject cases)
│   │       ├── pathfinding.test.ts       # Fortify connectivity tests
│   │       ├── engine.integration.test.ts # Full turn cycle, conquest, elimination
│   │       └── simulation.test.ts        # End-to-end game with random valid moves
│   ├── socket/
│   │   └── handler.ts              # Socket.IO event handlers
│   └── __tests__/
│       └── socket.integration.test.ts  # Multi-client Socket.IO tests
│
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── store/
│   │   │   └── gameStore.ts        # Zustand store
│   │   ├── socket/
│   │   │   └── client.ts           # Socket.IO client setup
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   └── GamePage.tsx
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── MapView.tsx
│   │   │   │   ├── TerritoryPath.tsx
│   │   │   │   ├── TroopMarker.tsx
│   │   │   │   └── mapData.ts      # SVG path data + centroids
│   │   │   ├── lobby/
│   │   │   │   ├── Lobby.tsx
│   │   │   │   ├── PlayerList.tsx
│   │   │   │   └── SettingsPanel.tsx
│   │   │   ├── game/
│   │   │   │   ├── GameBoard.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TurnIndicator.tsx
│   │   │   │   ├── PhaseActions.tsx
│   │   │   │   ├── CardHand.tsx
│   │   │   │   ├── DiceOverlay.tsx
│   │   │   │   └── ActivityLog.tsx
│   │   │   └── GameOver.tsx
│   │   └── utils/
│   │       ├── colors.ts           # Player color definitions
│   │       └── helpers.ts
│
└── shared/
    └── types.ts                    # Shared TypeScript types (GameState, actions, etc.)
```

---

## 13. Key Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Zero config, single file, plenty of throughput for <10 games. Migrate later if needed. |
| Full state in one JSON column | Atomic reads/writes, no complex joins, easy to debug by inspecting a single object. |
| Server-authoritative | Prevents cheating, simplifies client logic, single source of truth. |
| Socket.IO over raw WebSockets | Built-in reconnection, rooms, namespaces, and fallback to polling. |
| SVG map over Canvas | Clickable regions for free via DOM events, easier to style with CSS, accessible. |
| No user accounts | Friends don't need accounts to play a board game. UUID in localStorage is enough. |
| Zustand over Redux | Minimal boilerplate, easy to sync with socket events, good TypeScript support. |
| TypeScript everywhere | Shared types between client and server catch bugs at compile time, especially important for the complex game state. |
| Vitest over Jest | Native TypeScript and ESM support, same config for client and server, faster execution, Vite-compatible. |
| Seedable RNG wrapper | All randomness through one injectable function enables fully deterministic tests — critical for a dice-based game. |

---

## 14. Edge Cases to Handle

- **Player disconnects during their turn**: Game pauses on that player. Show "Waiting for [Name] to reconnect..." to others. Optional: auto-skip after timer expires.
- **Player disconnects permanently**: Host gets a "kick player" option after 5 minutes of disconnect. Kicked player's territories become neutral (gray) with existing troops, or are distributed evenly to remaining players (host chooses).
- **Card overflow on elimination**: If eliminating a player gives you 6+ cards, you must immediately trade in before continuing your attack phase.
- **Last two players**: Game continues normally with 2 players.
- **Simultaneous actions**: Socket.IO processes events sequentially per connection. The server should also use a per-game mutex/lock to prevent race conditions if two events arrive in the same tick.
- **Browser tab closed and reopened**: localStorage UUID allows seamless rejoin. Socket.IO reconnects automatically.

---

## 15. Future Enhancements (Post-MVP)

These are explicitly OUT OF SCOPE for the initial build but worth keeping in mind architecturally:

- **Game variants**: Capital RISK, Secret Mission RISK
- **Undo last action**: Keep a state history stack (just store last N states)
- **Spectator mode**: Read-only socket connection that receives all broadcasts
- **Game replay**: Store full action log, replay by applying actions sequentially
- **AI players**: Implement a simple bot that can fill empty slots
- **Mobile layout**: Responsive map that works on phones (pinch to zoom)
- **Sound effects**: Dice rolls, conquest fanfare, turn notification
- **Push notifications**: "It's your turn!" via browser notifications API
