# Phase 5.3 — Admin Controls UI, Disconnect Overlay & Auto-Pause Detection

## Definition

Two UI components and the reactive detection logic that binds them to game state:

1. **`AdminControls.svelte`** — visible only to admin. Contains Pause/Resume toggle button and Change Explainer picker (list of `currentTeam.playerOrder` names). Picker visible only when game is paused. Calls `pauseGame()` / `resumeGame()` (5.1) and `reassignExplainer()` (5.2).

2. **`DisconnectOverlay.svelte`** — full-screen overlay shown when `players[currentExplainerId].connected === false` AND `phase === 'explaining'`. Content: "Explainer disconnected — game paused." Admin sees "Reassign Explainer" button that opens the Change Explainer picker inline. Non-admin sees "Waiting for admin to reassign…"

3. **Reactive detection in `+page.svelte`** — `$effect` watches `players[currentExplainerId].connected`. When it transitions `true → false` during `phase === 'explaining'`, calls `pauseGame()`. This is the auto-pause trigger.

4. **Team < 2 detection** — same `$effect` block watches connected player counts per team. When a team falls below 2 connected players during gameplay, calls `pauseGame()` and shows a warning overlay with "Continue anyway" button (admin only). The "Continue anyway" calls `resumeGame()`.

**Why split here:** This is the UI layer. Phases 5.1 and 5.2 provide the pure functions; this phase wires them to reactive state and renders components. Separating UI from logic follows the Decoupled Logic constraint.

**Missing from original plan:** The original plan says "Team < 2 connected players: auto-write pausedAt, show warning overlay with 'Continue anyway' button" but doesn't specify WHERE the detection lives. This plan puts it in `+page.svelte` because it needs both `players` store (connected state) and `gameState` store (phase, currentExplainerId) and must call `pauseGame()` — all of which are available at the page level.

## Acceptance Criteria I Am Using

### AdminControls

1. Admin sees Pause button when `phase === 'explaining'` or `'post_expiry'` and `pausedAt === null`
2. Admin sees Resume button when `pausedAt !== null`
3. Change Explainer picker is disabled (not hidden) when `pausedAt === null`. Lists all players from `currentTeam.playerOrder`
4. Selecting a player from the picker calls `reassignExplainer()` and shows success/error feedback
5. Non-admin sees nothing — `AdminControls` renders empty

### DisconnectOverlay

6. Overlay appears on all clients when `players[currentExplainerId].connected === false` AND `phase === 'explaining'`
7. Overlay shows "Reassign Explainer" button for admin; "Waiting for admin…" for non-admin
8. Overlay disappears when `currentExplainerId` changes (admin reassigned) or explainer reconnects
9. Overlay does NOT appear when `phase !== 'explaining'` (even if explainer disconnected)

### Auto-Pause on Explainer Disconnect

10. When `players[currentExplainerId].connected` transitions `true → false` and `phase === 'explaining'` and `pausedAt === null`, `pauseGame()` is called automatically
11. Auto-pause does NOT fire if game is already paused
12. Auto-pause does NOT fire if `phase` is not `'explaining'` or `'post_expiry'`

### Team < 2 Connected Players

13. When any team's connected player count drops below 2 during gameplay (`status === 'playing'`), game auto-pauses via `pauseGame()`
14. Warning overlay shows for all players: "Team X has only 1 player connected"
15. Admin sees "Continue anyway" button that calls `resumeGame()`
16. Team < 2 check is bypassed when `VITE_DEV_BYPASS_MIN_PLAYERS === 'true'`

## Files I Will Touch

| File                                                 | Reason                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/lib/components/shared/AdminControls.svelte`     | NEW — Pause/Resume toggle, Change Explainer picker                                              |
| `src/lib/components/shared/DisconnectOverlay.svelte` | NEW — disconnect notification + admin reassign shortcut                                         |
| `src/routes/room/[roomId]/+page.svelte`              | MODIFY — add auto-pause $effect, team-count detection, render AdminControls + DisconnectOverlay |
| `src/lib/components/phases/GameMain.svelte`          | MODIFY — pass admin/disconnect props through to new components (or render them at page level)   |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/components/shared/AdminControls.svelte — component props
interface AdminControlsProps {
  db: Database
  roomId: string
  callerUid: string
  phase: GameState["phase"]
  pausedAt: number | null
  currentTeamId: string
  currentExplainerId: string
  teamPlayerOrder: string[] // currentTeam.playerOrder
  playerNames: Record<string, string> // playerId → display name
}

// src/lib/components/shared/DisconnectOverlay.svelte — component props
interface DisconnectOverlayProps {
  isAdmin: boolean
  explainerName: string
  currentTeamId: string
  teamPlayerOrder: string[]
  playerNames: Record<string, string>
  onReassign: (newPlayerId: string) => Promise<void>
}

// No new TypeScript exports — detection logic lives in page-level $effect, not a separate module
```

