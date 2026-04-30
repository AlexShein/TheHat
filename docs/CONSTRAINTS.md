# AI Development Constraints

These rules apply to every task in this project without exception. Each rule exists because its absence causes a category of failure that is hard to debug after the fact.

---

## Svelte 5 Runes Only
Use `$state`, `$derived`, `$effect`, `$props`, `$bindable`. Legacy `$:` reactive statements and `writable()`/`readable()` stores are **FORBIDDEN**.
> Without this: AI defaults to Svelte 4 patterns. Mixed syntax causes subtle reactivity bugs that are invisible until runtime.

## Decoupled Logic
Business logic lives in `.ts` or `.svelte.ts` files. `.svelte` files contain only declarative UI. Firebase calls, game logic, and derived computations must not exist inside component script blocks.
> Without this: logic becomes untestable and components become 400-line monsters after 3 AI iterations.

## Firebase: Server Timestamp Is the Only Clock
Timer-related writes **must** use `serverTimestamp()` from the Firebase SDK. `Date.now()` or `new Date()` are **FORBIDDEN** for any value stored in RTDB that relates to timing.
> Without this: timers drift across clients. This breaks the core mechanic of the game. Non-negotiable.

## Firebase: Hat Mutations Are Transactions
All reads and writes to `gameState.hat` and `gameState.currentWordId` **must** use `runTransaction()`. Direct `set()` or `update()` on these paths is **FORBIDDEN**.
> Without this: two clients can draw the same word simultaneously. Race condition that corrupts game state.

## Firebase: Disconnect Registration Order
`onDisconnect()` handlers **must** be registered **before** setting `connected: true`. Never reverse this order.
> Without this: if the client crashes between set and onDisconnect registration, the player appears permanently online.

## RTDB Is the Single Source of Truth
Game state must not be duplicated in component state, `localStorage`, or `sessionStorage`. The only client-side state allowed is derived/computed values (e.g. `timeRemaining`). Player ID in URL query param is the sole session identifier.
> Without this: local state diverges from RTDB on reconnect and the game breaks in ways that are invisible during single-device testing.

## Strict Typing
`any` is **FORBIDDEN**. All RTDB node shapes must be typed via interfaces in `lib/db-types.ts`. Use `unknown` + type guards for data received from Firebase snapshots.
> Without this: Firebase returns `any` from snapshot values. The entire type system is silently voided.

## No Silent Failures
Do not catch errors and continue as if nothing happened. On invalid or unexpected state: throw a typed error, or surface it visibly in the UI. Empty `catch` blocks are **FORBIDDEN**.
> Without this: Firebase permission errors, failed transactions, and network timeouts disappear silently. Debugging becomes guesswork.

## Single Responsibility
Every function and component does exactly one thing. Functions ≤ 30 lines. Files ≤ 200 lines. When a file exceeds 200 lines, split it — do not ask, just do it.
> Without this: AI accumulates logic in the nearest open file. After 5 tasks, files become unmaintainable.

## Test Before Implement
For all game logic in `lib/game/`, write the test first, then the implementation. Tests define the contract; implementation fulfills it. Use Firebase Emulator Suite — **never** run tests against real Firebase.
> Without this: AI writes plausible-looking logic with untested edge cases. The hat transaction and timer math are especially fragile.

## Styling
Use Tailwind CSS utility classes. All touch targets ≥ 44px. No hover-only interactions — every interactive element must work on touch. No inline `style=` attributes.
> Without this: game is unusable on mobile. This is primarily a mobile-use product.

## Linting
Run `npx eslint . --max-warnings 0` before marking any task complete. Fix all warnings, not just errors.
> Without this: AI-generated code accumulates lint debt silently across sessions.

## Accessibility Minimum
Every interactive element must have an accessible label (`aria-label` or visible text). Timer must have `aria-live="polite"`. Color must never be the **sole** differentiator between states.
> Without this: the game is broken for players using screen readers, and players with color vision deficiency cannot distinguish teams.
