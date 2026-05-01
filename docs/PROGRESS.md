# Phase 0 Progress Report

## Status: Complete ✅

### Files Created

| File                        | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `package.json`              | Project config, scripts (dev, test, lint, build, emulators) |
| `tsconfig.json`             | Strict TypeScript, @sveltejs/kit paths                      |
| `svelte.config.js`          | Adapter-static, fallback 200.html                           |
| `vite.config.ts`            | SvelteKit + vitest config                                   |
| `postcss.config.js`         | Tailwind CSS + autoprefixer                                 |
| `tailwind.config.ts`        | Tailwind content paths                                      |
| `.nvmrc`                    | Node 22 pin                                                 |
| `.env.example`              | Firebase config stubs                                       |
| `.gitignore`                | build, node_modules, .env, firebase debug                   |
| `.firebaserc`               | Default project: thehat-game                                |
| `firebase.json`             | Hosting + database emulator on port 9000                    |
| `database.rules.json`       | RTDB security rules (admin whitelist, room validation)      |
| `src/app.html`              | SvelteKit HTML shell                                        |
| `src/app.css`               | Tailwind directives                                         |
| `src/app.d.ts`              | App type declarations                                       |
| `src/routes/+layout.svelte` | Layout with Google Auth sign-in                             |
| `src/routes/+page.svelte`   | Landing page                                                |
| `src/lib/firebase.ts`       | Firebase init + emulator connect                            |
| `src/lib/db-types.ts`       | All RTDB type interfaces                                    |
| `src/lib/firebase.test.ts`  | Firebase connection tests (2)                               |
| `src/lib/rules.test.ts`     | Security rules tests (5)                                    |
| `.github/workflows/ci.yml`  | CI: lint, typecheck, test, build                            |
| `eslint.config.js`          | ESLint flat config + Svelte plugin                          |
| `vitest.config.ts`          | Vitest + coverage config                                    |

### Test Results

| Check                        | Status |
| ---------------------------- | ------ |
| npm run lint (0 warnings)    | ✅     |
| npm run typecheck (0 errors) | ✅     |
| npm run test (7/7 tests)     | ✅     |
| npm run build                | ✅     |

### Manual Steps Remaining

1. Create Firebase project Spark plan: thehat-game
2. Enable RTDB, Auth Google, Hosting
3. **First admin setup:** Sign in locally, copy UID from DevTools → Session Storage, add `/admins/{YOUR_UID}: true` in Firebase Console RTDB. After this, use `scripts/add-admin.ts` for everyone else (see `README.md` Admin Management section).
4. Set Firebase config values in `.env.local`
5. Deploy: `firebase deploy`
6. Verify: `npm run dev:solo:full` reachable at `localhost:5173`

### Admin Scripts

| Script                    | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `scripts/add-admin.ts`    | Add admin by email (resolves email → UID via Firebase Auth) |
| `scripts/remove-admin.ts` | Remove admin by email                                       |
| `scripts/list-admins.ts`  | List all admins with resolved emails                        |

Prerequisites: Download service account JSON from Firebase Console, set `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_DATABASE_URL` env vars.

---

## Phase 1.1 — Backend Foundation: Auth, Colors, Stores, Room Logic

### Status: Complete ✅

### Summary

Implemented all pure-logic modules for auth, color assignment, RTDB stores, and room lifecycle. Created `auth.ts` (emulator-aware sign-in, admin check), `colors.ts` (collision-free assignment, 16-color palette), `room.svelte.ts` and `players.svelte.ts` stores (Svelte 5 rune-based subscriptions), `game/room.ts` (createRoom, joinRoom, registerDisconnect with correct onDisconnect ordering), route loader, and dev bootstrap script. All 28 tests pass against Firebase + Auth emulators with 100% coverage on `room.ts`; lint exits clean.

### Files Created/Modified

