# Phase 4.1 — RoundEnd Component & Round Transition

## Definition

RoundEnd screen appears when `gameState.phase === 'round_end'`. Shows cumulative team scores. Admin manually triggers transition to next round (refill hat) or final scoreboard. Non-admin sees read-only score display.

`endRound()` already exists in `turn-round.ts` with full test coverage (5 tests). This sub-phase builds the UI component and wires the admin trigger.

## Acceptance Criteria

- [ ] RoundEnd screen renders when `phase === 'round_end'` (replaces current stub text)
- [ ] All players see team scores (cumulative across completed rounds) during round-end intermission
- [ ] Admin sees "Next Round" button when `round < 3`
- [ ] Admin sees "See Results" button when `round === 3`
- [ ] Non-admin players do NOT see admin action buttons
- [ ] Admin clicking "Next Round" calls `endRound()` → hat refilled, `phase` transitions to `'waiting_start'`
- [ ] Admin clicking "See Results" calls `endRound()` → `status` transitions to `'finished'`
- [ ] Turn order preserved across rounds (already verified by `turn-round.test.ts`)
- [ ] Hat refilled from original word IDs (already verified by `turn-round.test.ts`)
- [ ] `npm run test` all 5 endRound tests + full suite pass
- [ ] `npm run lint` exits 0

## Files I Will Touch

| File                                        | Reason                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/components/phases/RoundEnd.svelte` | **NEW** — Round-end intermission UI with scores + admin buttons               |
| `src/lib/components/phases/GameMain.svelte` | **MODIFY** — Replace `round_end` stub with `<RoundEnd>` component, pass props |
| `src/routes/room/[roomId]/+page.svelte`     | **MODIFY** — Pass `isAdmin` to GameMain (currently not provided)              |

## Interfaces I Will Introduce or Modify

```typescript
// RoundEnd.svelte props ($props)
{
  db: Database
  roomId: string
  playerId: string
  round: number // current round (1, 2, or 3)
  teams: Record<string, Team> // team roundScores used for display
  players: Record<string, Player> // used to derive isAdmin + player names
}
```

```typescript
// GameMain.svelte — add isAdmin prop
{
  // ... existing props ...
  isAdmin: boolean // NEW — passed through to RoundEnd
}
```

No new logic file signatures. `endRound(db, roomId)` already exported from `turn-round.ts`.

## Tests I Will Write First

No new logic tests. Component is pure UI delegation — `endRound()` already has 5 passing tests covering round refill, round-3 finish, phase guard, missing gameState, playerStats preservation.

Manual verification acceptance criteria:

- AC: RoundEnd renders team scores → verify cumulative scores match `teams[tid].roundScores`
- AC: Admin sees "Next Round" when round < 3 → verify button visible only when `players[playerId].isAdmin && round < 3`
- AC: Admin sees "See Results" when round === 3 → verify button visible only when `players[playerId].isAdmin && round === 3`
- AC: Non-admin sees no buttons → verify buttons hidden for non-admin
- AC: Click "Next Round" → `endRound()` called, phase transitions → verify in emulator UI
- AC: Click "See Results" → `endRound()` called, status → 'finished' → verify in emulator UI

## Constraints I Am Applying

| Constraint                    | How Applied                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only           | `$props()`, `$derived` for isAdmin check                                                        |
| Decoupled Logic               | RoundEnd.svelte is declarative UI only. Calls `endRound()` from `turn-round.ts`                 |
| Single Responsibility         | RoundEnd = one component, one concern (round intermission screen)                               |
| Styling                       | Tailwind CSS, touch targets ≥ 44px on buttons                                                   |
| Accessibility Minimum         | Buttons have visible text labels. Scores use semantic markup                                    |
| Linting                       | `npx eslint . --max-warnings 0` before completion                                               |
| Components are observers only | Component calls `endRound()` from `lib/game/` — no direct Firebase in `.svelte`                 |
| status vs phase separate      | RoundEnd only renders when `status === 'playing' && phase === 'round_end'` (routed by GameMain) |

## Risks

1. **RTDB race: admin double-clicks "Next Round"** — `endRound()` has phase guard (only acts on `'round_end'`). After first call, phase changes to `'waiting_start'`. Second call is a no-op. Risk mitigated.
2. **Non-admin client sees stale GameMain props** — `isAdmin` derived from `players[playerId].isAdmin` which comes from reactive store. If store hasn't synced, admin might briefly not see buttons. Acceptable — store syncs within one `onValue` tick.
3. **Hat refill uses wrong word set** — `endRound()` reads from `/rooms/{id}/words/` which contains all original words. New words cannot be added after game starts (word-entry screen is behind). Risk negligible.
