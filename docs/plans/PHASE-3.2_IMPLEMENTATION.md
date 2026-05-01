# Phase 3.2 — Hat & Scoring Engine

## Definition

Core game state mutation functions. `drawWord()` atomically removes one random wordId from hat via `runTransaction()`. `returnWord()` adds wordId back. `awardPoint()` increments team score + player stats. `applyPenalty()` decrements score when skip penalty enabled. `undoLastAction()` reverses last Guessed or Skipped action — score adjustment, word restoration, `lastAction` cleared.

All functions write to RTDB via transaction (`hat`, `currentWordId`) or direct set (`lastAction`, scores). No UI — pure game logic in `src/lib/game/`. Phase 3.3 (GameMain shell) and 3.5 (ExplainerView) call these.

## Acceptance Criteria

1. `drawWord()` removes exactly one wordId from `gameState.hat` atomically (no two clients get same word).
2. Two concurrent `drawWord()` calls return different wordIds (race condition test via transaction retry).
3. `drawWord()` on empty hat returns `null`, does not modify hat.
4. `returnWord()` adds wordId back to hat atomically.
5. `returnWord()` is idempotent — calling twice with same wordId adds it only once.
6. `awardPoint(teamId)` increments `teams/{teamId}/roundScores/round{N}` by 1, where N = `gameState.round`.
7. `awardPoint(teamId)` increments `gameState.playerStats/{explainerId}/wordsExplained` by 1.
8. `applyPenalty(teamId)` decrements `roundScores` by 1 when `config.skipPenalty === true`.
9. `applyPenalty(teamId)` does nothing when `config.skipPenalty === false`.
10. `undoLastAction()` with `lastAction.type === 'guessed'`: decrements score for `scoredTeamId`, decrements `wordsExplained`, returns both `currentWordId` and `lastAction.wordId` to hat, sets `lastAction = null`.
11. `undoLastAction()` with `lastAction.type === 'skipped'`: reverses penalty if applied, returns `lastAction.wordId` to hat, sets `currentWordId` to `lastAction.wordId` (the undone word becomes current again), sets `lastAction = null`.
12. `undoLastAction()` when `lastAction` is null throws `UndoNotAvailableError`.

## Files I Will Touch

| File                                 | Reason                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/lib/game/hat.ts` (NEW)          | `drawWord()`, `returnWord()` — always via `runTransaction()`.                                     |
| `src/lib/game/scoring.ts` (NEW)      | `awardPoint()`, `applyPenalty()`, `undoLastAction()`.                                             |
| `src/lib/game/hat.test.ts` (NEW)     | Emulator tests for hat atomicity, emptiness, concurrent draws.                                    |
| `src/lib/game/scoring.test.ts` (NEW) | Emulator tests for score accumulation, penalty, undo reversals.                                   |
| `src/lib/db-types.ts` (MODIFY)       | Export `GamePhase` type for `gameState.phase` union. (Already defined inline, extract if needed.) |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/hat.ts

import type { Database } from "firebase/database"

/**
 * Atomically removes one random wordId from gameState.hat via transaction.
 * Writes drawn wordId to gameState.currentWordId.
 * Returns the drawn wordId, or null if hat was empty.
 * Must be called only by currentExplainerId's client.
 */
export async function drawWord(db: Database, roomId: string): Promise<string | null>

/**
 * Atomically adds wordId back to gameState.hat via transaction.
 * Idempotent — dup check within transaction ensures word added at most once.
 */
export async function returnWord(db: Database, roomId: string, wordId: string): Promise<void>
```

```typescript
// src/lib/game/scoring.ts

import type { Database } from "firebase/database"

export class UndoNotAvailableError extends Error {
  constructor()
}

/**
 * Increments team roundScores for current round +1.
 * Increments explainer's playerStats.wordsExplained +1.
 */
export async function awardPoint(
  db: Database,
  roomId: string,
  teamId: string,
  explainerId: string,
  currentRound: number,
): Promise<void>

/**
 * Decrements team roundScores for current round by 1.
 * No-op when skipPenalty is false.
 */
export async function applyPenalty(
  db: Database,
  roomId: string,
  teamId: string,
  skipPenalty: boolean,
  currentRound: number,
): Promise<void>

/**
 * Reverses last action (guessed or skipped).
 * Reads gameState.lastAction to determine what to undo.
 * Restores score, returns words to hat, clears lastAction.
 * Throws UndoNotAvailableError if lastAction is null.
 */
export async function undoLastAction(
  db: Database,
  roomId: string,
  currentRound: number,
  skipPenalty: boolean,
): Promise<void>
```

## Tests I Will Write First

```typescript
// src/lib/game/hat.test.ts

describe("drawWord", () => {
  // AC 1
  it("removes exactly one wordId from hat atomically")

  // AC 1
  it("writes drawn wordId to gameState.currentWordId")

  // AC 2
  it("two concurrent drawWord() calls return different wordIds")

  // AC 3
  it("drawWord() on empty hat returns null, hat unchanged")

  // edge
  it("drawWord() with hat of size 1: returns word, hat becomes empty")
})

describe("returnWord", () => {
  // AC 4
  it("adds wordId back to hat")

  // AC 5
  it("returnWord() is idempotent — calling twice adds wordId only once")

  // edge
  it("returnWord() on null currentWordId: no-op")
})
```

