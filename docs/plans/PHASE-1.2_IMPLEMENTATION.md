# Phase 1.2 — UI: Landing, Room Creation, Name Entry, Phase Switcher

## Definition

Build all `.svelte` components for Phase 1 that render against the stores and game-logic modules from Phase 1.1. After this phase: admin creates room and sees invite screen; players join via link and enter name; URL persists player identity across refresh; room page renders correct component based on `status`.

**Auth flow on landing page:**

1. Page loads → `+layout.svelte` calls `initAuth()` → shows loading spinner while auth resolves
2. Auth resolves → landing page receives `currentUser` via page data/context
3. **Production (VITE_USE_EMULATOR=false):**
   - Signed out: "Sign in with Google" button + "Join a game" input
   - Signed in, not admin: "Join a game" input only. Display name + sign out link.
   - Signed in, is admin: "Create Game" button + "Join a game" input
4. **Local dev (VITE_USE_EMULATOR=true):**
   - Signed out: Email input + password input + "Sign In (Dev)" button + "Join a game" input
   - Signed in, not admin: "Join a game" input only. Display name + sign out link.
   - Signed in, is admin: "Create Game" button + "Join a game" input
   - "Sign In (Dev)" calls `signInDevEmail(email, password)` → uses Auth Emulator
   - Run `npm run dev:bootstrap` first to seed test users (admin@test.com / password123)
5. "Join a game" works regardless of auth state (join never requires auth).

## Acceptance Criteria

- [ ] Landing page: loading spinner while auth initializes (no flash of wrong UI)
- [ ] Landing page (signed out, production): "Sign in with Google" button + "Join a game" input visible
- [ ] Landing page (signed out, emulator): email + password inputs + "Sign In (Dev)" button + "Join a game" input visible
- [ ] Landing page (signed in, not admin): "Join a game" input only. Your display name shown. Sign out link.
- [ ] Landing page (signed in, is admin): "Create Game" button + "Join a game" input. Your display name shown. Sign out link.
- [ ] Click "Sign In (Dev)" with admin@test.com / password123 → signed in as admin → "Create Game" button appears
- [ ] Click "Sign In (Dev)" with player@test.com / password123 → signed in as non-admin → no "Create Game" button
- [ ] Click "Sign in with Google" (production) → Google sign-in popup → returns signed in → buttons update
- [ ] isAdmin() check runs only after auth state settles (no premature check on null user)
- [ ] "Join a game" parses full invite link (extracts roomId from URL) or accepts plain room ID
- [ ] Admin creates room via form with `numTeams`, `wordCount`, `timerDuration`, `skipPenalty`; sees RoomCreated screen with room ID, invite link, copy buttons, QR code
- [ ] QR code rendered client-side from invite URL
- [ ] "Start Playing" navigates to `/room/{roomId}`
- [ ] Room page (`/room/{roomId}`): redirects to `/room/{roomId}?p={playerId}` after name entry; on load with `?p=`, reads player node from RTDB to determine reconnect vs name entry
- [ ] Status routing: `status === 'word-entry'` + no player node → `NameEntry`; else `status === 'word-entry'` → (future WordEntry); else `status === 'pre-start'` → (future Lobby); else `status === 'playing'` → placeholder
- [ ] Refresh with valid `?p=` → skips name entry, goes directly to current phase
- [ ] All touch targets ≥ 44px; all interactive elements have `aria-label` or visible text

## Files I Will Touch

| File                                        | Reason                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+layout.svelte`                 | MODIFY. Call `initAuth()` on mount, pass `currentUser` + `loading` via context to all pages                                                                     |
| `src/routes/+page.svelte`                   | REWRITE. Landing page: auth-aware + emulator-aware — shows Google Sign-In (prod) or email/password (dev) + Create Game / Join based on auth state + `isAdmin()` |
| `src/components/phases/RoomCreation.svelte` | NEW. Room config form, calls `createRoom()`                                                                                                                     |
| `src/components/phases/RoomCreated.svelte`  | NEW. Post-creation screen: room ID, invite link, QR code                                                                                                        |
| `src/components/phases/NameEntry.svelte`    | NEW. Name input, calls `joinRoom()`, writes `?p=` to URL                                                                                                        |
| `src/routes/room/[roomId]/+page.svelte`     | NEW. Phase switcher: reads `status` store, renders correct component                                                                                            |
| `src/lib/context.ts`                        | NEW. `getAuthContext()` / `setAuthContext()` — typed context helpers for `currentUser` and `loading` (avoids string-based context)                              |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/context.ts
import type { User } from "firebase/auth"
export const AUTH_CONTEXT_KEY = Symbol("auth")
export interface AuthContext {
  currentUser: User | null
  loading: boolean
}
export function setAuthContext(): void
export function getAuthContext(): AuthContext

// src/routes/+layout.svelte
<script lang="ts">
  import { initAuth } from "$lib/auth"
  import { setAuthContext } from "$lib/context"
  // On mount: call initAuth() → get reactive currentUser + loading
  // Set both into Svelte context via setAuthContext()
  // Wrap slot in conditional: show loading spinner while loading=true
</script>

// src/routes/+page.svelte
<script lang="ts">
  import { getAuthContext } from "$lib/context"
  import { isAdmin } from "$lib/auth"
  import { signInWithGoogle, signInDevEmail, signOut } from "$lib/auth"
  import { VITE_USE_EMULATOR } from "$env/static/public" // or import.meta.env
  let { currentUser, loading } = getAuthContext()
  let isUserAdmin = $state(false)
  let devEmail = $state("")
  let devPassword = $state("")
  let isEmulator = VITE_USE_EMULATOR === "true"
  // $effect: when currentUser changes & loading=false, call isAdmin() if signed in
  // Renders four states: signed out (prod), signed out (emulator), signed in non-admin, signed in admin
</script>

// src/components/phases/RoomCreation.svelte (component, no exports)
<script lang="ts">
  import type { RoomConfig } from "$lib/db-types"
  // Props: none
  // Emits: roomCreated(roomId: string)
  // Calls: createRoom(config, adminUid) from $lib/game/room
</script>

// src/components/phases/RoomCreated.svelte (component, no exports)
<script lang="ts">
  // Props: roomId: string
  // Emits: startPlaying()
  // QR code: rendered via qrcode-generator or similar, from `${window.location.origin}/room/${roomId}`
</script>

// src/components/phases/NameEntry.svelte (component, no exports)
<script lang="ts">
  // Props: roomId: string, existingPlayerId: string | null
  // Emits: none (manages own state)
  // Calls: joinRoom() from $lib/game/room, assignColor() from $lib/colors
  // Writes ?p={playerId} via history.replaceState
</script>

// src/routes/room/[roomId]/+page.svelte (component, no exports)
<script lang="ts">
  import type { PageData } from "./$types"
  let { data } = $props()
  // Uses: createRoomStore(roomId), createPlayersStore(roomId)
  // Renders: NameEntry | placeholder for future phases
</script>
```