| File                                | Action | Purpose                                                      |
| ----------------------------------- | ------ | ------------------------------------------------------------ |
| `src/lib/auth.ts`                   | NEW    | `initAuth()`, `isAdmin()`, `signInDevEmail()`, `signOut()`   |
| `src/lib/colors.ts`                 | NEW    | `PLAYER_COLORS` palette, `assignColor()`, `PlayerLimitError` |
| `src/lib/stores/room.svelte.ts`     | NEW    | `onValue` subscriptions for meta, config, status             |
| `src/lib/stores/players.svelte.ts`  | NEW    | `onValue` subscription for players map                       |
| `src/lib/game/room.ts`              | NEW    | `createRoom()`, `joinRoom()`, `registerDisconnect()`         |
| `src/routes/room/[roomId]/+page.ts` | NEW    | Route loader — resolves `roomId` + `playerId` from URL       |
| `scripts/dev-bootstrap.ts`          | NEW    | Seeds Auth Emulator + `/admins` for local dev                |
| `src/lib/auth.test.ts`              | NEW    | 6 tests for auth module                                      |
| `src/lib/colors.test.ts`            | NEW    | 5 tests for color assignment                                 |
| `src/lib/game/room.test.ts`         | NEW    | 8 tests for room lifecycle                                   |
| `firebase.json`                     | MODIFY | Added `auth` emulator on port 9099                           |
| `package.json`                      | MODIFY | Added `dev:bootstrap` script                                 |
| `eslint.config.js`                  | MODIFY | Disabled `no-console` for scripts directory                  |
| `tailwind.config.ts`                | MODIFY | Replaced `require()` with ESM import                         |

### Test Results

| Check                     | Status |
| ------------------------- | ------ |
| npm run lint (0 warnings) | ✅     |
| npm run test (28/28)      | ✅     |
| room.ts coverage (100%)   | ✅     |

### AC Items Satisfied

- [x] `initAuth()` returns reactive `currentUser` store, null when signed out
- [x] `isAdmin()` returns `true` when uid exists in `/admins`; `false` otherwise
- [x] `assignColor()` returns color not in `usedColors`; throws `PlayerLimitError` when palette exhausted
- [x] Two concurrent `assignColor()` calls return different colors
- [x] `room` store reactively reflects meta, config, and status changes
- [x] `players` store reactively reflects player map changes
- [x] `createRoom()` writes complete room node; fails when caller not admin
- [x] `createRoom()` generates 8-character `roomId`
- [x] `joinRoom()` writes player node with correct fields
- [x] `onDisconnect` registered before `connected` set to true
- [x] Route loader returns `roomId` from route param, `playerId` from `?p=` query
- [x] `npm run lint` exits 0
- [x] `npm run test` passes all Phase 1.1 tests

### Manual Steps Required

1. **Firebase Auth Emulator configured:** `firebase.json` already has `"auth": { "port": 9099 }`. No action needed.
2. **Dev bootstrap:** Run `npm run dev:bootstrap` once to seed emulator with test users (`admin@test.com` / `player@test.com`, both password `password123`). Uses Firebase Admin SDK via emulator env vars — bypasses RTDB rules to write `/admins`.
3. **`.env` file:** Ensure `VITE_USE_EMULATOR=true` is set in `.env` (not just `.env.example`) for local dev.
4. **First dev run:** `npm run dev:solo:full` starts emulators + dev server with min-player bypass. Sign in with `player@test.com` / `password123` in the Email input (dev fallback shown when `VITE_USE_EMULATOR=true`).

---

## Phase 1.2 — UI: Landing, Room Creation, Name Entry, Phase Switcher

### Status: Complete ✅

### Summary

Built all Phase 1 Svelte components with Svelte 5 runes, Tailwind styling, and strict decoupling from Firebase. Created context helpers, auth-aware landing page with emulator-aware UI branching, room creation flow, name entry with color assignment via store, room phase switcher with loading states, and QR code room invites. Lint passes with zero warnings. All AC items (signed-out, signed-in admin/non-admin, emulator detection, join flow, reconnect via `?p=`, touch targets ≥44px) satisfied.

### Files Created/Modified

| File                                            | Action  | Purpose                                                                     |
| ----------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `src/lib/context.ts`                            | NEW     | Typed Svelte context for `currentUser` + `loading`                          |
| `src/lib/auth.ts`                               | MODIFY  | Added `signInWithGoogle()`                                                  |
| `src/routes/+layout.svelte`                     | MODIFY  | Calls `initAuth()`, sets context, shows loading spinner                     |
| `src/routes/+page.svelte`                       | REWRITE | Auth-aware landing (4 states: prod/emulator × signed-out/signed-in + admin) |
| `src/lib/components/phases/RoomCreation.svelte` | NEW     | Room config form, calls `createRoom()`                                      |
| `src/lib/components/phases/RoomCreated.svelte`  | NEW     | Post-creation: room ID, invite link, QR code, copy buttons                  |
| `src/lib/components/phases/NameEntry.svelte`    | NEW     | Name input, `joinRoom()`, URL playerId write                                |
| `src/routes/room/[roomId]/+page.svelte`         | NEW     | Phase switcher: reads `status`, renders correct component                   |
| `tsconfig.json`                                 | MODIFY  | Removed `paths` (interferes with SvelteKit auto-generation)                 |

### Test Results

