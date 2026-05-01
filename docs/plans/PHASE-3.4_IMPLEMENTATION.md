# Phase 3.4 — Turn Orchestration & Timer Expiry Handler

## Definition

Orchestration layer that ties hat, scoring, and timer together. `advanceTurn()` progresses to next explainer/team round-robin. `handleTimerExpiry()` reads timer state + word-displayed duration, writes correct next phase. `endTurnEarly()` handles hat-empty-during-turn edge case.

All functions are called from Phase 3.5 (ExplainerView) or from a timer-expiry `$effect` in GameMain. No direct UI — pure orchestration logic importing Phase 3.1 (timer), 3.2 (hat, scoring).

## Acceptance Criteria

1. `advanceTurn()` increments `currentPlayerIndex` mod `playerOrder.length` for current team.
2. `advanceTurn()` cycles teams in round-robin: team A → B → C → A.
3. `advanceTurn()` correctly resolves `currentExplainerId` from new `currentTeamId` + `currentPlayerIndex`.
4. `advanceTurn()` writes `phase: 'waiting_start'`, `currentWordId: null`, `lastAction: null`, `wordsGuessedThisTurn: 0`.
5. `advanceTurn()` after hat empty: writes `phase: 'round_end'` instead of `'waiting_start'`. Does NOT reset turn order.
6. `handleTimerExpiry()` reads `getTimeRemaining(...)`. When `<= 0` and `phase === 'explaining'`:
   - If `Date.now() - wordDisplayedAt > 2000`: write `phase: 'post_expiry'`.
   - If `Date.now() - wordDisplayedAt <= 2000` or `currentWordId === null`: write `phase: 'post_turn'`, `currentWordId: null`.
7. `handleTimerExpiry()` does nothing when `phase !== 'explaining'` or timer not started.
8. `endTurnEarly()` writes `phase: 'post_turn'`, `currentWordId: null`. Called when hat empties mid-turn (explainer presses Guessed on last word, hat becomes empty → immediate post_turn).
9. `endTurnEarly()` does NOT trigger `post_expiry` — hat empty skips the post-expiry decision phase entirely.
10. All phase transitions match the state machine in CROSS_CUTTING_CONSTRAINTS.md.

## Files I Will Touch

| File                                 | Reason                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/lib/game/turn.ts` (MODIFY)      | Add `advanceTurn()`, `handleTimerExpiry()`, `endTurnEarly()`. Already has `initializeGameState()`. |
| `src/lib/game/turn.test.ts` (MODIFY) | Add tests for new functions. Emulator needed for `advanceTurn` (reads/writes gameState).           |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/turn.ts — new exports

import type { Database } from "firebase/database"

/**
 * Advances to next explainer in team, or next team if team exhausted.
 * Writes: phase, currentTeamId, currentExplainerId, currentPlayerIndex,
 *        currentWordId=null, lastAction=null, wordsGuessedThisTurn=0.
 *
 * If hat.length === 0 after advance, writes phase: 'round_end' instead of 'waiting_start'.
 * Reads teams/{teamId}/playerOrder and teams/{teamId}/currentPlayerIndex from RTDB.
 */
export async function advanceTurn(db: Database, roomId: string): Promise<void>

/**
 * Checks timer state and current word display duration.
 * Called periodically (every 100ms timer tick in GameMain) or on timer expiry.
 *
 * When getTimeRemaining() <= 0 and phase === 'explaining':
 *   - wordDisplayedAt is tracked client-side (not in RTDB).
 *   - If Date.now() - wordDisplayedAt > 2000: write phase 'post_expiry'.
 *   - If <= 2000ms or currentWordId is null: write phase 'post_turn', currentWordId=null.
 *
 * Does nothing when phase !== 'explaining' or timer not started.
 *
 * NOTE: wordDisplayedAt is a local variable tracked by the explainer's client.
 * This function receives it as parameter.
 */
export async function handleTimerExpiry(
  db: Database,
  roomId: string,
  timerStartedAt: number | null,
  timerDuration: number,
  pausedAt: number | null,
  timeRemainingAtPause: number | null,
  currentWordId: string | null,
  wordDisplayedAt: number | null,
): Promise<void>

/**
 * Ends turn immediately when hat is empty mid-turn.
 * Writes phase: 'post_turn', currentWordId: null.
 * Does NOT trigger post_expiry — hat empty skips decision phase.
 */
export async function endTurnEarly(db: Database, roomId: string): Promise<void>
```

## Tests I Will Write First

