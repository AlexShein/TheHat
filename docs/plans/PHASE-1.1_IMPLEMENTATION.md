# Phase 1.1 — Backend Foundation: Auth, Colors, Stores, Room Logic

## Definition

Establish all pure-logic modules and RTDB subscriptions needed before any UI can render. No `.svelte` files touched — this phase produces only `.ts` modules. After this phase: Google Sign-In initializes and tracks auth state; admin check works; color assignment works; room+player RTDB subscriptions are reactive; `createRoom()` and `joinRoom()` are tested against emulator; and the route loader resolves `roomId` + `playerId` from URL.

**Auth flow:** User opens landing page → layout initializes Firebase Auth → `onAuthStateChanged` fires → if user is signed in, layout provides `currentUser` via Svelte context → `isAdmin()` checks `/admins/{uid}` → if admin, "Create Game" button renders; if not admin, only "Join a game" renders; if signed out, "Sign in with Google" button + "Join a game" renders (join never requires auth).

## Relevant Design Mockups

None. This phase produces no visible UI.

- [ ] `initAuth()` calls `onAuthStateChanged` and returns a reactive `currentUser` store (null when signed out)
- [ ] `isAdmin()` returns `true` when uid exists in `/admins` (emulator); `false` otherwise
- [ ] `assignColor()` returns a color not in `usedColors`; throws `PlayerLimitError` when palette exhausted
- [ ] Two concurrent `assignColor()` calls return different colors
- [ ] `room` store reactively reflects `meta`, `config`, and `status` changes in RTDB
- [ ] `players` store reactively reflects player map changes in RTDB
- [ ] `createRoom()` writes a complete room node with all required fields at `/rooms/{roomId}`; fails when caller is not admin
- [ ] `createRoom()` generates an 8-character `roomId`
- [ ] `joinRoom()` writes player node with `name`, `color`, `connected:true`, `wordsSubmitted:false`, `ready:false`, `teamId:null`
- [ ] `onDisconnect` is registered **before** `connected` is set to `true`
- [ ] Route loader returns `roomId` from route param and `playerId` from `?p=` query param
- [ ] `npm run test:ci` passes all Phase 1.1 tests
- [ ] `npm run lint -- --max-warnings 0` exits 0
- [ ] `npm run typecheck` exits 0

## Files I Will Touch

| File                                | Reason                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth.ts`                   | NEW. `initAuth()` — Google sign-in init + auth state tracking; `isAdmin()` — whitelist check; `signIn()`, `signOut()` |
| `src/lib/colors.ts`                 | NEW. `PLAYER_COLORS` palette, `assignColor(usedColors: Set<string>): string`                                          |
| `src/lib/stores/room.ts`            | NEW. `onValue` subscription for `/rooms/{roomId}/meta`, `/rooms/{roomId}/config`, `/rooms/{roomId}/status`            |
| `src/lib/stores/players.ts`         | NEW. `onValue` subscription for `/rooms/{roomId}/players` map                                                         |
| `src/lib/game/room.ts`              | NEW. `createRoom()`, `joinRoom()`, `registerDisconnect()`                                                             |
| `src/routes/room/[roomId]/+page.ts` | NEW. `load({ params, url })` — resolves `roomId`, `playerId`                                                          |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/auth.ts
import type { User } from "firebase/auth"
export function initAuth(): { currentUser: { current: User | null }, loading: { current: boolean } }
export function isAdmin(): Promise<boolean>
export function signInWithGoogle(): Promise<void>
export function signOut(): Promise<void>
export class AdminRequiredError extends Error { … }

// src/lib/colors.ts
export const PLAYER_COLORS: readonly string[]
export class PlayerLimitError extends Error { … }
export function assignColor(usedColors: Set<string>): string

// src/lib/stores/room.ts
import type { RoomMeta, RoomConfig, RoomStatus } from "$lib/db-types"
export function createRoomStore(roomId: string): {
  meta: { current: RoomMeta | null }
  config: { current: RoomConfig | null }
  status: { current: RoomStatus | null }
  destroy: () => void
}

// src/lib/stores/players.ts
import type { Player } from "$lib/db-types"
export function createPlayersStore(roomId: string): {
  players: { current: Record<string, Player> }
  destroy: () => void
}

// src/lib/game/room.ts
import type { RoomConfig } from "$lib/db-types"
export function createRoom(config: RoomConfig, adminUid: string): Promise<string>
export function joinRoom(roomId: string, playerId: string, name: string, color: string): Promise<void>
export function registerDisconnect(roomId: string, playerId: string): Promise<void>

// src/routes/room/[roomId]/+page.ts
import type { PageLoad } from "./$types"
export const load: PageLoad = ({ params, url }) => { … }
// Returns: { roomId: string, playerId: string | null }
```

## Tests I Will Write First

