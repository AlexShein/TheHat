# Implementation Plan: Hat Game MVP

Complete phases in order. Do not begin a phase until all acceptance criteria of the previous phase pass. Estimates are for one developer with AI assistance.

**Local testing:** Run `npm run dev:solo:full` to start Firebase emulators + dev server with single-player bypass. See `LOCAL_DEV_SETUP.md` and `CROSS_CUTTING_CONSTRAINTS.md` for full context.

---

## Phase 0 — Infrastructure & Tooling

**Estimate: 1 day**

### Files to Create

```
src/lib/firebase.ts          # App init, db + auth exports, emulator connection
src/lib/db-types.ts          # TypeScript interfaces for all RTDB nodes
database.rules.json          # Security rules
firebase.json                # Hosting + emulator config
.firebaserc
.env.example                 # Committed. Contains keys with empty values.
.nvmrc
vitest.config.ts
eslint.config.js
.github/workflows/ci.yml
```

### Tasks

- [ ] Firebase project created (Spark plan). RTDB, Auth (Google), Hosting, Functions enabled.
- [ ] Your uid added manually to `/admins/{uid}` in RTDB console.
- [ ] `firebase.ts`: initialize app, export `db` and `auth`. Connect to emulator when `VITE_USE_EMULATOR=true`.
- [ ] `db-types.ts`: interfaces for `Room`, `Player`, `Team`, `Word`, `GameState`, `LastAction`, `PlayerStats`, `RoomConfig`.
- [ ] `database.rules.json`: admin-only room creation, room-member write access, no client writes to `/admins`, index on `meta/lastActiveAt`.
- [ ] SvelteKit + TypeScript strict mode. `@sveltejs/adapter-static` with `fallback: '200.html'`.
- [ ] Vitest configured. Firebase emulator env var set in vitest config.
- [ ] ESLint + Svelte plugin, `--max-warnings 0`.
- [ ] CI workflow: `lint → typecheck → unit tests with emulator → build`.
- [ ] `package.json` scripts:
  ```json
  {
    "dev": "vite dev",
    "dev:solo": "VITE_DEV_BYPASS_MIN_PLAYERS=true vite dev",
    "emulators": "firebase emulators:start --only database,functions",
    "dev:full": "concurrently \"npm run emulators\" \"npm run dev\"",
    "dev:solo:full": "concurrently \"npm run emulators\" \"npm run dev:solo\"",
    "test": "vitest run --coverage",
    "test:ci": "firebase emulators:exec --only database 'vitest run --coverage'",
    "test:rules": "firebase emulators:exec --only database 'vitest run src/lib/rules.test.ts'",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  }
  ```
- [ ] `firebase deploy --only hosting` succeeds.

### Critical Tests

```
src/lib/rules.test.ts:
  ✓ admin uid can write to /rooms
  ✓ anonymous uid cannot write to /rooms — permission-denied
  ✓ any client cannot write to /admins — permission-denied
  ✓ unauthenticated client can read a room by ID

src/lib/firebase.test.ts:
  ✓ db export is not null
  ✓ when VITE_USE_EMULATOR=true, db host is localhost:9000
```

### Acceptance Criteria

- [ ] `npm run test:ci` passes with zero failures
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0 with strict mode
- [ ] `npm run dev:solo:full` starts without errors; app is reachable at localhost:5173
- [ ] `firebase deploy` produces a reachable HTTPS URL

---

## Phase 1 — Room Creation & Player Join

**Estimate: 2–3 days**

### Files to Create / Modify

```
src/routes/+page.svelte                          # Landing — admin sees Create Game, non-admin sees Join Game
src/routes/room/[roomId]/+page.svelte            # Phase switcher scaffold
src/routes/room/[roomId]/+page.ts                # Load: roomId + playerId resolution
src/lib/auth.ts                                  # isAdmin(), requireAdmin()
src/lib/colors.ts                                # PLAYER_COLORS palette, assignColor()
src/lib/stores/room.ts                           # RTDB subscription: meta + config + status
src/lib/stores/players.ts                        # RTDB subscription: players map
src/components/phases/NameEntry.svelte
```

### Tasks

