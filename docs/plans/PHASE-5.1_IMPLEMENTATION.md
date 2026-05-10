# Phase 5.1 — Pause/Resume Game Logic

## Definition

Pure game-logic functions for pausing and resuming the timer. `pauseGame()` captures the current timer state via `serverTimestamp()`. `resumeGame()` restores the timer by computing a synthetic `timerStartedAt` that preserves the remaining time at pause. Neither function touches UI — they are callable from admin controls and from the auto-pause trigger on explainer disconnect (Phase 5.3).

**Why split here:** Pause/resume is the foundation. All other Phase 5 features (admin controls, disconnect auto-pause) depend on these two functions. Isolating them in one file avoids coupling the UI to the timer math and keeps us under the 200-line limit.

**Constraint conflict flagged:** The original plan says `resumeGame()` should write `timerStartedAt = serverTimestamp() - (timerDuration - timeRemainingAtPause)`. `serverTimestamp()` is a sentinel that resolves on the server — arithmetic with it is impossible. **Resolved:** The plan in this document uses an application-level computed offset as a plain number. See `Constraints I Am Applying`.

## Acceptance Criteria I Am Using

1. `pauseGame()` writes `pausedAt: serverTimestamp()` and `timeRemainingAtPause` within 200 ms of the true remaining time at call time
2. `pauseGame()` throws typed error if timer is not running (`timerStartedAt === null` or `pausedAt !== null`)
3. `pauseGame()` throws typed error if `phase` is not `'explaining'` or `'post_expiry'`
4. `resumeGame()` clears `pausedAt` and `timeRemainingAtPause`
5. `resumeGame()` sets `timerStartedAt` to a server timestamp computed so that `getTimeRemaining(newTimerStartedAt, duration, null, null) ≈ oldTimeRemainingAtPause` (±200ms)
6. Pause → wait N seconds → resume: `getTimeRemaining()` after resume equals pre-pause value within server timestamp latency tolerance (±200ms)
7. `resumeGame()` throws typed error if game is not currently paused (`pausedAt === null`)
8. Both functions are admin-only — caller must be in `/admins/{uid}` OR be room creator

## Files I Will Touch

| File                              | Reason                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/lib/game/turn-pause.ts`      | NEW — `pauseGame()`, `resumeGame()`, error classes                                                      |
| `src/lib/game/turn-pause.test.ts` | NEW — 12 tests (pause success, resume success, pause→resume roundtrip, guard errors, permission errors) |
| `src/lib/db-types.ts`             | MODIFY — ensure `pausedAt`, `timeRemainingAtPause` exist in `GameState` (already present; verify only)  |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/turn-pause.ts

export class PauseNotAvailableError extends Error {
  constructor(public reason: string)
}

export class ResumeNotAvailableError extends Error {
  constructor(public reason: string)
}

/**
 * Freezes the timer.
 * Writes pausedAt (serverTimestamp) and computes + writes timeRemainingAtPause.
 * Throws PauseNotAvailableError if timer not started, already paused, or phase not explaining/post_expiry.
 */
export async function pauseGame(
  db: Database,
  roomId: string,
  callerUid: string,
): Promise<void>

/**
 * Restores the timer from pause.
 * Computes synthetic timerStartedAt = now - (timerDuration - timeRemainingAtPause)
 * and writes it as a plain number (not serverTimestamp — arithmetic required).
 * Clears pausedAt and timeRemainingAtPause (writes null).
 * Throws ResumeNotAvailableError if not currently paused.
 */
export async function resumeGame(
  db: Database,
  roomId: string,
  callerUid: string,
): Promise<void>
```

**Design note on `resumeGame()`:** The original implementation plan suggests `serverTimestamp() - offset`. That is not possible — `serverTimestamp()` is a sentinel token, not a number. The correct approach: read `ServerValue.TIMESTAMP` to get the actual resolved millisecond value (or use `Date.now()` on the client with the understanding that 200ms client-server drift is acceptable for a 60-second timer). The test tolerance of ±200ms accounts for this. We use `Date.now()` on the client for arithmetic, which is consistent with how `getTimeRemaining()` already uses `Date.now()`.

## Tests I Will Write First

```typescript
// src/lib/game/turn-pause.test.ts

describe("pauseGame", () => {
  it("writes pausedAt as server timestamp when timer is running")
  // AC 1
  it("writes timeRemainingAtPause within 200ms of expected remaining")
  // AC 1
  it("throws PauseNotAvailableError when timerStartedAt is null")
  // AC 2
  it("throws PauseNotAvailableError when already paused")
  // AC 2
  it("throws PauseNotAvailableError when phase is 'waiting_start'")
  // AC 3
  it("throws PauseNotAvailableError when phase is 'post_turn'")
  // AC 3
  it("throws PauseNotAvailableError when phase is 'round_end'")
  // AC 3
  it("throws permission-denied when caller is not admin and not room creator")
  // AC 8
})

describe("resumeGame", () => {
  it("clears pausedAt and timeRemainingAtPause")
  // AC 4
  it("sets timerStartedAt such that getTimeRemaining() ≈ timeRemainingAtPause")
  // AC 5
  it("throws ResumeNotAvailableError when not paused")
  // AC 7
  it("pause → resume roundtrip: getTimeRemaining unchanged within 200ms")
  // AC 6
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server Timestamp Is the Only Clock           | `pauseGame()` writes `pausedAt` with `serverTimestamp()`. `timeRemainingAtPause` is a computed delta (plain number) — allowed per CROSS_CUTTING_CONSTRAINTS.md invariant #2 |
| Decoupled Logic                              | All logic in `.ts` file. Components will import and call these functions                                                                                                    |
| Strict Typing                                | `PauseNotAvailableError`, `ResumeNotAvailableError` have typed `reason` fields. No `any`                                                                                    |
| Single Responsibility                        | `turn-pause.ts` does only pause/resume. Separate from turn orchestration, disconnect handling                                                                               |
| Test Before Implement                        | Tests written first, run against emulator                                                                                                                                   |
| Firebase: Server Timestamp Is the Only Clock | `pausedAt` uses `serverTimestamp()`. `resumeGame()` uses `Date.now()` for client-side arithmetic (same pattern as `getTimeRemaining()`)                                     |
| Admin-only writes                            | Both functions verify caller is admin or room creator before writing                                                                                                        |

## Risks

1. **Client-server clock drift.** `resumeGame()` computes the synthetic `timerStartedAt` using `Date.now()`. If the client clock is >200ms off from the server, the resumed timer will differ from the pre-pause value. Mitigation: ±200ms tolerance in tests; acceptable for a 60-second party-game timer
2. **Race: admin pauses while timer expiry fires.** If `handleTimerExpiry()` (Phase 3.4) writes `phase: 'post_turn'` between the admin clicking Pause and the `pauseGame()` write, the phase guard will reject the pause. Mitigation: UI disables Pause button when `phase !== 'explaining'` and `phase !== 'post_expiry'` — observer sees the transition and button disappears
3. **`turn.ts` line budget.** `turn.ts` is already 189 lines. Adding pause/resume there would exceed the 200-line limit. Creating `turn-pause.ts` avoids violating the Single Responsibility constraint
