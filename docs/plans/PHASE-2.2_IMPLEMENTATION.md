# Phase 2.2 — Lobby: Team Selection & Ready

## Definition

Lobby screen shown when `status === 'pre-start'`. Players see team cards (one per `config.numTeams`), each showing joined player count with colored dots. Player selects a team via button, writes `player.teamId`. Player toggles "Ready" checkbox — writes `player.ready = true`. Ready button disabled until team selected.

Admin sees "Start Game" button when all conditions met: every player `wordsSubmitted === true`, every player `ready === true`, every team has ≥ 2 players. `VITE_DEV_BYPASS_MIN_PLAYERS=true` bypasses the min-players-per-team check.

**Why this split:** Lobby is purely UI + player state writes. No game logic, no hat, no timer. Isolates 4 files. Team nodes created in Phase 2.1 `advanceToLobby()` — this phase only reads them. The "Start Game" button wiring to `initializeGameState()` happens in Phase 2.3.

## Acceptance Criteria

1. Lobby renders N team cards matching `config.numTeams`. Each card shows team name ("Team 1", "Team 2", ...).
2. Each team card displays count of players who joined that team, rendered as colored dots matching `player.color`.
3. Player who hasn't selected a team sees "Join" button on each team card. Click writes `player.teamId`.
4. Player who has selected a team sees their team card highlighted. Other teams show "Switch" button. Click writes new `player.teamId`.
5. Player sees "Ready" toggle (checkbox or switch). Disabled until `player.teamId !== null`. Click writes `player.ready = true` / `false`.
6. Player list updates live across clients — joining/leaving teams reflects immediately (via `playersStore`).
7. Admin sees "Start Game" button. Visible only when: all players `wordsSubmitted === true`, all players `ready === true`, all teams have ≥ 2 players.
8. With `VITE_DEV_BYPASS_MIN_PLAYERS=true`: min-players-per-team guard bypassed. Solo player with wordsSubmitted + ready sees "Start Game".
9. Non-admin never sees "Start Game" button.
10. Player count, ready count, and team composition visible without scrolling on 390px mobile screen.
11. All touch targets ≥ 44px. Team cards have `aria-label`. Ready toggle has visible label.
12. On hard-refresh with valid `?p=`, team selection and ready state persist (read from RTDB).

## Files I Will Touch

| File                                             | Reason                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/lib/game/lobby.ts` (NEW)                    | `joinTeam()`, `setReady()` — player state writes. `checkAllReady()` — pure read function. |
| `src/lib/components/phases/Lobby.svelte` (NEW)   | Team cards, join/switch buttons, ready toggle, start button placeholder, admin guard.     |
| `src/lib/game/lobby.test.ts` (NEW)               | Tests for joinTeam, setReady, checkAllReady against emulator.                             |
| `src/routes/room/[roomId]/+page.svelte` (MODIFY) | Replace `pre-start` placeholder with `<Lobby>`. Pass `roomId`, `playerId`, `isAdmin`.     |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/lobby.ts

/** Writes player.teamId to join a team. If player was on another team, that write is atomic — just this single field changes. */
export async function joinTeam(db: Database, roomId: string, playerId: string, teamId: string): Promise<void>

/** Writes player.ready = value. Throws if player.teamId is null (should be guarded by UI). */
export async function setReady(db: Database, roomId: string, playerId: string, ready: boolean): Promise<void>

/** Checks if all players have wordsSubmitted === true AND ready === true AND every team has ≥ 2 players (unless bypass is true). Returns boolean + reason string for UI feedback. */
export function checkAllReady(
  players: Record<string, Player>,
  numTeams: number,
  bypassMinPlayers: boolean,
): { allReady: boolean; reason: string }
```

```typescript
// Lobby.svelte (props)
let {
  roomId,
  playerId,
  isAdmin,
  bypassMinPlayers, // from import.meta.env.VITE_DEV_BYPASS_MIN_PLAYERS
}: {
  roomId: string
  playerId: string
  isAdmin: boolean
  bypassMinPlayers: boolean
} = $props()
```

## Tests I Will Write First