- [ ] Landing: "Sign in" button that allows admins to authenticate. "Create Game" visible only when `isAdmin()` is true. "Join a game" — text field to enter room ID or paste full invite link + "Join" button, visible to all. Parses room ID from pasted URL automatically.
- [ ] `createRoom()`: generate `roomId` with `nanoid(8)`, write full room node with config defaults.
- [ ] Room config UI: `wordCount`, `numTeams`, `skipPenalty`, `timerDuration`.
- [ ] Invite URL: `/room/{roomId}`. QR code rendered client-side from this URL.
- [ ] `+page.ts` load: read `roomId` from route, `playerId` from `?p=` query param. If player node exists in RTDB → set `reconnecting = true`.
- [ ] Name entry: input → write player node → set `?p={playerId}` in URL without page reload (`replaceState`).
- [ ] `assignColor()`: reads current player colors for room, returns a random unused color from `PLAYER_COLORS`. Throws typed error if all colors exhausted.
- [ ] `onDisconnect(connectedRef).set(false)` registered **before** `set(connectedRef, true)`.
- [ ] `+page.svelte`: renders `NameEntry` when `status === 'word-entry'` and no player node found.

### Critical Tests

```
src/lib/colors.test.ts:
  ✓ assignColor() returns a color not in usedColors
  ✓ assignColor() with full palette used throws a typed PlayerLimitError
  ✓ two concurrent assignColor() calls on same usedColors return different colors

src/lib/auth.test.ts:
  ✓ isAdmin() returns true when uid exists in /admins (emulator)
  ✓ isAdmin() returns false when uid absent from /admins
  ✓ isAdmin() returns false when not authenticated

src/lib/room-creation.test.ts (emulator):
  ✓ createRoom() writes node at /rooms/{roomId} with all required fields and correct defaults
  ✓ createRoom() called without admin auth throws permission-denied
  ✓ generated roomId is 8 characters

src/lib/player-join.test.ts (emulator):
  ✓ joinRoom() writes player node with name, color, connected:true, wordsSubmitted:false, ready:false, teamId:null
  ✓ two concurrent joinRoom() calls on same room assign different colors
  ✓ reconnect with existing playerId reads existing node without overwriting name or color
```

### Acceptance Criteria

- [ ] Admin creates room; receives working invite URL and rendered QR code
- [ ] Three browser tabs join the same emulator room; each gets distinct color; player list updates live
- [ ] Closing a tab: `players/{id}/connected` becomes `false` (verify in emulator UI within 60s)
- [ ] Hard-refresh with `?p={playerId}` in URL: reconnects without showing name entry
- [ ] Non-admin on landing page: no "Create Game" button visible

---

## Phase 2 — Word Entry & Lobby

**Estimate: 2 days**

### Files to Create / Modify

```
src/components/phases/WordEntry.svelte
src/components/phases/Lobby.svelte
src/lib/game/turn.ts                             # initializeGameState()
```

### Tasks

- [ ] Word entry: input + add button. Submitted word list. Submit CTA appears only at `wordCount` threshold.
- [ ] Write each word to `/rooms/{id}/words/{wordId}` on add. Mark `player.wordsSubmitted = true` on Submit.
- [ ] Lobby: N team cards from `config.numTeams`, join button, player count + colored dots per team.
- [ ] Write `player.teamId` on join. Write `player.ready = true` on Ready.
- [ ] Guard: Ready disabled until team selected.
- [ ] Guard: game start blocked unless all players `wordsSubmitted && ready` AND every team has ≥ 2 players.
- [ ] `VITE_DEV_BYPASS_MIN_PLAYERS=true`: bypass both guards above. Applied only in `Lobby.svelte` and `initializeGameState()`. Nowhere else.
- [ ] `initializeGameState()` in `turn.ts`: writes the complete `gameState` node, then writes `status: 'playing'`. Status transitions last.
- [ ] `gameState` contents on init: `hat` (all wordIds), `round: 1`, `phase: 'waiting_start'`, `currentTeamId` (first team), `currentExplainerId` (playerOrder[0] of first team), `playerOrder` per team, all `roundScores` to 0, `currentWordId: null`, `lastAction: null`.
- [ ] `+page.svelte`: render `WordEntry` for `status === 'word-entry'`; `Lobby` for `status === 'pre-start'`.

### Critical Tests

```
src/lib/game/turn.test.ts:
  ✓ initializeGameState() produces hat with length === playerCount × wordCount
  ✓ initializeGameState() sets round:1, phase:'waiting_start', currentWordId:null
  ✓ initializeGameState() assigns currentExplainerId = playerOrder[0] of first team
  ✓ initializeGameState() sets all roundScores to 0
  ✓ initializeGameState() writes status:'playing' only after gameState node is complete
  ✓ initializeGameState() with bypass flag and 1 player per team: succeeds without throwing
  ✓ initializeGameState() without bypass flag and 1 player per team: throws MinPlayersError
```

### Acceptance Criteria

