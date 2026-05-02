# Cross-Cutting Constraints

This document is injected into every coding prompt. It defines invariants that span all phases and explicit dependencies between phases. Violating anything here corrupts game state in ways that are hard to debug.

---

## Shared Foundation Files

These files are created in Phase 0 and **must not be restructured** without updating every phase that imports them. All other code depends on them.

| File                                    | Role                                                                                            | Dependents        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| `src/lib/firebase.ts`                   | Firebase app init, exports `db` and `auth`. Connects to emulator when `VITE_USE_EMULATOR=true`. | All phases        |
| `src/lib/db-types.ts`                   | TypeScript interfaces for every RTDB node. Schema changes here first, then everywhere else.     | All phases        |
| `src/lib/stores/gameState.ts`           | RTDB subscription for `gameState` node. Single source of reactive game state.                   | Phases 3, 4, 5    |
| `src/lib/stores/players.ts`             | RTDB subscription for `players` map.                                                            | Phases 1, 2, 3, 5 |
| `src/lib/stores/room.ts`                | RTDB subscription for `meta` and `config`.                                                      | Phases 1, 2, 3, 4 |
| `src/routes/room/[roomId]/+page.svelte` | Phase switcher. Renders one component based on `status` + `phase`.                              | Phases 1–5        |
| `database.rules.json`                   | Security rules. Schema changes must keep rules consistent.                                      | Phases 0, 1, 5    |

---

## Invariants — Never Break These

### 1. `status` vs `phase` are separate concerns

- `room.status` (`'word-entry' | 'pre-start' | 'playing' | 'finished'`) drives **top-level screen routing** in `+page.svelte`.
- `gameState.phase` drives **sub-screen rendering** within the `playing` status only.
- **Never read `gameState.phase` when `status !== 'playing'`.** The node may not exist yet.

### 2. Server timestamp for all timer fields