## Tests I Will Write First

No unit tests for `.svelte` files in this phase. AC verification is manual (emulator + browser). Phase 1.1 tests cover all logic.

**Prerequisite:** Run `npm run dev:bootstrap` once to seed emulator with test users.

Manual test checklist:

```
□ Start with npm run dev:solo:full (or dev:full for multi-player)
□ Landing page shows loading spinner briefly, then "Sign In (Dev)" form (emulator mode detected)
□ Enter admin@test.com / password123 → click "Sign In (Dev)" → display name appears, "Create Game" button visible
□ Sign out → enter player@test.com / password123 → signed in, no "Create Game" button
□ Sign out → "Join a game" accepts room ID "abc123" → navigates to /room/abc123
□ Paste full URL "https://example.com/room/abc123" → parses to roomId "abc123"
□ Admin creates room with 3 teams, 7 words, 90s timer, skip penalty on → sees RoomCreated
□ RoomCreated shows 8-char room ID, working copy buttons, QR code
□ "Start Playing" navigates to /room/{roomId}
□ NameEntry shows room ID header, input field, Confirm button
□ Enter name → playerId appears in URL as ?p={playerId}
□ Hard refresh with ?p={playerId} → skips NameEntry
□ Touch targets ≥ 44px on all buttons and inputs (DevTools mobile simulation)
```

## Constraints I Am Applying

| Constraint                             | How Applied                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Svelte 5 Runes Only**                | All components use `$state`, `$derived`, `$props`, `$effect`. No `writable()`, no `$:` reactivity                                           |
| **Decoupled Logic**                    | `.svelte` files call functions from `$lib/game/room.ts`, `$lib/auth.ts`, `$lib/colors.ts`. No Firebase calls in component `<script>` blocks |
| **RTDB Is the Single Source of Truth** | Components read from stores/subscriptions. No `localStorage`. Player ID in URL only                                                         |
| **Strict Typing**                      | All props typed with `$props()` generic or `import type`. No `any`                                                                          |
| **No Silent Failures**                 | Room creation failure → error shown in UI. Name too short → input validation shown. No empty `catch` in components                          |
| **Single Responsibility**              | Each component does one phase/screen. `RoomCreation` ≠ `RoomCreated`. `NameEntry` ≠ phase switcher                                          |
| **Styling**                            | Tailwind utility classes only. Touch targets ≥ 44px. No hover-only interactions. No inline `style=`                                         |
| **Accessibility Minimum**              | All inputs and buttons have visible text or `aria-label`. Room ID copy buttons have descriptive labels                                      |
| **Linting**                            | `npm run lint --max-warnings 0` passes                                                                                                      |

### Constraints NOT Applicable to This Phase

- Firebase: Server Timestamp → no timer fields
- Firebase: Hat Mutations Are Transactions → no hat
- Firebase: Disconnect Registration Order → handled in Phase 1.1
- Test Before Implement → no game logic in this phase; tests covered by Phase 1.1
- Cross-cutting: Components are observers only → established; no Firebase writes in `.svelte`

## Risks

1. **QR code library import conflict** — Adding `qrcode` npm package may bloat bundle. Mitigation: use lightweight `qrcode-generator` (~5KB) or render via Canvas API inline. If tree-shaking fails, switch to server-side QR or external service.

2. **Auth state race on landing page** — `onAuthStateChanged` fires asynchronously; admin/non-admin split may flash wrong UI. Mitigation: layout shows loading spinner while `initAuth().loading` is true; `isAdmin()` called only after `currentUser` settles. Landing page receives `loading` from context and renders nothing interactive until `loading === false`.

3. **Google Sign-In popup blocked by browser** — Popup blockers may prevent `signInWithPopup`. Mitigation: use `signInWithRedirect` as fallback. Test both paths in Chrome and Safari.

4. **Phase switcher missing future phases** — `+page.svelte` must switch on `status` for WordEntry, Lobby, and GameMain which don't exist yet. Mitigation: render placeholder `<div>` with phase name for unmatched statuses. Throw typed error if `status` is invalid (unrecognized value).