```
src/lib/auth.test.ts:
  ✓ initAuth() returns currentUser=null before sign in
    → AC: initAuth() returns reactive store, null when signed out
  ✓ initAuth() returns currentUser with uid after Google sign-in (emulator)
    → AC: auth state tracked reactively
  ✓ isAdmin() returns true when uid exists in /admins (emulator)
    → AC: isAdmin() returns true when uid exists in /admins
  ✓ isAdmin() returns false when uid absent from /admins
    → AC: isAdmin() returns false when uid absent
  ✓ isAdmin() returns false when not authenticated
    → AC: isAdmin() returns false when not authenticated

src/lib/colors.test.ts:
  ✓ assignColor() returns a color not in usedColors
    → AC: returns color not in usedColors
  ✓ assignColor() with full palette used throws PlayerLimitError
    → AC: throws PlayerLimitError when palette exhausted
  ✓ two concurrent assignColor() calls on same usedColors return different colors
    → AC: concurrent calls return different colors
  ✓ PLAYER_COLORS has at least 15 entries
    → Implicit: palette must support 15 players (PRD target)

src/lib/game/room.test.ts (emulator):
  ✓ createRoom() writes node at /rooms/{roomId} with all required fields and correct defaults
    → AC: writes complete room node
  ✓ createRoom() called without admin auth throws permission-denied
    → AC: fails when caller not admin
  ✓ generated roomId is 8 characters
    → AC: roomId is 8 chars
  ✓ joinRoom() writes player node with name, color, connected:true, wordsSubmitted:false, ready:false, teamId:null
    → AC: writes correct player node
  ✓ two concurrent joinRoom() calls on same room assign different colors
    → AC: concurrent joins get different colors
  ✓ joinRoom() with existing playerId does not overwrite name or color (reconnect)
    → AC: reconnect preserves name+color
  ✓ registerDisconnect() sets onDisconnect before setting connected:true
    → AC: onDisconnect registered before connected:true
```

## Constraints I Am Applying

| Constraint                                       | How Applied                                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Svelte 5 Runes Only**                          | Stores use `$state` rune for reactivity, not `writable()`                                                                              |
| **Decoupled Logic**                              | All files are `.ts` — no `.svelte` touched. Firebase calls in `lib/game/room.ts`, never in components                                  |
| **Firebase: Disconnect Registration Order**      | `registerDisconnect()` must call `onDisconnect().set(false)` then `set(connectedRef, true)`. Test verifies order                       |
| **RTDB Is the Single Source of Truth**           | Stores subscribe to RTDB paths directly. No `localStorage` or `sessionStorage` used                                                    |
| **Strict Typing**                                | All RTDB nodes typed via `db-types.ts`. `any` forbidden. `unknown` + type guards for Firebase snapshots                                |
| **No Silent Failures**                           | `assignColor()` throws `PlayerLimitError` on exhausted palette. `createRoom()` throws on permission-denied. No empty `catch`           |
| **Single Responsibility**                        | `auth.ts` only auth checks. `colors.ts` only color logic. `stores/*` only subscriptions. `game/room.ts` only room creation/join writes |
| **Test Before Implement**                        | All `lib/game/room.ts` functions tested against emulator before implementation                                                         |
| **Linting**                                      | Run `npx eslint . --max-warnings 0` before completion                                                                                  |
| **Cross-cutting: URL is session identifier**     | `+page.ts` load reads `playerId` from `?p=` query param only. No `localStorage`                                                        |
| **Cross-cutting: Components are observers only** | Stores provide reactive state; `lib/game/` contains all write logic. Boundary established now                                          |

### Constraints NOT Applicable to This Phase

- Firebase: Server Timestamp → no timer fields touched
- Firebase: Hat Mutations Are Transactions → no hat access
- Styling / Accessibility Minimum → no UI
- Status vs Phase separation → only `status` read, `phase` not used yet

## Risks

1. **Svelte 5 store pattern mismatch** — Svelte 5 `.svelte.ts` runes inside plain `.ts` files may require `$state` in module scope which works only in `.svelte.ts`. Mitigation: store files use `onValue` + manual reactivity via callback pattern or `$state` in `.svelte.ts` wrappers. If `.ts` limitation hits, rename to `.svelte.ts`.

2. **Emulator auth test flakiness** — `isAdmin()` requires reading `/admins/{uid}` which needs auth state set up per test. Mitigation: use `@firebase/rules-unit-testing` `withAuth` helpers; seed `/admins` node in test setup.

3. **Color collision under concurrency** — `assignColor()` runs client-side, reading current players snapshot. Two clients joining simultaneously may read same snapshot and assign same color. Mitigation: `joinRoom()` must use transaction on `/rooms/{roomId}/players` to atomically check and reserve color. If transaction confirms color uniqueness, collision prevented. Flag this if transaction approach conflicts with the "no transaction requirement for player join" assumption.