```typescript
// src/lib/game/scoring.test.ts

describe("awardPoint", () => {
  // AC 6
  it("increments team roundScores[currentRound] by 1")

  // AC 7
  it("increments playerStats/{explainerId}/wordsExplained by 1")

  // edge
  it("works for round 1, 2, 3 — writes to correct roundN key")
})

describe("applyPenalty", () => {
  // AC 8
  it("decrements roundScores by 1 when skipPenalty is true")

  // AC 9
  it("does nothing (no write) when skipPenalty is false")

  // edge
  it("score never goes below 0 (clamp at 0)")
})

describe("undoLastAction", () => {
  // AC 10
  it(
    "type=guessed: decrements score, decrements wordsExplained, returns both words to hat, clears lastAction",
  )

  // AC 11
  it("type=skipped: reverses penalty if applied, returns word to hat, sets currentWordId to undone word")

  // AC 12
  it("when lastAction is null: throws UndoNotAvailableError")

  // edge
  it("undo after score=0: score stays 0 (no negative score)")

  // edge
  it("undo twice: second call throws UndoNotAvailableError (lastAction already null)")
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only                          | Not applicable — no Svelte files. Pure `.ts` logic.                                                                                                                 |
| Decoupled Logic                              | `hat.ts` and `scoring.ts` in `src/lib/game/`. No component code, no Svelte imports. Pure Firebase write functions.                                                  |
| Firebase: Server Timestamp Is the Only Clock | Not applicable — no timestamps written. Scoring uses round number (integer), not time.                                                                              |
| Firebase: Hat Mutations Are Transactions     | `drawWord()` and `returnWord()` use `runTransaction()` on `gameState/hat` and `gameState/currentWordId`. No `set()` or `update()` on hat path.                      |
| Firebase: Disconnect Registration Order      | Not applicable — no disconnect handlers.                                                                                                                            |
| RTDB Is the Single Source of Truth           | Read hat/currentWordId inside transaction. Write back inside transaction. No local caching.                                                                         |
| Strict Typing                                | Return types explicit. Error class typed. No `any`. `unknown + type guard` for snapshot values inside transactions.                                                 |
| No Silent Failures                           | `drawWord()` returns null for empty hat (caller decides next action). `undoLastAction()` throws on null lastAction. No empty catch.                                 |
| Single Responsibility                        | `drawWord()` ≤ 30 lines. `returnWord()` ≤ 20 lines. `awardPoint()` ≤ 15 lines. `applyPenalty()` ≤ 15 lines. `undoLastAction()` ≤ 30 lines.                          |
| Test Before Implement                        | Tests first. Emulator needed for transaction testing. `firebase emulators:exec --only database 'vitest run src/lib/game/hat.test.ts src/lib/game/scoring.test.ts'`. |
| Styling                                      | Not applicable.                                                                                                                                                     |
| Accessibility                                | Not applicable.                                                                                                                                                     |
| Linting                                      | `npm run lint` after implementation.                                                                                                                                |

## Risks

1. **Transaction retry on concurrent draws:** Two clients call `drawWord()` simultaneously. RTDB transaction retries when data changes. Both eventually get different words (random index computed inside transaction with fresh hat state). Confirm via test with `Promise.all([drawWord(), drawWord()])`.
2. **`undoLastAction` reading stale `lastAction`:** If another client mutates `lastAction` between read and write, undo could operate on wrong action. Mitigation: reads `lastAction` + `currentWordId` from RTDB snapshot inside function. `lastAction` is only writable by `currentExplainerId`'s client (single writer per turn invariant). No race.
3. **Idempotent `returnWord` complexity:** Transaction must check if wordId already in hat before pushing. Adds ~3 lines but prevents double-add from rapid clicks. Test verifies.

## Conflicts Flagged

**CONFLICT: `undoLastAction()` writes to `gameState.currentWordId` without transaction.** Constraint says hat + currentWordId mutations must use `runTransaction()`. `undoLastAction` does:

- `set(gameState.currentWordId, lastAction.wordId)` — direct set.
- `returnWord(lastAction.wordId)` — transaction on hat.
- `set(gameState.lastAction, null)` — direct set.

CurrentWordId direct set is safe here because: only `currentExplainerId`'s client executes undo (single writer per turn invariant, admin can't undo). No concurrent writer exists for `currentWordId`. However, strict reading of constraint requires transaction. **Resolution: wrap undo operations in a single multi-path `runTransaction()` that reads hat + currentWordId + lastAction atomically, writes all three back. This satisfies constraint without adding complexity (transaction reads the snapshot, function decides mutations, writes back).**

```typescript
// Inside undoLastAction — transaction approach:
await runTransaction(db, ref(db, `rooms/${roomId}/gameState`), (gsSnapshot) => {
  const gs = gsSnapshot.val() as GameState
  if (gs.lastAction === null) throw new UndoNotAvailableError()
  // ... compute hat mutation, score rollback
  return { ...gs, hat: newHat, currentWordId: restoredWordId, lastAction: null }
})
```

This approach is cleaner — single atomic write. Use it.