**Detection logic location:** `+page.svelte` `$effect` block, not a separate `.ts` file. Reason: it reads from 3 stores simultaneously (`roomStore.status`, `playersStore.players`, `gameStateStore.phase`/`currentExplainerId`/`pausedAt`) and calls `pauseGame()`. Extracting it would require passing stores as arguments (violates "don't pass stores around") or creating a store-composition helper (over-engineering for a single $effect). The effect is ≤30 lines. This is consistent with how `+page.svelte` already orchestrates store subscriptions.

**Constraint check:** The Decoupled Logic constraint says "Business logic lives in `.ts` or `.svelte.ts` files. `.svelte` files contain only declarative UI." The auto-pause detection is a side effect that binds store state to a Firebase write — it's orchestration, not business logic. The business logic (`pauseGame`, `resumeGame`, `reassignExplainer`) lives in `.ts` files. The `$effect` is thin glue. This is acceptable per the constraint's spirit (separation of concerns: logic is testable, UI is declarative).

## Tests I Will Write First

```typescript
// No new unit-test file — detection logic is a page-level $effect.
// Testing strategy: manual test AC items during Phase 5.3 review.
// Regression: existing turn-pause.test.ts (5.1) and turn-reassign.test.ts (5.2)
// cover the functions called by the effect.

// If extraction to a testable module becomes necessary during implementation,
// create: src/lib/game/disconnect-detection.ts with:
//   shouldAutoPauseOnExplainerDisconnect(wasConnected, isConnected, phase, pausedAt): boolean
//   shouldAutoPauseOnTeamDrop(teamConnectedCounts, phase, pausedAt): boolean
// Then test those pure functions.
// Decision: defer extraction until component wiring proves it's needed.
```

**Note on test strategy:** The auto-pause detection is reactive glue — testing it requires either component tests (vitest + jsdom + svelte testing library) or emulator integration tests. Neither is established in this project's test suite. The functions it calls (`pauseGame`, `resumeGame`) are already tested in 5.1. Manual verification of AC items 10–16 is the pragmatic approach for this sub-phase.

## Constraints I Am Applying

| Constraint                         | How Applied                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decoupled Logic                    | `AdminControls.svelte` calls functions from `turn-pause.ts` and `turn-reassign.ts` — no Firebase logic in the component                                            |
| Styling                            | Tailwind. Touch targets ≥44px. No `style=` attributes. No hover-only interactions                                                                                  |
| Accessibility Minimum              | Pause/Resume button has `aria-label`. Change Explainer picker is a `<select>` with visible `<label>`. DisconnectOverlay has `role="alertdialog"` with `aria-label` |
| Single Responsibility              | `AdminControls.svelte` = admin actions only. `DisconnectOverlay.svelte` = disconnect notification only. Detection $effect in page = glue. Each ≤100 lines          |
| RTDB Is the Single Source of Truth | All state read from stores. No localStorage, no component-local duplicates of `connected`                                                                          |
| Strict Typing                      | Component props explicitly typed inline. No `any`                                                                                                                  |
| No Silent Failures                 | Errors from `pauseGame()`/`resumeGame()`/`reassignExplainer()` surfaced as toast or inline error text in AdminControls                                             |
| VITE_DEV_BYPASS_MIN_PLAYERS        | Checked in team < 2 detection. Does not propagate elsewhere                                                                                                        |

## Risks

1. **Detection $effect in `+page.svelte` grows unwieldy.** If the effect exceeds 30 lines, violates Single Responsibility. Mitigation: extract pure predicate functions (`shouldAutoPause*`) to a `.ts` file during implementation if needed — the plan explicitly allows this
2. **DisconnectOverlay flash.** If `players[currentExplainerId].connected` flickers `false → true → false` (network hiccup), overlay flashes. Mitigation: consider a 2-second debounce on the disconnect detection. Not included in initial plan — will add if manual testing reveals it's needed
3. **Two auto-pause triggers fire simultaneously.** Explainer disconnect AND team < 2 could both trigger `pauseGame()` in the same tick. Mitigation: `pauseGame()` is idempotent (throws if already paused) — the second call will be a no-op error, caught and logged