- `gameState.timerStartedAt` and `gameState.pausedAt` must always be written with `serverTimestamp()` from the Firebase SDK.
- `Date.now()` is forbidden for these fields. It causes timer drift across clients.
- `timeRemainingAtPause` is the only timer field written as a plain number (it's a computed delta, not a timestamp).

### 3. Hat mutations via transaction only

- `gameState.hat` and `gameState.currentWordId` are always mutated together inside `runTransaction()`.
- Direct `set()` or `update()` on these paths is forbidden — it creates race conditions when the explainer double-taps.
- Only the client of `gameState.currentExplainerId` executes hat transactions. All other clients observe.

### 4. `onDisconnect` registration order

- `onDisconnect(connectedRef).set(false)` must be registered **before** `set(connectedRef, true)`.
- This order must be preserved in Phase 1 (initial join) and Phase 5 (reconnect flow).
- Reversing the order leaves players permanently marked as online if the client crashes between the two writes.

### 5. URL is the session identifier

- Player session = `roomId` (route param) + `playerId` (`?p=` query param).
- Session state must not be duplicated in `localStorage`, `sessionStorage`, or component-local state.
- On every page load: read both from URL, look up player node in RTDB, skip name entry if found.

### 6. Components are observers only

- `.svelte` files never call Firebase directly. They read from stores and call functions in `src/lib/game/`.
- `src/lib/game/*.ts` files contain all write logic. This boundary must not erode across phases.

### 7. Single writer per turn

- During `phase === 'explaining'` or `'post_expiry'`: only `currentExplainerId`'s client writes to `gameState`.
- Admin exceptions: `gameState.pausedAt`, `gameState.timeRemainingAtPause`, `gameState.currentExplainerId` — writable by admin at any time.
- No other client should write to `gameState.hat`, `gameState.currentWordId`, or `gameState.lastAction`.

---

## Phase-to-Phase Dependencies

Each phase leaves state that the next phase reads. Breaking these contracts causes silent failures.

### Phase 0 → All Phases

- Emulator connection in `firebase.ts` must work before any test runs.
- `db-types.ts` interfaces must exist before any Firebase read/write is coded.
- CI must pass before any feature work begins.

### Phase 1 → Phase 2

- Player node schema must be complete: `name`, `color`, `teamId` (null), `wordsSubmitted` (false), `ready` (false), `connected`, `isAdmin`.
- `onDisconnect` for `connected` must be registered in Phase 1. Phase 5 reconnect logic depends on this existing field.
- Color assignment (`lib/colors.ts`) must be collision-free. Phase 2 lobby displays player colors.

### Phase 2 → Phase 3

- `gameState` initialization (written when `status` transitions to `'playing'`) must be complete and correct:
  - `hat`: array of all wordIds, length = `playerCount × config.wordCount`
  - `round: 1`
  - `phase: 'waiting_start'`
  - `currentTeamId`: first team
  - `currentExplainerId`: first player in first team's `playerOrder`
  - `teams/{id}/playerOrder`: set and frozen. Phase 3 rotation reads this.
  - `teams/{id}/currentPlayerIndex: 0`
  - `teams/{id}/roundScores/round1: 0`, `round2: 0`, `round3: 0`
- `words/{wordId}` nodes must exist for every wordId in `hat`. Phase 3 reads word text by ID.

### Phase 3 → Phase 4

- `endRound()` in `turn.ts` must correctly:
  - Refill `hat` from original word IDs (all words from `/rooms/{id}/words/`)
  - Increment `round`
  - **Not** reset `currentTeamId` or `currentPlayerIndex` — turn order continues
  - Reset `currentWordId: null`, `lastAction: null`
- `teams/{id}/roundScores/round{N}` must be accurately accumulated throughout Phase 3 for Phase 4 scoreboard totals.
- `playerStats/{playerId}/wordsExplained` must be updated on every successful Guessed action in Phase 3.

### Phase 3 → Phase 5

- `pausedAt` and `timeRemainingAtPause` fields must exist in the schema (defined in Phase 0 types, unused until Phase 5).
- `currentExplainerId` override (admin reassign) depends on `teams/{id}/playerOrder` being correct and immutable after game start.
- The disconnect overlay depends on `players/{id}/connected` being managed by `onDisconnect()` from Phase 1.

### Phase 4 → scoreboard

- `teams/{id}/roundScores` across all 3 rounds must be present and non-null. Scoreboard sums them.
- `playerStats/{id}/wordsExplained` accumulates across all rounds. Never reset between rounds.

---

## Local Development Mode

Set `VITE_DEV_BYPASS_MIN_PLAYERS=true` in `.env.local` to enable solo testing.

**What it bypasses:**

- Minimum 2 players per team check in Lobby
- All-players-ready gate (single player can proceed alone)

**What it does not bypass:**

- Firebase emulator connection
- RTDB rules validation
- Any game logic (timer, transactions, scoring)

This flag is checked only in `Lobby.svelte` and the game initialization function in `turn.ts`. It must not propagate elsewhere. It must never be `true` in any environment other than local dev.

```json
// package.json — example scripts
{
  "scripts": {
    "dev": "vite dev",
    "dev:solo": "VITE_DEV_BYPASS_MIN_PLAYERS=true vite dev",
    "emulators": "firebase emulators:start --only database,functions",
    "dev:full": "concurrently \"npm run emulators\" \"npm run dev\"",
    "dev:solo:full": "concurrently \"npm run emulators\" \"npm run dev:solo\""
  }
}
```

Use `npm run dev:solo:full` to start emulators + dev server + bypass in one command. Requires `concurrently` package.

---

## State Machine Reference (Quick Lookup)

```
status transitions:
  word-entry → pre-start → playing → finished
  finished → word-entry  (restart)

gameState.phase transitions (only when status === 'playing'):
  waiting_start → explaining
  explaining → post_expiry     (timer ends, word shown >2s)
  explaining → post_turn       (timer ends, word shown <2s OR hat empty mid-turn)
  post_expiry → post_turn      (explainer presses Guessed or Skip)
  post_turn → waiting_start    (hat not empty, next team's turn)
  post_turn → round_end        (hat empty)
  round_end → waiting_start    (round < 3, hat refilled)
  round_end → [status: finished] (round === 3)
```

Any transition not listed above is invalid. Writing an unlisted transition corrupts routing for all clients.