- [ ] Player cannot submit fewer words than `config.wordCount`; Submit button absent
- [ ] `npm run dev:solo:full`: single player can proceed past Lobby and reach game screen
- [ ] `gameState.hat.length === playerCount × config.wordCount` immediately after start (emulator UI)
- [ ] `status` becomes `'playing'` only after `gameState` is fully written (no intermediate routing glitch)
- [ ] All clients transition to game screen within 1 second of each other

---

## Phase 3 — Core Game Turn

**Estimate: 4–5 days. Do not underestimate.**

### Files to Create / Modify

```
src/lib/game/timer.ts                            # getTimeRemaining() pure function
src/lib/game/hat.ts                              # drawWord(), returnWord() — always transactions
src/lib/game/scoring.ts                          # awardPoint(), applyPenalty(), undoLastAction()
src/lib/game/turn.ts                             # advanceTurn(), endTurnEarly()
src/lib/stores/gameState.ts                      # full gameState RTDB subscription
src/components/phases/GameMain.svelte            # observer view
src/components/phases/ExplainerView.svelte       # explainer-only controls
src/components/phases/PostTurn.svelte
src/components/shared/Timer.svelte
src/components/shared/TeamScore.svelte
```

### Tasks

**Timer:**

- [ ] `getTimeRemaining(timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause): number` — pure function, no Firebase calls, no side effects. Clamps to 0.
- [ ] Reactive timer value: `$effect` with `setInterval` (100ms), calls `getTimeRemaining()` each tick.
- [ ] `Timer.svelte`: MM:SS display. Text turns red when `< 10000ms`.

**Explainer turn:**

- [ ] `ExplainerView.svelte` renders only when `gameState.currentExplainerId === myPlayerId`.
- [ ] Start button: writes `timerStartedAt: serverTimestamp()`, `phase: 'explaining'`, calls `drawWord()`.
- [ ] `drawWord()`: `runTransaction` on `gameState.hat` — removes one random wordId atomically, returns it. If hat is empty after draw → caller writes `phase: 'post_turn'`. Never calls `set()` directly on hat.
- [ ] `wordDisplayedAt`: local `Date.now()` recorded when `currentWordId` changes. Not stored in RTDB.
- [ ] Guessed: `awardPoint(activeTeamId)`, increment `playerStats/{id}/wordsExplained`, `drawWord()`, write `lastAction`.
- [ ] Skip: `returnWord(currentWordId)`, `drawWord()`, `applyPenalty()` if configured, write `lastAction`. Disabled when `Date.now() - wordDisplayedAt < 2000` OR `round === 3`.
- [ ] Undo: `undoLastAction()` — reverse score/penalty, return word to hat, set `currentWordId` back to undone word, clear `lastAction`. Throws typed error if `lastAction` is null.

**Timer expiry:**

- [ ] When `timeRemaining <= 0` and `phase === 'explaining'`: check `Date.now() - wordDisplayedAt`.
  - `> 2000` → write `phase: 'post_expiry'`
  - `≤ 2000` → write `phase: 'post_turn'`, `currentWordId: null`
- [ ] `post_expiry` view: word shown, Guessed (+ team selector), Skip.
- [ ] Guessed in post_expiry: `awardPoint(selectedTeamId)`, write `phase: 'post_turn'`.
- [ ] Skip in post_expiry: `returnWord(currentWordId)`, write `phase: 'post_turn'`, `currentWordId: null`.
- [ ] On expiry: `navigator.vibrate(300)` + Web Audio beep (200Hz, 0.3s).

**Post-turn:**

- [ ] `PostTurn.svelte`: count of words guessed this turn by active team.
- [ ] `advanceTurn()`: increment `currentPlayerIndex` mod `playerOrder.length` for current team, select next team round-robin, write `currentTeamId`, `currentExplainerId`, `phase: 'waiting_start'`, `lastAction: null`, `currentWordId: null`.
- [ ] After `advanceTurn()`: if `hat.length === 0` → write `phase: 'round_end'`.

### Critical Tests