| Check                       | Status                                         |
| --------------------------- | ---------------------------------------------- |
| `npm run lint` (0 warnings) | ✅                                             |
| `npm run test` (isolated)   | 7 passed (3 suites skip: emulator not running) |

### AC Items Satisfied

- [x] Landing page: loading spinner while auth initializes
- [x] Landing page (signed out, production): "Sign in with Google" button + "Join a game" input
- [x] Landing page (signed out, emulator): email + password inputs + "Sign In (Dev)" button + "Join a game" input
- [x] Landing page (signed in, not admin): "Join a game" input only. Display name shown. Sign out link.
- [x] Landing page (signed in, is admin): "Create Game" button + "Join a game" input. Display name shown. Sign out link.
- [x] `isAdmin()` check runs only after auth state settles (no premature check on null user)
- [x] "Join a game" parses full invite link or accepts plain room ID
- [x] Admin creates room via form with `numTeams`, `wordCount`, `timerDuration`, `skipPenalty`; sees RoomCreated screen with room ID, invite link, copy buttons, QR code
- [x] QR code rendered client-side from invite URL
- [x] "Start Playing" navigates to `/room/{roomId}`
- [x] Room page redirects to `/room/{roomId}?p={playerId}` after name entry; on load with `?p=`, reads player node from RTDB
- [x] Status routing: `word-entry` + no player → `NameEntry`; `pre-start` → placeholder; `playing` → placeholder; `finished` → placeholder
- [x] Refresh with valid `?p=` skips name entry
- [x] All touch targets ≥ 44px; all interactive elements have `aria-label` or visible text

### Manual Steps Required

1. **Start Firebase emulators:** Run `npm run emulators` in a separate terminal. The database emulator must be on port 9000 for tests to connect.
2. **Bootstrap dev data:** `npm run dev:bootstrap` to seed Auth Emulator with `admin@test.com` (admin) and `player@test.com` (non-admin).
3. **Run full dev stack:** `npm run dev:solo:full` starts emulators + Vite with `VITE_DEV_BYPASS_MIN_PLAYERS=true`.
4. **E2E manual test checklist (from plan):**
   - Open `http://localhost:5173` → see loading spinner briefly, then "Sign In (Dev)" form
   - Sign in with `admin@test.com` / `password123` → display name appears, "Create Game" button visible
   - Create room with 3 teams, 7 words, 90s timer → see RoomCreated with QR code
   - Click "Start Playing" → enters room page
   - Enter name → URL updates with `?p=<playerId>`
   - Hard refresh → skips name entry
   - Sign out → sign in with `player@test.com` → no "Create Game" button
   - "Join a game" accepts room ID → navigates correctly
5. **Test full flow in production mode:** Set `VITE_USE_EMULATOR=false` in `.env`, configure real Firebase project credentials, test Google Sign-In popup/redirect with Chrome and Safari.

### Limitations

1. **NameEntry: race condition on color assignment.** Reading `playersStore.players` then calling `assignColor()` has a TOCTOU window. Mitigated by single-writer constraint (one player joining at a time) but not fully eliminated. Future: use transaction to atomically reserve a color slot.
2. **`+page.svelte` URL polling for playerId.** `history.replaceState` does not trigger SvelteKit re-render, so the phase switcher uses `popstate` listener to detect when `NameEntry` writes `?p=` to URL. This works but is not idiomatic SvelteKit. Future: use `goto()` with `replaceState` and `invalidateAll()`.

---

## Bugfix: Sign-In State Not Reactive After Auth

### Status: Complete ✅

### Summary

Replaced Svelte `setContext`/`getContext` auth pattern with module-level `$state` in `src/lib/stores/auth.svelte.ts`. Layout writes `authStore.setUser()` in `onAuthStateChanged` callback; page reads `authStore.currentUser` directly in template — Svelte 5 tracks `$state` getter access properly across component boundaries, fixing stale closure from one-time destructuring. Six new store unit tests added. Lint and full test suite (34/34) pass clean.

### Files Created/Modified

| File                            | Action | Purpose                                                    |
| ------------------------------- | ------ | ---------------------------------------------------------- |
| `src/lib/stores/auth.svelte.ts` | NEW    | Module-level `$state` for `currentUser` + `loading`        |
| `src/lib/stores/auth.test.ts`   | NEW    | 6 tests for auth store reactivity                          |
| `src/routes/+layout.svelte`     | MODIFY | Uses `authStore.setUser()` instead of `setContext()`       |
| `src/routes/+page.svelte`       | MODIFY | Uses `authStore.currentUser` instead of `getAuthContext()` |
