# Hat Game — Cline Project Rules

## Project Overview

Real-time multiplayer party game ("Hat" / Шляпа). SvelteKit 5 frontend + Firebase Realtime Database. Personal-use MVP. No backend server — only a single Cloud Function for cleanup.

Reference documents (read these before touching related code):

- `docs/CONSTRAINRTS.md` — this file, subject to be injected in all prompts
- `docs/PRD.md` — all game rules and functional requirements
- `docs/ARCHITECTURE.md` — tech decisions, key patterns, known trade-offs
- `docs/DATA_SCHEMA.md` — full RTDB schema with invariants and state transitions
- `docs/IMPLEMENTATION_PLAN.md` — phased tasks and acceptance criteria

---

## Stack & Versions

- **Framework:** SvelteKit (latest stable) with Svelte 5 runes syntax
- **Language:** TypeScript, strict mode
- **Database:** Firebase Realtime Database (not Firestore)
- **Auth:** Firebase Auth, Google provider only
- **Hosting:** Firebase Hosting with static adapter
- **Functions:** Cloud Functions v2, Node.js, TypeScript

---

## HARD TECHNICAL CONSTRAINTS

- **Svelte 5 Runes Only:** Use `$state`, `$derived`, `$effect`, `$props`, `$bindable`. Legacy Svelte 4 reactive statements (`$:`) are explicitly FORBIDDEN.
- **Decoupled Logic:** Complex business logic and state derivations must live in pure `.ts` or `.svelte.ts` files. `.svelte` files are strictly reserved for declarative UI.
- **Test Driven Development:** Write tests before implementing logic. This forces explicit API design, defines clear system boundaries, and prevents regressions. Run tests with `npm run tests`.
- **Single Responsibility Principle:** Every function, class, and component must do exactly _one_ thing and have exactly _one_ reason to change.
- **Testing Boundaries:** Use Vitest. Write tests against public behaviors and edge cases, not implementation details. Never execute real network requests in unit tests.
- **Strict Typing:** use of `any` is prohibited. Use `unknown` combined with type guards for dynamic data.
- **Modularity:** Functions must be ≤ 30 lines, and files ≤ 200 lines. Refactor out logic to utilities when breached. Proactively propose refactoring when you see opportunities, but do not refactor without explicit user approval.
- **Styling Rules:** Use Tailwind CSS and CSS variables. Ensure mobile-first touch targets (≥ 44px) and avoid hover-only dependencies.
- **Linting** - Run `npx eslint .` in the current folder before finishing the task and fix potential issues.
- **FORBIDDEN: Swallowing Errors.** Reason: Masks silent failures. Fail fast by explicitly throwing typed errors on invalid incoming states instead of hiding bad data.

## Code Style

### TypeScript

- Strict mode always on
- No `any`. Use `unknown` and narrow, or define proper types.
- All Firebase RTDB paths typed — define path types in `lib/db-types.ts`
- Prefer `interface` over `type` for object shapes

### Svelte 5

- Use runes syntax exclusively: `$state`, `$derived`, `$effect`, `$props`
- No legacy `writable()` / `readable()` stores — use runes or Firebase-backed reactive state
- Component files: PascalCase (`GameMain.svelte`)
- One component per file
- Props typed with `$props<{...}>()`

### Firebase

- **Never use client-side `Date.now()` for timer start timestamps** — always use `serverTimestamp()` from Firebase SDK
- **Never write to `gameState.hat` directly** — always use `runTransaction()`
- All Firebase calls wrapped in try/catch with user-visible error handling
- `onDisconnect()` must be registered before setting `connected: true`

### Naming

- RTDB node keys: camelCase
- Svelte component props: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Files: kebab-case for lib files, PascalCase for components

---

## Project Structure

```
src/
  lib/
    firebase.ts          # App init; exports: db, auth
    db-types.ts          # TypeScript interfaces for RTDB nodes
    stores/
      room.ts            # Room meta + config reactive state
      players.ts         # Players map reactive state
      game-state.ts      # Full gameState node reactive state
    game/
      timer.ts           # Derived reactive value: timeRemaining (ms)
      hat.ts             # drawWord(), returnWord() — always transactions
      turn.ts            # nextExplainer(), nextTeam(), endRound()
      scoring.ts         # awardPoint(), applyPenalty(), undoLastAction()
    auth.ts              # isAdmin(), requireAdmin()
    colors.ts            # PLAYER_COLORS palette, assignColor()
  routes/
    +page.svelte         # Landing page (create game button)
    room/
      [roomId]/
        +page.svelte     # Phase switcher
        +page.ts         # Load: resolve roomId + playerId, check reconnect
  components/
    phases/              # One component per game phase
    shared/              # Reusable UI (Timer, TeamScore, AdminControls, etc.)
functions/
  src/
    index.ts             # Exports: cleanupRooms (scheduled)
```

---

## Critical Patterns

### Timer — Never Do This

```typescript
// ❌ WRONG — client clock, will drift and break on reconnect
const timerStartedAt = Date.now()

// ✅ CORRECT — server timestamp
import { serverTimestamp } from "firebase/database"
await set(ref(db, `rooms/${roomId}/gameState/timerStartedAt`), serverTimestamp())
```

### Time Remaining — Compute Locally

```typescript
// In timer.ts
// timeRemaining is derived, never stored in RTDB
const timeRemaining = $derived(() => {
  if (pausedAt !== null) return timeRemainingAtPause
  if (timerStartedAt === null) return timerDuration
  return timerDuration - (Date.now() - timerStartedAt)
})
```

### Drawing Words — Always a Transaction

```typescript
// In hat.ts
// NEVER: const wordId = gameState.hat[0]; set(currentWordRef, wordId);
// ALWAYS: use runTransaction on the hat array
```

### Single Writer Per Turn

Only `currentExplainerId`'s client writes to `gameState` during a turn (draw, guessed, skip, undo). All other clients are observers. Never have two clients race to write game state.

---

## What NOT to Build

- No Firestore — RTDB only
- No persistent server / Express / Cloud Run — Cloud Functions only
- No user accounts for non-admin players — name + color only
- No anti-cheat — trust the players
- No animations beyond CSS transitions
- No i18n — Russian/English mixed is fine, pick one per string and be consistent
- No offline mode — requires active connection

---

## Environment Variables

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

Never commit `.env`. Never commit Firebase service account keys. Functions config via `firebase functions:config:set` or Secret Manager.

---

## When You're Unsure

1. Check `docs/DATA_SCHEMA.md` first — it defines what exists in RTDB and what's computed client-side.
2. Check `docs/ARCHITECTURE.md` — most non-obvious decisions are explained there.
3. If adding a new RTDB write path, ask: is this the right client to be writing this? (See "Single Writer Per Turn" above.)
4. If touching timer logic: stop, re-read the timer section in `docs/ARCHITECTURE.md`.
