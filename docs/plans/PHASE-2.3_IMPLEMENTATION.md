# Phase 2.3 — Game Initialization & Start Trigger

## Definition

Admin clicks "Start Game" button in Lobby → `initializeGameState()` builds and writes the complete `gameState` node, then writes `status: 'playing'`. This is the single transition from lobby to active game. All other clients observe the status change via `roomStore.status` and route to the game screen (placeholder in Phase 2, actual GameMain in Phase 3).

**What this function does:**

1. Reads all players from `/rooms/{roomId}/players` and all words from `/rooms/{roomId}/words`.
2. Computes team assignments: groups players by `teamId`, shuffles each group into `playerOrder`, sets `currentPlayerIndex: 0`.
3. Builds `hat` array: all `wordId` keys from `/words/`, repeated such that `hat.length === playerCount × config.wordCount`. (Each word is in the hat exactly once per player who submitted it — dups included.)
4. Determines first team and first explainer: `currentTeamId = firstTeamId`, `currentExplainerId = playerOrder[0]` of that team.
5. Writes `teams/{teamId}` nodes (name, playerOrder, currentPlayerIndex, roundScores: {0,0,0}).
6. Writes `gameState` node with all fields.
7. Writes `status: 'playing'` — **last**, so no client sees partial `gameState`.

**Why this split:** This function is the most complex Phase 2 logic — touches 5 RTDB paths, must be atomic in effect (all writes complete before status changes), and has the most constraints. Separating it from lobby UI (2.2) and word entry (2.1) keeps each sub-phase scoped to one cognitive chunk. The UI integration is trivial once the function exists.

## Acceptance Criteria

1. `initializeGameState()` builds `hat` with length exactly `totalPlayers × config.wordCount`.
2. `hat` contains every `wordId` from `/rooms/{roomId}/words/` exactly once per player who submitted words.
3. Teams are created at `/rooms/{roomId}/teams/{teamId}` with `name`, `playerOrder`, `currentPlayerIndex: 0`, `roundScores` initialized to 0 for all 3 rounds.
4. `playerOrder` within each team is a random permutation of that team's player IDs.
5. `gameState.round = 1`, `gameState.phase = 'waiting_start'`, `gameState.currentWordId = null`, `gameState.lastAction = null`.
6. `gameState.currentTeamId` is the first team (by team index: "team1" or lexicographically first).
7. `gameState.currentExplainerId === gameState.teams[currentTeamId].playerOrder[0]`.
8. `gameState.pausedAt = null`, `gameState.timeRemainingAtPause = null`, `gameState.timerStartedAt = null`.
9. `gameState.playerStats` initialized as empty `{}` for every player (populated incrementally in Phase 3).
10. `status` written as `'playing'` **only after** all other writes succeed. No partial gameState observable by other clients.
11. With `VITE_DEV_BYPASS_MIN_PLAYERS=true`: function succeeds with 1 player per team. Without bypass: throws `MinPlayersError` when any team has < 2 players.
12. Calling `initializeGameState()` when `status !== 'pre-start'` throws `InvalidPhaseTransitionError`.
13. Function is idempotent-safe: calling twice does not corrupt state (second call throws because status is already `'playing'`).
14. All writes use admin auth (required by security rules for `gameState`, `teams`, `status`). Non-admin call throws permission-denied.

## Files I Will Touch

| File                                          | Reason                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/game/turn.ts` (NEW)                  | `initializeGameState()` — builds hat, teams, gameState, writes all, transitions status.                                             |
| `src/lib/game/turn.test.ts` (NEW)             | Tests for initializeGameState against emulator. All Phase 2 AC test cases.                                                          |
| `src/lib/components/phases/Lobby.svelte`      | Wire "Start Game" button onClick → `initializeGameState()`. Add loading/error state.                                                |
| `src/routes/room/[roomId]/+page.svelte` (MOD) | Replace `playing` placeholder with "Game starting..." transition state (or placeholder).                                            |
| `src/lib/db-types.ts` (MODIFY)                | Add `PlayerStats` to `GameState.playerStats` type (already present but verify `Record<string, PlayerStats>` covers initialization). |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/turn.ts

/** Error thrown when attempting init when status is not 'pre-start'. */
export class InvalidPhaseTransitionError extends Error {
  constructor(public currentStatus: string)
}

/** Error thrown when any team has fewer than 2 players (bypass not enabled). */
export class MinPlayersError extends Error {
  constructor(public teamId: string, public count: number)
}

/**
 * Initializes the game state and transitions room from pre-start → playing.
 * Must be called by admin (required by security rules).
 *
 * Reads all players and all words from RTDB. Writes teams, gameState, then status.
 * Status is written LAST — all clients see the full gameState atomically.
 *
 * @param bypassMinPlayers - when true, skips the ≥2-players-per-team check
 */
export async function initializeGameState(
  db: Database,
  roomId: string,
  bypassMinPlayers: boolean,
): Promise<void>
```