```typescript
// src/lib/game/lobby.test.ts

describe("joinTeam", () => {
  it("writes player.teamId to the specified team")
  // AC 3

  it("switching from team A to team B writes new teamId, overwriting old")
  // AC 4

  it("does not modify other player fields (name, color, wordsSubmitted, ready)")
  // regression: partial set protection

  it("joining a team that doesn't exist in /rooms/{id}/teams throws TeamNotFoundError")
  // validation: UI should never allow this, but function must guard
})

describe("setReady", () => {
  it("writes player.ready = true")
  // AC 5

  it("writes player.ready = false (un-ready)")
  // AC 5 — toggle off

  it("throws ReadyWithoutTeamError when player.teamId is null")
  // guard: UI disables button, but function enforces server-side too
})

describe("checkAllReady", () => {
  it("returns {allReady: true} when all players submitted + ready, all teams ≥ 2")
  // AC 7

  it("returns {allReady: false} when any player has wordsSubmitted = false")
  // AC 7 — words not done

  it("returns {allReady: false} when any player has ready = false")
  // AC 7 — not ready

  it("returns {allReady: false} when any team has < 2 players")
  // AC 7 — insufficient players

  it("returns {allReady: true} with bypass=true when single player is ready, team has 1")
  // AC 8 — VITE_DEV_BYPASS_MIN_PLAYERS

  it("returns {allReady: false} when any team has 0 players (even with bypass=false)")
  // edge: empty team should block start even with bypass? No — bypass skips all checks.

  it("returns reason string explaining which condition failed")
  // UX: admin sees why "Start Game" is disabled
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only                          | `Lobby.svelte` uses `$state`, `$derived`, `$props`. No legacy stores.                                                                                                |
| Decoupled Logic                              | `joinTeam()`, `setReady()`, `checkAllReady()` in `lobby.ts`. Component calls these, never `set()` or `update()` directly.                                            |
| Strict Typing                                | `checkAllReady` receives typed `Record<string, Player>`. Returns typed `{allReady, reason}`. No `any`.                                                               |
| No Silent Failures                           | `setReady()` throws `ReadyWithoutTeamError` if teamId null. `joinTeam()` throws `TeamNotFoundError` if teamId invalid.                                               |
| Single Responsibility                        | `joinTeam` ≤ 10 lines. `setReady` ≤ 12 lines. `checkAllReady` ≤ 25 lines (multiple conditions). Component ≤ 180 lines.                                               |
| Test Before Implement                        | Write `lobby.test.ts` first. All tests pass against emulator.                                                                                                        |
| Styling                                      | Tailwind utilities only. Team cards: min-height for 44px touch rows. No inline `style=`.                                                                             |
| Accessibility                                | Team cards have `aria-label="Team N — X players"`. Join/Switch buttons have `aria-label`. Ready toggle has visible `<label>`. Player dots use color + team grouping. |
| RTDB Is the Single Source of Truth           | `playersStore.players` drives all UI. Team membership read from store, not duplicated.                                                                               |
| Firebase: Server Timestamp Is the Only Clock | Not applicable (no timer fields).                                                                                                                                    |
| `VITE_DEV_BYPASS_MIN_PLAYERS` isolation      | Bypass flag passed as prop. Checked only in `checkAllReady()` call within `Lobby.svelte`. Nowhere else.                                                              |

## Risks

1. **Race condition — two players join same team simultaneously as last slot:** Both read current players list, both see slot available. Mitigation: Firebase RTDB writes are atomic per key — `player.teamId` is scoped to individual player, so two writes to different player nodes don't conflict. Team count is derived from all players, not a counter field.
2. **Admin not in room when all ready:** Admin must be a player to see lobby and press "Start Game". If admin only creates room but doesn't join as player, game can't start. Mitigation: document that admin must join their own room. Phase 2.1 already forces admin to submit words to advance to lobby.
3. **`checkAllReady` reads stale data:** Players store updates via websocket, but there's a sub-second window between a player clicking "Ready" and `checkAllReady` seeing it. Mitigation: "Start Game" button is `$derived` from store values — reacts to latest RTDB snapshot. Button appears within one subscription tick.

## Sequencing Recommendation

Implement `lobby.ts` + tests first (pure logic, testable independently). Then `Lobby.svelte` with team cards, join/switch, ready toggle. The "Start Game" button renders but calls a placeholder `onStart` callback — actual `initializeGameState()` wiring in Phase 2.3. Modify `+page.svelte` last to wire Lobby into `pre-start` branch. Test with `npm run dev:solo:full` — create room, enter words, advance to lobby, observe team cards, select team, toggle ready.

## Conflicts Flagged

**None for this sub-phase.** Phase 2.2 only writes to `players/{id}/teamId` and `players/{id}/ready` — both allowed by security rules (`auth.uid === $playerId`). The "Start Game" button click handler that calls `initializeGameState()` is deferred to Phase 2.3 where the `gameState.write` security rule conflict is addressed.
