# Phase 4.2 — Scoreboard & Game Restart

## Definition

Scoreboard appears when `status === 'finished'`. Shows team totals (sum of 3 `roundScores`) and per-player words-explained count. Admin sees "Restart" button. `restartGame()` clears game data while preserving team assignments and player turn order.

Phase 4.1 delivers the round-end intermission screen (RoundEnd component). Phase 4.2 delivers the post-game screen and restart flow.

## Acceptance Criteria

- [ ] Scoreboard renders when `status === 'finished'` (replaces current "Game Over — coming soon" stub)
- [ ] Team totals displayed sum `round1 + round2 + round3` correctly for each team
- [ ] Per-player `wordsExplained` shown for every player
- [ ] Admin sees "Restart" button (visible only when `players[playerId].isAdmin`)
- [ ] Admin clicking "Restart" calls `restartGame()` → `status` transitions to `'word-entry'`
- [ ] After restart: `gameState` node removed, all `words` nodes removed
- [ ] After restart: all players' `wordsSubmitted: false`, `ready: false`
- [ ] After restart: `player.teamId` preserved, `teams.playerOrder` preserved, `teams.currentPlayerIndex` preserved
- [ ] `playerStats.wordsExplained` accumulates across rounds (verified in test, not reset by restart)
- [ ] All clients transition to word-entry screen within 1 second of restart
- [ ] `npm run test` passes — all existing 5 endRound + new restart tests + full suite
- [ ] `npm run lint` exits 0

## Files I Will Touch

| File                                          | Reason                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/game/turn-round.ts`                  | **MODIFY** — Add `restartGame()` function                               |
| `src/lib/game/turn-round.test.ts`             | **MODIFY** — Add restart tests (6-8 new)                                |
| `src/lib/components/phases/Scoreboard.svelte` | **NEW** — Final scoreboard UI with team totals + player stats + restart |
| `src/routes/room/[roomId]/+page.svelte`       | **MODIFY** — Replace `finished` stub with `<Scoreboard>` component      |

## Interfaces I Will Introduce or Modify

```typescript
// turn-round.ts — new export
export async function restartGame(db: Database, roomId: string): Promise<void>
```

```typescript
// Scoreboard.svelte props ($props)
{
  db: Database
  roomId: string
  playerId: string
  round: number // always 3 at this point, for display
  teams: Record<string, Team> // roundScores used for team totals
  players: Record<string, Player> // get name + isAdmin, team membership for display
  playerStats: GameState["playerStats"] // wordsExplained per player
}
```

```typescript
// +page.svelte — Scoreboard branch passes extra props not yet available
// Need to pass: teams, playerStats
// Currently finished branch has empty stub — will import and render Scoreboard
```

## Tests I Will Write First

```typescript
// turn-round.test.ts — added to existing describe("endRound") or new describe("restartGame")

describe("restartGame", () => {
  // AC: gameState node removed
  it("removes gameState node")

  // AC: all words nodes removed
  it("removes all words nodes")

  // AC: status → 'word-entry'
  it("sets status to 'word-entry'")

  // AC: player fields reset
  it("resets all players' wordsSubmitted and ready to false")

  // AC: teamId preserved
  it("preserves player.teamId")

  // AC: teams.playerOrder preserved
  it("preserves teams.playerOrder")

  // AC: teams.currentPlayerIndex preserved
  it("preserves teams.currentPlayerIndex")

  // Edge: restart when gameState doesn't exist (no-op)
  it("does nothing when gameState node does not exist")

  // Edge: restart when status is not 'finished'
  it("does nothing when status is not 'finished'")
})
```

| Test                               | Verifies AC                         |
| ---------------------------------- | ----------------------------------- |
| removes gameState node             | gameState node removed              |
| removes all words nodes            | all words nodes removed             |
| sets status to 'word-entry'        | status → 'word-entry'               |
| resets wordsSubmitted and ready    | wordsSubmitted: false, ready: false |
| preserves teamId                   | team assignments preserved          |
| preserves teams.playerOrder        | player order preserved              |
| preserves teams.currentPlayerIndex | turn order continued                |
| no-op when gameState missing       | graceful handling                   |
| no-op when status ≠ 'finished'     | guard clause                        |

## Constraints I Am Applying

| Constraint                     | How Applied                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only            | `$props()`, `$derived` for computed totals                                                               |
| Decoupled Logic                | Scoreboard.svelte is pure display — calls `restartGame()` from `turn-round.ts`. No Firebase in component |
| Single Responsibility          | `restartGame` is ≤ 30 lines, one concern (reset room for new game). Scoreboard is one component          |
| RTDB Is Single Source of Truth | No localStorage. All restart state written to RTDB                                                       |
| Strict Typing                  | `restartGame` type-safe: reads `GameState`, writes typed fields                                          |
| No Silent Failures             | `restartGame` throws if player node missing for expected playerId                                        |
| Styling                        | Tailwind CSS, touch targets ≥ 44px on Restart button                                                     |
| Accessibility Minimum          | Team scores use `<table>` or list with visible labels. Restart button has visible text                   |
| Linting                        | `npx eslint . --max-warnings 0` before completion                                                        |
| Components are observers only  | Scoreboard calls `restartGame()` from `lib/game/` — no direct Firebase in `.svelte`                      |
| status vs phase separate       | Scoreboard renders on `status === 'finished'` — no `phase` dependency                                    |
| Firebase: Server Timestamp     | Not applicable — restart writes no timer fields                                                          |
| Firebase: Hat Mutations        | Not applicable — restart writes no hat fields                                                            |
| Test Before Implement          | `restartGame` tests written first, then implementation                                                   |

## Risks

1. **Stale client routing after restart** — After `restartGame()` sets `status: 'word-entry'`, all clients' reactive stores see the change and `getRoomRoute()` returns `'word-entry'` screen. If a client hasn't re-subscribed yet, they might briefly see Scoreboard after restart. Mitigated by RTDB `onValue` firing immediately for the status change.
2. **Race: player submits word before all clients see restart** — After restart, `status === 'word-entry'` but player nodes still being reset. If a fast player adds a word before their `wordsSubmitted: false` syncs, word is added legitimately (word-entry screen allows it). No corruption — just a valid word in new game. Acceptable.
3. **Admin double-clicks Restart** — `restartGame()` guard: only acts when `status === 'finished'`. After first call, status is `'word-entry'`. Second call no-ops. Risk mitigated.
