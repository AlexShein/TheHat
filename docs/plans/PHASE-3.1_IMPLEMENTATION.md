# Phase 3.1 — Timer Engine & gameState Subscription

## Definition

Foundation layer for entire game turn. `getTimeRemaining()` pure function — no Firebase, no side effects. `gameState` store subscribes to RTDB `gameState` node, provides reactive state to all Phase 3 components. `Timer.svelte` renders MM:SS from store, goes red at <10s, has `aria-live="polite"`.

All other Phase 3 sub-phases depend on this store and timer.

## Acceptance Criteria

1. `getTimeRemaining()` returns `timerDuration` when `timerStartedAt === null` (timer not started).
2. `getTimeRemaining()` returns correct remaining ms for known `Date.now() - timerStartedAt` offset.
3. `getTimeRemaining()` returns `timeRemainingAtPause` when `pausedAt !== null` (timer frozen). Ignores real clock.
4. `getTimeRemaining()` clamps to 0, never returns negative.
5. Pause → resume: `getTimeRemaining()` after resume ≈ `timeRemainingAtPause` before resume (±100ms tolerance at function level — real tolerance tested in Phase 5).
6. `gameState` store subscribes to `/rooms/{roomId}/gameState` once, updates reactively on RTDB changes.
7. Store exposes `$state` fields: `round`, `phase`, `currentTeamId`, `currentExplainerId`, `timerStartedAt`, `timerDuration`, `hat`, `currentWordId`, `lastAction`, `playerStats`, `pausedAt`, `timeRemainingAtPause`.
8. Store unsubscribes on component destroy (no memory leak).
9. `Timer.svelte` displays `MM:SS` format. Text color red when `timeRemaining < 10000` ms.
10. Timer has `aria-live="polite"` for screen reader updates.
11. All touch targets in Timer ≥ 44px.
12. Timer updates every 100ms via `$effect` with `setInterval`, calls `getTimeRemaining()` each tick.

## Files I Will Touch

| File                                           | Reason                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `src/lib/game/timer.ts` (NEW)                  | `getTimeRemaining()` pure function. Zero Firebase deps.          |
| `src/lib/game/timer.test.ts` (NEW)             | Unit tests for all timer math edge cases. No emulator needed.    |
| `src/lib/stores/gameState.svelte.ts` (NEW)     | RTDB subscription to `gameState` node. Reactive `$state` fields. |
| `src/lib/components/shared/Timer.svelte` (NEW) | MM:SS display component. Red <10s. aria-live.                    |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/timer.ts

/**
 * Pure function. Computes remaining time in milliseconds.
 * When pausedAt is not null, returns timeRemainingAtPause (frozen).
 * When timerStartedAt is null, returns timerDuration (not started).
 * Otherwise: timerDuration - (Date.now() - timerStartedAt), clamped to 0.
 * All timestamps are serverTimestamp values (millis since epoch).
 */
export function getTimeRemaining(
  timerStartedAt: number | null,
  timerDuration: number,
  pausedAt: number | null,
  timeRemainingAtPause: number | null,
): number
```

```typescript
// src/lib/stores/gameState.svelte.ts

import type { GameState } from "$lib/db-types"
import type { Database } from "firebase/database"

export interface GameStateStore {
  readonly round: number
  readonly phase: GameState["phase"]
  readonly currentTeamId: string
  readonly currentExplainerId: string
  readonly timerStartedAt: number | null
  readonly timerDuration: number
  readonly hat: string[]
  readonly currentWordId: string | null
  readonly lastAction: GameState["lastAction"]
  readonly playerStats: GameState["playerStats"]
  readonly pausedAt: number | null
  readonly timeRemainingAtPause: number | null
}

export function createGameStateStore(db: Database, roomId: string): GameStateStore
```

```typescript
// src/lib/components/shared/Timer.svelte

<script lang="ts">
  let {
    timeRemainingMs: number
  }: { timeRemainingMs: number } = $props()
</script>
```

## Tests I Will Write First

```typescript
// src/lib/game/timer.test.ts

describe("getTimeRemaining", () => {
  // AC 1
  it("returns timerDuration when timerStartedAt is null")

  // AC 2
  it("returns correct remaining for known timerStartedAt offset")

  // AC 2 — edge
  it("returns 0 when elapsed time exceeds timerDuration")

  // AC 3
  it("returns timeRemainingAtPause when pausedAt is not null")

  // AC 3 — frozen regardless of real clock
  it("paused timer returns same value after 5 seconds (mock Date.now)")

  // AC 4
  it("clamps to 0, never returns negative")

  // AC 5
  it("resume: when pausedAt=null again, computes from timerStartedAt minus offset")

  // edge
  it("timerDuration of 0 returns 0 immediately when timerStartedAt is set")

  // edge
  it("handles very large timerDuration without overflow")
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only                          | `gameState` store uses `$state`. No `$:` or `writable()`. `Timer.svelte` uses `$props`.                                                                                          |
| Decoupled Logic                              | `getTimeRemaining()` in `timer.ts` — no Firebase, no side effects. `gameState.svelte.ts` does RTDB sub but no business logic. `Timer.svelte` pure render.                        |
| Firebase: Server Timestamp Is the Only Clock | `getTimeRemaining()` compares `timerStartedAt` (serverTimestamp) against `Date.now()`. Correct: server time is reference, client computes delta. No `Date.now()` stored in RTDB. |
| Firebase: Hat Mutations Are Transactions     | Not applicable — this sub-phase reads `gameState`, does not write to hat.                                                                                                        |
| Firebase: Disconnect Registration Order      | Not applicable — no disconnect handlers.                                                                                                                                         |
| RTDB Is the Single Source of Truth           | `gameState` store is sole reactive source. No `localStorage`, no component state duplication.                                                                                    |
| Strict Typing                                | All function signatures typed. `GameStateStore` interface matches `GameState` from `db-types.ts`. No `any`.                                                                      |
| No Silent Failures                           | Store subscription errors surface via typed error state. No empty `catch`.                                                                                                       |
| Single Responsibility                        | `getTimeRemaining` — one function, one file, ≤ 20 lines. `createGameStateStore` ≤ 40 lines. `Timer.svelte` ≤ 50 lines.                                                           |
| Test Before Implement                        | Write `timer.test.ts` first. All pure-unit (no emulator). Implement until green.                                                                                                 |
| Styling                                      | Tailwind utility classes. Timer text ≥ 44px touch target. No inline `style=`.                                                                                                    |
| Accessibility                                | `Timer.svelte`: `aria-live="polite"` on time display. Color change paired with text change (seconds visible).                                                                    |
| Linting                                      | `npm run lint` after implementation, zero warnings.                                                                                                                              |

## Risks

1. **Clock drift with client `Date.now()`:** `getTimeRemaining()` uses `Date.now() - timerStartedAt`. If client clock is ahead/behind server, timer appears wrong. Mitigation: server sets `timerStartedAt` via `serverTimestamp()`; client only computes delta. Drift ≤1s per person (acceptable for party game). Real sync tested in Phase 3.4 (multi-tab).
2. **Store subscription lag:** RTDB `onValue` fires on change. 100ms setInterval polling for timer display adds ≤100ms visual jitter. Acceptable — no game logic depends on this poll; phase transitions use RTDB writes.
3. **Memory leak if store not destroyed:** `createGameStateStore` returns unsubscribe function. Svelte `$effect` cleanup must call it. Forgot → listener persists across navigation. Test: verify with `onDestroy`.

## Conflicts Flagged

None. This sub-phase only reads `gameState`, no writes. All constraints satisfied.