```
src/lib/game/timer.test.ts:
  ✓ returns timerDuration when timerStartedAt is null
  ✓ returns correct remaining for known timerStartedAt offset
  ✓ returns timeRemainingAtPause when pausedAt is not null (timer frozen)
  ✓ clamps to 0, never returns negative
  ✓ pause → resume: remaining equals timeRemainingAtPause (within 100ms tolerance)

src/lib/game/hat.test.ts (emulator):
  ✓ drawWord() removes exactly one wordId from hat atomically
  ✓ two concurrent drawWord() calls return different wordIds (race condition test)
  ✓ drawWord() on empty hat returns null, hat unchanged
  ✓ returnWord() adds wordId back to hat
  ✓ returnWord() is idempotent if called twice with same wordId

src/lib/game/scoring.test.ts (emulator):
  ✓ awardPoint() increments team roundScores[currentRound] by 1
  ✓ awardPoint() increments playerStats/wordsExplained by 1
  ✓ applyPenalty() decrements roundScores by 1 when skipPenalty is true
  ✓ applyPenalty() does nothing when skipPenalty is false
  ✓ undoLastAction(type='guessed'): decrements score, returns word to hat, clears lastAction
  ✓ undoLastAction(type='skipped'): reverses penalty if it was applied, returns word to hat
  ✓ undoLastAction() when lastAction is null: throws UndoNotAvailableError

src/lib/game/turn.test.ts:
  ✓ advanceTurn() increments currentPlayerIndex, wraps at playerOrder.length
  ✓ advanceTurn() cycles teams in round-robin (team A → B → A)
  ✓ advanceTurn() correctly resolves currentExplainerId from new index
```

### Acceptance Criteria

- [ ] `npm run dev:solo:full`: full turn cycle playable solo — Start → word → Guessed/Skip/Undo → expiry → post_expiry decision → post_turn → next turn
- [ ] Timer identical (±1s) across 3 simultaneous browser tabs on same emulator room
- [ ] Two rapid Guessed taps never produce duplicate word (verify hat state in emulator UI)
- [ ] Undo after Guessed: score decrements, word returns to hat (verify in emulator), `lastAction` is null
- [ ] Undo after Skip with penalty: score restored, word in hat
- [ ] Skip unclickable for 2s after word appears; unclickable entirely in round 3
- [ ] Hat emptying mid-turn: transitions to `post_turn`, not `post_expiry`
- [ ] Timer expiry: vibration + beep on mobile device (manual test)

---

## Phase 4 — Rounds & Scoreboard

**Estimate: 2 days**

### Files to Create / Modify

```
src/lib/game/turn.ts                             # endRound(), restartGame()
src/components/phases/RoundEnd.svelte
src/components/phases/Scoreboard.svelte
```

### Tasks

- [ ] `RoundEnd.svelte`: rendered when `phase === 'round_end'`. Shows scores. Admin sees "Next Round" / "See Results".
- [ ] `endRound()`: if `round < 3` → refill `hat` from all `/rooms/{id}/words/` IDs, increment `round`, keep `currentTeamId` and `currentPlayerIndex`, write `phase: 'waiting_start'`. If `round === 3` → write `status: 'finished'`. Never resets turn order.
- [ ] `Scoreboard.svelte`: `status === 'finished'`. Team totals = `round1 + round2 + round3`. Per-player `wordsExplained`.
- [ ] `restartGame()`: clears `gameState` node, clears `words`, resets all players' `wordsSubmitted = false` and `ready = false`. Writes `status: 'word-entry'`. Preserves `player.teamId`, `teams.playerOrder`, `teams.currentPlayerIndex`.

### Critical Tests

```
src/lib/game/turn.test.ts (continued):
  ✓ endRound() with round=1: hat length restored to original, round=2, phase='waiting_start'
  ✓ endRound() with round=2: hat restored, round=3
  ✓ endRound() with round=3: status='finished', hat not refilled
  ✓ endRound() preserves currentTeamId and currentPlayerIndex
  ✓ restartGame() removes gameState node
  ✓ restartGame() removes all words nodes
  ✓ restartGame() sets status='word-entry'
  ✓ restartGame() preserves player.teamId and teams.playerOrder
  ✓ playerStats.wordsExplained is not reset by endRound() — accumulates across rounds
```

### Acceptance Criteria

- [ ] Round ends immediately when hat empties (mid-turn path and post-turn path both trigger it)
- [ ] Hat length at start of round 2 and round 3 equals original total word count (emulator UI)
- [ ] Turn order does not reset between rounds (team index and player index preserved)
- [ ] Scoreboard shows mathematically correct totals after a full 3-round game
- [ ] After restart: all players on word-entry screen, team assignments preserved, `words` node empty

---

## Phase 5 — Admin Controls & Disconnect Handling

**Estimate: 2 days**

### Files to Create / Modify

```
src/components/shared/AdminControls.svelte
src/components/shared/DisconnectOverlay.svelte
src/lib/game/turn.ts                             # pauseGame(), resumeGame(), reassignExplainer()
```

### Tasks

