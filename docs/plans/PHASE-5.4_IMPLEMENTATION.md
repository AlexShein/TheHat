# Phase 5.4 — Reconnect Flow & Room Lifecycle

## Definition

Handles the player reconnection path and room-level lifecycle updates:

1. **Reconnect flow** — on page load with valid `roomId` + `playerId` (`?p=` query param), if the player node exists in RTDB: re-register `onDisconnect()` handler, write `connected: true`, and transition directly to the current game phase without showing name entry.

2. **`meta/lastActiveAt`** — updated via `onDisconnect()` (writes `serverTimestamp()` on RTDB disconnect) AND periodically when connected (every 60 seconds, via `$effect` heartbeat). This field feeds the cleanup function (Phase 6) — doesn't need to exist before then, but its write pattern must be established here.

3. **`onDisconnect` re-registration order** — on reconnect, `onDisconnect(connectedRef).set(false)` must be registered BEFORE `set(connectedRef, true)`. Same invariant as Phase 1 initial join.

**Why split here:** Reconnect logic touches `+page.ts` (load function), `+page.svelte` (onMount/$effect), and the existing `NameEntry.svelte` flow. It's a distinct concern from admin controls and disconnect detection. Keeping it separate ensures each sub-phase is about one thing.

**Missing from original plan:** The original plan says "`meta/lastActiveAt` updated via `onDisconnect`" but doesn't specify the heartbeat pattern. This plan adds the periodic heartbeat (every 60s while connected) so `lastActiveAt` reflects recent activity, not just disconnect time. Without the heartbeat, `lastActiveAt` would be stale (set only once at disconnect) and the cleanup function could delete active rooms.

## Acceptance Criteria I Am Using

1. Hard-refresh with `?p={playerId}` when player node exists: no name entry shown, player routed to current game phase
2. On reconnect, `onDisconnect(connectedRef).set(false)` is registered BEFORE `set(connectedRef, true)` — order verified in test
3. After reconnect, `players/{playerId}/connected` is `true` in RTDB (verify in emulator UI)
4. If `?p={playerId}` points to a non-existent player node (deleted or wrong ID), name entry screen is shown
5. `meta/lastActiveAt` has `onDisconnect → serverTimestamp()` registered on initial join AND reconnect
6. `meta/lastActiveAt` is written with `serverTimestamp()` every 60 seconds while player is connected (heartbeat)
7. Heartbeat stops when component unmounts
8. Disconnect → `meta/lastActiveAt` becomes disconnect time; cleanup function (Phase 6) can read it
9. Reconnect preserves player state: `name`, `color`, `teamId`, `ready`, `wordsSubmitted` are NOT overwritten
10. Reconnect works from any game phase (word-entry, pre-start, playing, finished)

## Files I Will Touch

| File                                         | Reason                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/room/[roomId]/+page.ts`          | MODIFY — add reconnection check to load function; pass `reconnecting` flag to page                                                 |
| `src/routes/room/[roomId]/+page.svelte`      | MODIFY — add reconnect onMount logic (onDisconnect re-register + set connected: true), heartbeat $effect for `meta/lastActiveAt`   |
| `src/lib/components/phases/NameEntry.svelte` | VERIFY — ensure it respects `reconnecting` flag (skip if true)                                                                     |
| `src/lib/stores/players.svelte.ts`           | MODIFY — expose `getPlayerSnapshot` or equivalent for reconnect check                                                              |
| `src/lib/game/join-room.ts`                  | MODIFY — export helper `reconnectPlayer(db, roomId, playerId)` that handles onDisconnect + connected:true (or extract to new file) |

**Decision: extract reconnect to new file or modify join-room.ts?** `join-room.ts` currently handles initial join. Reconnect shares the `onDisconnect` registration pattern but differs: it skips writing `name`/`color`/`ready`/`wordsSubmitted`. Adding reconnect to `join-room.ts` would make it do two things and risk the file exceeding 200 lines. **Extract to `src/lib/game/reconnect.ts`.**

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/reconnect.ts — NEW FILE

export class ReconnectError extends Error {
  constructor(public reason: string)
}

/**
 * Re-registers onDisconnect and sets connected:true for an existing player.
 * Must be called on page load when playerId + roomId are valid and player node exists.
 * Does NOT overwrite name, color, teamId, ready, wordsSubmitted.
 * Throws ReconnectError if player node does not exist.
 */
export async function reconnectPlayer(
  db: Database,
  roomId: string,
  playerId: string,
): Promise<void>

// Heartbeat helper (also in reconnect.ts or separate file)
/**
 * Starts a periodic heartbeat that writes meta/lastActiveAt = serverTimestamp().
 * Returns a cleanup function to stop the interval.
 * Interval: 60 seconds.
 */
export function startMetaHeartbeat(
  db: Database,
  roomId: string,
): () => void
```