```typescript
// Lobby.svelte — added to existing props
let {
  // ... existing props from Phase 2.2
  onStartGame: (() => Promise<void>) | undefined  // called when admin clicks Start Game
} = $props()
```

## Tests I Will Write First

```typescript
// src/lib/game/turn.test.ts

describe("initializeGameState", () => {
  // --- Hat construction ---
  it("builds hat with length = totalPlayers × config.wordCount")
  // AC 1

  it("hat contains every wordId from /words/ exactly once per player who submitted")
  // AC 2

  it("duplicate word texts produce distinct wordIds in hat")
  // AC 2 — each word node has unique key, each goes into hat

  // --- Team initialization ---
  it("creates team nodes for all config.numTeams")
  // AC 3

  it("each team has name 'Team N', currentPlayerIndex: 0, roundScores all 0")
  // AC 3

  it("playerOrder is a permutation of all players assigned to that team")
  // AC 4

  it("playerOrder shuffles — two calls with same data may produce different order")
  // AC 4 — non-deterministic but verify all players present

  // --- gameState fields ---
  it("sets round: 1, phase: 'waiting_start', currentWordId: null, lastAction: null")
  // AC 5

  it("sets currentTeamId to first team (by index)")
  // AC 6

  it("sets currentExplainerId to playerOrder[0] of currentTeamId")
  // AC 7

  it("initializes pausedAt, timeRemainingAtPause, timerStartedAt to null")
  // AC 8

  it("initializes playerStats as empty {} for every player")
  // AC 9 — keys present, wordsExplained: 0 for all

  // --- Status transition ordering ---
  it("writes status: 'playing' only after gameState is complete")
  // AC 10 — verified by reading status and gameState in sequence via transaction observer

  // --- Bypass flag ---
  it("with bypassMinPlayers=true and 1 player per team: succeeds")
  // AC 11

  it("with bypassMinPlayers=false and 1 player per team: throws MinPlayersError")
  // AC 11

  it("MinPlayersError includes teamId and count")
  // error quality

  // --- Guard conditions ---
  it("throws InvalidPhaseTransitionError when status is 'word-entry'")
  // AC 12

  it("throws InvalidPhaseTransitionError when status is 'playing' (idempotency)")
  // AC 13 — second call prevention

  it("throws InvalidPhaseTransitionError when status is 'finished'")
  // AC 12

  // --- Permission ---
  it("called by non-admin throws permission-denied")
  // AC 14 — enforced by security rules

  // --- Empty edge cases ---
  it("throws when no players exist in room")
  // edge case

  it("throws when no words exist in room")
  // edge case — can't build hat

  it("player who submitted 0 words: their share of hat is empty (no wordIds from them)")
  // edge: player joined room but never submitted words (should be blocked by lobby, but guard anyway)
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only                          | `Lobby.svelte` modifications use `$state`, `$derived` only. No new patterns.                                                                                                                                                                                                                                                                                                          |
| Decoupled Logic                              | `initializeGameState()` in `turn.ts`. `Lobby.svelte` calls it via callback prop, never touches RTDB directly for game init.                                                                                                                                                                                                                                                           |
| Firebase: Server Timestamp Is the Only Clock | `gameState.timerStartedAt` initially `null` — no timestamp written. First server timestamp written in Phase 3 on "Start" button. No violation here.                                                                                                                                                                                                                                   |
| Firebase: Hat Mutations Are Transactions     | **CONFLICT — see below.** Initial hat write builds array from scratch, no concurrent mutation possible (status hasn't transitioned yet). Using `runTransaction` for initial set adds complexity with zero safety benefit. Recommendation: use `set()` for initialization, `runTransaction()` for all subsequent mutations. This is the **one exception** to the hat-transaction rule. |
| Firebase: Disconnect Registration Order      | Not applicable — no disconnect handlers modified.                                                                                                                                                                                                                                                                                                                                     |
| RTDB Is the Single Source of Truth           | `initializeGameState()` reads players and words from RTDB, computes hat/teams, writes back. No local state caching.                                                                                                                                                                                                                                                                   |
| Strict Typing                                | Return type `Promise<void>`. Error classes typed. All RTDB reads use `unknown` + type guards. No `any`.                                                                                                                                                                                                                                                                               |
| No Silent Failures                           | Throws on: invalid status, insufficient players, permission denied, empty players/words. All errors are typed classes. Empty `catch` FORBIDDEN.                                                                                                                                                                                                                                       |
| Single Responsibility                        | `initializeGameState` ≤ 60 lines (this is the complex function exception — multiple writes needed atomically). Individual helpers (buildHat, assignTeams, shuffle) each ≤ 20 lines.                                                                                                                                                                                                   |
| Test Before Implement                        | Write `turn.test.ts` first. 18 tests. All pass against emulator.                                                                                                                                                                                                                                                                                                                      |
| Styling                                      | Not applicable — no new UI, only button wiring. Existing Lobby.svelte styles unchanged.                                                                                                                                                                                                                                                                                               |
| Accessibility                                | "Start Game" button already has `aria-label="Start the game"`. Add `aria-busy="true"` during async init.                                                                                                                                                                                                                                                                              |
| Linting                                      | `npm run lint --max-warnings 0` before marking complete.                                                                                                                                                                                                                                                                                                                              |

## Risks

1. **Large hat array write:** With 15 players × 7 words = 105 wordIds in hat. RTDB write of 105-element array is fine (well under 1MB limit). But if someone sets `wordCount=100` with 15 players = 1500 entries — still fine. No pagination needed for MVP.
2. **Shuffle non-determinism in tests:** `playerOrder` is shuffled randomly. Tests that verify "playerOrder contains all team members" must not assert exact order. Use `expect(order.sort()).toEqual(expected.sort())`.
3. **Race: player joins room between words-read and status-write:** Admin clicks Start, function reads players, new player joins via invite link, function writes status: 'playing'. New player is in `players` node but not in any team's `playerOrder`. They'll be stuck on lobby screen while others transition to game. Mitigation: acceptable for MVP — admin waits for all to join before starting. Future: lock room joining when status transitions to pre-start.

## Sequencing Recommendation

Implement `initializeGameState()` + tests first (pure function, all logic testable against emulator). Then wire into `Lobby.svelte` — replace placeholder `onStart` with actual `initializeGameState()` call, add loading spinner on button, error toast on failure. Finally update `+page.svelte` to render a placeholder for `status === 'playing'` (Phase 3 builds GameMain). All testable with `npm run dev:solo:full` — full flow from words → lobby → start → playing placeholder.

## Conflicts Flagged

**CONFLICT: Hat mutations via transaction.** Constraint says "All reads and writes to `gameState.hat` and `gameState.currentWordId` must use `runTransaction()`." `initializeGameState()` performs the **initial write** of `gameState.hat` as a complete array via `set()`. This is not a mutation — the node does not exist yet. No concurrent writer exists because `status !== 'playing'` and only admin can write to `gameState` path. Using `runTransaction()` for initial creation would add 30ms latency with zero safety benefit (the transaction would retry on null → no contention). **Recommendation: exempt initial creation from the transaction rule.** All subsequent hat mutations (drawWord, returnWord) will use `runTransaction()` as required.

**CONFLICT: Non-admin cannot write gameState.** Security rules require admin auth for `gameState.write` and `status.write`. This is correct — only admin starts the game. The "Start Game" button is visible only to admin (Phase 2.2 AC 9). Non-admin pressing it (impossible via UI) would get permission-denied. Constraint is aligned with design.

**MISSING PREREQUISITE: Team nodes creation.** `initializeGameState()` writes `teams/{teamId}` with playerOrder etc. But Lobby (Phase 2.2) needs team cards to exist before game starts. Who creates the empty team nodes? Two options:

- Option A: `advanceToLobby()` (Phase 2.1) creates team nodes with empty playerOrder. Phase 2.3 fills them.
- Option B: `Lobby.svelte` on first render creates team nodes if they don't exist.

**Resolution: Option A is cleaner.** `advanceToLobby()` in Phase 2.1 should ALSO create `teams/{teamId}` nodes with `name: "Team N"`, `playerOrder: []`, `currentPlayerIndex: 0`, `roundScores: {round1:0, round2:0, round3:0}`. This is a Phase 2.1 implementation detail — update `advanceToLobby()` accordingly when implementing 2.1.
