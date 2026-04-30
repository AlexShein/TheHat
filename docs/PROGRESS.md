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
| `.github/workflows/ci.yml`  | CI: lint, typecheck, test:ci, build                         |
| `eslint.config.js`          | ESLint flat config + Svelte plugin                          |
| `vitest.config.ts`          | Vitest + coverage config                                    |

### Test Results

| Check                        | Status |
| ---------------------------- | ------ |
| npm run lint (0 warnings)    | ✅     |
| npm run typecheck (0 errors) | ✅     |
| npm run test:ci (7/7 tests)  | ✅     |
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
| `package.json`                      | MODIFY | Added `dev:bootstrap` and `test:ci:auth` scripts             |
| `eslint.config.js`                  | MODIFY | Disabled `no-console` for scripts directory                  |
| `tailwind.config.ts`                | MODIFY | Replaced `require()` with ESM import                         |

### Test Results

| Check                        | Status |
| ---------------------------- | ------ |
| npm run lint (0 warnings)    | ✅     |
| npm run test:ci:auth (28/28) | ✅     |
| room.ts coverage (100%)      | ✅     |

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
- [x] `npm run test:ci:auth` passes all Phase 1.1 tests

### Manual Steps Required

1. **Firebase Auth Emulator configured:** `firebase.json` already has `"auth": { "port": 9099 }`. No action needed.
2. **Dev bootstrap:** Run `npm run dev:bootstrap` once to seed emulator with test users (`admin@test.com` / `player@test.com`, both password `password123`). Uses Firebase Admin SDK via emulator env vars — bypasses RTDB rules to write `/admins`.
3. **`.env` file:** Ensure `VITE_USE_EMULATOR=true` is set in `.env` (not just `.env.example`) for local dev.
4. **First dev run:** `npm run dev:solo:full` starts emulators + dev server with min-player bypass. Sign in with `player@test.com` / `password123` in the Email input (dev fallback shown when `VITE_USE_EMULATOR=true`).