```typescript
// src/routes/room/[roomId]/+page.ts — MODIFY load return type

// Add to existing PageData:
interface PageData {
  roomId: string
  playerId: string | null
  reconnecting: boolean // NEW — true when player node exists
}
```

## Tests I Will Write First

```typescript
// src/lib/game/reconnect.test.ts — NEW FILE

describe("reconnectPlayer", () => {
  it("sets connected:true after registering onDisconnect (order verified)")
  // AC 2, 3
  it("does not overwrite player name, color, teamId, ready, wordsSubmitted")
  // AC 9
  it("throws ReconnectError when player node does not exist")
  // AC 4
  it("works when reconnecting during 'playing' phase — does not reset game state")
  // AC 10
  it("works when reconnecting during 'word-entry' — player sees word entry")
  // AC 10
  it("re-registers onDisconnect — closing tab after reconnect sets connected:false")
  // AC 2
})

describe("startMetaHeartbeat", () => {
  it("writes meta/lastActiveAt within 65 seconds of starting")
  // AC 6
  it("stops writing when cleanup is called")
  // AC 7
  it("writes serverTimestamp, not Date.now()")
  // Constraint: Server Timestamp
})

describe("+page.ts load function (reconnect)", () => {
  it("sets reconnecting=true when player node exists in RTDB")
  // AC 1
  it("sets reconnecting=false when player node does not exist")
  // AC 4
  it("sets reconnecting=false when ?p= is absent")
  // AC 4
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase: Disconnect Registration Order      | `reconnectPlayer()` registers `onDisconnect` BEFORE `set(connected, true)`. Test verifies order                                                                                                                                               |
| Firebase: Server Timestamp Is the Only Clock | Heartbeat writes `serverTimestamp()` to `meta/lastActiveAt`. Disconnect handler writes `serverTimestamp()`                                                                                                                                    |
| RTDB Is the Single Source of Truth           | Reconnect reads player node from RTDB to determine if node exists. No localStorage check                                                                                                                                                      |
| Strict Typing                                | `ReconnectError` typed. Heartbeat return type explicit                                                                                                                                                                                        |
| Single Responsibility                        | `reconnect.ts` = reconnection + heartbeat. `+page.ts` load = data resolution. `+page.svelte` onMount = wiring                                                                                                                                 |
| Decoupled Logic                              | `reconnectPlayer()` and `startMetaHeartbeat()` in `.ts` file. Components call them                                                                                                                                                            |
| Decoupled Logic (heartbeat in component)     | Heartbeat is a side-effect loop (setInterval). It's wired in `+page.svelte` onMount — this is acceptable because it's a lifecycle concern, not business logic. The business logic (what to write, using serverTimestamp) is in `reconnect.ts` |
| Silently Overwriting                         | `reconnectPlayer()` must NOT write `name`, `color`, `teamId`, `ready`, `wordsSubmitted`. Test verifies this                                                                                                                                   |
| Svelte 5 Runes Only                          | `+page.svelte` uses `$effect` for cleanup, `onMount` for reconnect trigger                                                                                                                                                                    |
| URL is the Session Identifier                | `+page.ts` load reads `playerId` from `?p=` query param. No fallback to localStorage                                                                                                                                                          |

## Risks

1. **Reconnect race with `onDisconnect`.** If a player's tab crashes and they reload within the 60-second `onDisconnect` grace period, there's a window where `connected` could be `false` (from the crash) and the reconnect write sets it to `true`. RTDB `onDisconnect` handlers are best-effort — this race is inherent to the Firebase model and cannot be eliminated. Mitigation: the reconnect flow sets `connected: true` unconditionally, which is correct — the player IS connected
2. **Heartbeat vs cleanup race.** If a player's tab is open but network drops, the heartbeat stops writing. The `onDisconnect` sets `lastActiveAt` to disconnect time. On network restore, the tab resumes heartbeat. No race — both paths converge on the same field using `serverTimestamp()`
3. **`+page.ts` load function data staleness.** The load function runs on the server (or at build time with `adapter-static`). For SPA mode (which this project uses), load runs on the client. The `reconnecting` flag is derived from an RTDB read — it's fresh on every navigation. No staleness concern
