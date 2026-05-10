# Phase 5.2 — Reassign Explainer Logic

## Definition

`reassignExplainer()` updates `currentExplainerId` and `currentPlayerIndex` to point at a different player within the same team. Only callable when the game is paused (`pausedAt !== null`) and by admin/creator. This is the backend function — the admin UI picker is Phase 5.3.

**Why split here:** Reassign means mutating `currentExplainerId` and `currentPlayerIndex` atomically. These fields are shared with `advanceTurn()` (Phase 3.4). Separating reassign avoids coupling pause/resume (5.1) with the admin controls UI (5.3) and keeps each file under 200 lines.

**Missing from original plan:** The original plan does not specify that reassign must validate `pausedAt !== null`. PRD says "Change explainer — only available when timer is paused." This plan enforces that.

## Acceptance Criteria I Am Using

1. `reassignExplainer(newPlayerId)` updates `currentExplainerId` to `newPlayerId` and `currentPlayerIndex` to the matching index in `currentTeam.playerOrder`
2. `reassignExplainer()` throws `ExplainerNotInTeamError` if `newPlayerId` is not in `currentTeam.playerOrder`
3. `reassignExplainer()` throws `PauseRequiredError` if `pausedAt === null`
4. `reassignExplainer()` throws permission error if caller is not admin and not room creator
5. `reassignExplainer()` is idempotent — calling twice with same `newPlayerId` does not corrupt state
6. After reassign, `currentExplainerId` and `currentPlayerIndex` are consistent (index points at the same playerId)

## Files I Will Touch

| File                                 | Reason                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/lib/game/turn-reassign.ts`      | NEW — `reassignExplainer()`, error classes                                           |
| `src/lib/game/turn-reassign.test.ts` | NEW — 7 tests                                                                        |
| `src/lib/db-types.ts`                | VERIFY — no changes needed; `currentExplainerId`, `currentPlayerIndex` already exist |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/turn-reassign.ts

export class ExplainerNotInTeamError extends Error {
  constructor(public playerId: string, public teamId: string)
}

export class PauseRequiredError extends Error {
  constructor()
}

/**
 * Reassigns the explainer to a different player within the current team.
 * Only callable when game is paused AND caller is admin or room creator.
 * Reads currentTeamId, currentTeam.playerOrder from RTDB.
 * Writes currentExplainerId and currentPlayerIndex atomically via update().
 */
export async function reassignExplainer(
  db: Database,
  roomId: string,
  newPlayerId: string,
  callerUid: string,
): Promise<void>
```

## Tests I Will Write First

```typescript
// src/lib/game/turn-reassign.test.ts

describe("reassignExplainer", () => {
  it("updates currentExplainerId and currentPlayerIndex to new player in same team")
  // AC 1, 6
  it("throws ExplainerNotInTeamError when newPlayerId not in currentTeam.playerOrder")
  // AC 2
  it("throws PauseRequiredError when game is not paused")
  // AC 3
  it("throws permission error when caller is not admin/creator")
  // AC 4
  it("is idempotent — calling twice with same playerId leaves state unchanged")
  // AC 5
  it("maintains consistency: currentPlayerIndex resolves to currentExplainerId after reassign")
  // AC 6
  it("works when reassigning to player at index 0 (edge: first in order)")
  // AC 1
})
```

## Constraints I Am Applying

| Constraint                               | How Applied                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase: Hat Mutations Are Transactions | Not applicable — reassign writes `currentExplainerId` + `currentPlayerIndex` only. Uses `update()` (atomic multi-path write)                             |
| Decoupled Logic                          | Pure `.ts` function, callable from admin UI (5.3) and disconnect handler (5.4)                                                                           |
| Strict Typing                            | `ExplainerNotInTeamError`, `PauseRequiredError` have typed fields                                                                                        |
| Single Responsibility                    | One file, one function. No side effects beyond the targeted RTDB write                                                                                   |
| Single Writer Per Turn                   | `currentExplainerId` is listed as an admin-write exception in CROSS_CUTTING_CONSTRAINTS.md invariant #7. This function enforces admin-only + paused-only |
| Admin-only writes                        | Validates caller is admin or room creator                                                                                                                |

## Risks

1. **Consistency gap with `advanceTurn()`.** `advanceTurn()` also writes `currentExplainerId` and `currentPlayerIndex`. If `advanceTurn()` changes format or adds fields, `reassignExplainer()` becomes stale. Mitigation: both functions share the same RTDB paths; `advanceTurn()` already exists and its contract is stable
2. **Pause check race.** Admin clicks "Change Explainer" while another admin clicks "Resume". The `pausedAt` check in `reassignExplainer()` reads-then-writes — possible TOCTOU. Mitigation: acceptable for MVP; two admins simultaneously clicking conflicting buttons is not a realistic scenario for a 5–15 person party game
3. **`currentPlayerIndex` off-by-one mapping.** `playerOrder` is a shuffled array. Index lookup must be exact. Mitigation: test AC 6 covers the consistency invariant explicitly