- [ ] `AdminControls.svelte`: visible only when `player.isAdmin === true`. Contains Pause/Resume toggle and Change Explainer button.
- [ ] `pauseGame()`: writes `pausedAt: serverTimestamp()`, computes `timeRemainingAtPause = getTimeRemaining(...)` and writes it.
- [ ] `resumeGame()`: writes new `timerStartedAt = serverTimestamp() - (timerDuration - timeRemainingAtPause)`, clears `pausedAt` and `timeRemainingAtPause`.
- [ ] Change Explainer: visible and clickable only when `pausedAt !== null`. Lists `currentTeam.playerOrder` members. Calls `reassignExplainer(newPlayerId)`.
- [ ] `reassignExplainer(newPlayerId)`: validates `newPlayerId` is in `currentTeam.playerOrder`, updates `currentExplainerId` and `currentPlayerIndex`. Throws if not found.
- [ ] `DisconnectOverlay.svelte`: shown on all clients when `players[currentExplainerId].connected === false` AND `phase === 'explaining'`. Admin sees "Reassign Explainer" shortcut.
- [ ] Reconnect: on page load with valid `?p=`, re-register `onDisconnect` then write `connected: true`.
- [ ] Team < 2 connected players: auto-write `pausedAt`, show warning overlay with "Continue anyway" button.
- [ ] `meta/lastActiveAt` updated via `onDisconnect`.

### Critical Tests

```
src/lib/game/turn.test.ts (continued):
  ✓ pauseGame() writes pausedAt as server timestamp
  ✓ pauseGame() writes timeRemainingAtPause within 200ms of expected value
  ✓ resumeGame() clears pausedAt and timeRemainingAtPause
  ✓ resumeGame() sets timerStartedAt such that getTimeRemaining() ≈ timeRemainingAtPause (±200ms)
  ✓ pause → wait 3s (mocked) → resume: getTimeRemaining() unchanged vs before pause
  ✓ reassignExplainer() updates currentExplainerId and currentPlayerIndex correctly
  ✓ reassignExplainer() with playerId not in playerOrder: throws ExplainerNotInTeamError
```

### Acceptance Criteria

- [ ] Admin pauses; timer freezes on all three browser tabs within 1 second
- [ ] Admin resumes; remaining time is identical to pre-pause value (±200ms)
- [ ] Change Explainer button is disabled (not just hidden) while timer is running
- [ ] Change Explainer picker shows only players from `currentTeamId`'s `playerOrder`
- [ ] Closing the explainer's tab: overlay appears on all clients within 60 seconds
- [ ] After reassignment: new explainer sees `ExplainerView` with current word

---

## Phase 6 — Cleanup & Polish

**Estimate: 1–2 days**

### Files to Create / Modify

```
functions/src/index.ts                           # cleanupRooms scheduled function
scripts/seed-emulator.ts                         # dev seed in 4 game states
src/components/phases/GameMain.svelte            # settings icon
```

### Tasks

- [ ] `cleanupRooms`: scheduled every 30 min. Deletes rooms where `meta/lastActiveAt < now - 1hr`.
- [ ] Seed script: writes 4 rooms to emulator in states: `explaining`, `post_expiry`, `round_end`, `finished`. Run with `npx ts-node scripts/seed-emulator.ts`.
- [ ] Settings panel: change display name (any time), switch team (pre-start only).
- [ ] Sound on timer expiry: Web Audio API beep, 200Hz, 300ms.
- [ ] Vibration on timer expiry: `navigator.vibrate(300)`.
- [ ] Mobile viewport pass: all interactive elements ≥ 44px touch target.

### Critical Tests

```
functions/src/cleanup.test.ts (emulator):
  ✓ cleanupRooms() deletes room where lastActiveAt is 2 hours ago
  ✓ cleanupRooms() keeps room where lastActiveAt is 30 minutes ago
  ✓ cleanupRooms() handles empty /rooms node without throwing
```

### Acceptance Criteria

- [ ] `npx ts-node scripts/seed-emulator.ts` creates 4 navigable rooms; no setup clicks needed
- [ ] Cleanup function deletes a test room with `lastActiveAt` set 2 hours in the past (emulator test)
- [ ] No console errors during a full 3-round game in Chrome and Safari mobile
- [ ] All action buttons reachable by right thumb on 390px screen (manual test)

---

## Definition of Done

A complete 3-round game played by 3 real people on 3 real devices, with one mid-game explainer disconnect and reconnect, ending at a correct scoreboard. No console errors. No manual admin intervention required except for the reconnect test.