```typescript
// src/lib/game/turn.test.ts — additions

describe("advanceTurn", () => {
  // AC 1
  it("increments currentPlayerIndex, wraps at playerOrder.length")

  // AC 2
  it("cycles teams round-robin: team A → B → C → A")

  // AC 3
  it("correctly resolves currentExplainerId from new index")

  // AC 4
  it("writes phase='waiting_start', currentWordId=null, lastAction=null, wordsGuessedThisTurn=0")

  // AC 5
  it(
    "after hat empty: writes phase='round_end', preserves turn order (currentTeamId, currentPlayerIndex unchanged)",
  )

  // edge
  it("team with 1 player: currentPlayerIndex stays 0 (wraps to self)")
})

describe("handleTimerExpiry", () => {
  // AC 6a
  it("when timeRemaining<=0, wordDisplayed >2s: writes phase='post_expiry'")

  // AC 6b
  it("when timeRemaining<=0, wordDisplayed <=2s: writes phase='post_turn', currentWordId=null")

  // AC 6b variant
  it("when timeRemaining<=0, currentWordId is null: writes phase='post_turn'")

  // AC 7
  it("when phase !== 'explaining': does nothing")

  // edge
  it("when timerStartedAt is null (timer not started): does nothing")

  // edge
  it("when pausedAt is not null (timer paused): does nothing")
})

describe("endTurnEarly", () => {
  // AC 8
  it("writes phase='post_turn', currentWordId=null")

  // AC 9
  it("does not transition to post_expiry — direct to post_turn")
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Svelte 5 Runes Only                          | Not applicable — pure `.ts`.                                                                                                                                    |
| Decoupled Logic                              | `turn.ts` in `src/lib/game/`. Called from components (GameMain `$effect`, ExplainerView handlers). No component code in turn.ts.                                |
| Firebase: Server Timestamp Is the Only Clock | `handleTimerExpiry()` uses `getTimeRemaining()` (Phase 3.1) which compares serverTimestamp against `Date.now()`. No `Date.now()` stored in RTDB.                |
| Firebase: Hat Mutations Are Transactions     | `advanceTurn()` does NOT touch hat — only phase/turn metadata. `endTurnEarly()` does NOT touch hat. Hat is mutated by `drawWord()`/`returnWord()` in Phase 3.2. |
| Firebase: Disconnect Registration Order      | Not applicable.                                                                                                                                                 |
| RTDB Is the Single Source of Truth           | All state read from RTDB (teams/playerOrder, gameState). Writes back to RTDB directly. No local caching.                                                        |
| Strict Typing                                | All parameters typed. `wordDisplayedAt` is `number                                                                                                              | null`(epoch ms). No`any`. |
| No Silent Failures                           | `handleTimerExpiry()` returns early on invalid state (wrong phase, no timer). Does NOT silently eat errors.                                                     |
| Single Responsibility                        | Each function ≤ 30 lines. Separation: `advanceTurn` = turn progression. `handleTimerExpiry` = expiry decision. `endTurnEarly` = hat-empty shortcut.             |
| Test Before Implement                        | Add tests to `turn.test.ts` first. Emulator needed (reads/writes gameState).                                                                                    |
| Linting                                      | `npm run lint` after implementation.                                                                                                                            |

## Risks

1. **`wordDisplayedAt` is client-local, not in RTDB:** Two clients (explainer + observer) have different `wordDisplayedAt` values. Only explainer's client calls `handleTimerExpiry()` because only explainer writes phase transitions. **No race — single writer per turn invariant.** But if explainer's tab loses focus, `wordDisplayedAt` is still correct (Date.now() keeps ticking). Not a risk.
2. **Timer expiry edge: word displayed exactly at 2000ms boundary.** Flaky equality check. Use `> 2000` threshold, not `>=`. Consistent with PRD ">2 seconds". Test covers boundary.
3. **`advanceTurn()` after hat empty still called by PostTurn "next" button.** PostTurn must check `gameState.phase === 'round_end'` and render RoundEnd instead of auto-advancing. Phase 3.3 PostTurn handles this. Coordination risk low — both read same `phase` field.

## Conflicts Flagged

**CONFLICT: `wordDisplayedAt` tracking location.** Implementation plan says "wordDisplayedAt: local `Date.now()` recorded when `currentWordId` changes. Not stored in RTDB." This is correct for single-writer case (only explainer's client needs it). But observers never know when word was displayed. Not needed for observers — only explainer's client calls `handleTimerExpiry()`. Accept.

**CONFLICT: `accidentally advancing timer expiry from observer client`.** If GameMain runs timer expiry `$effect` on all clients, observers would incorrectly trigger phase transitions. **Resolution: wrap `handleTimerExpiry()` call in `if (playerId === gameState.currentExplainerId)`. Only explainer's client checks expiry and writes phase. Document in `GameMain.svelte` `$effect`.**
