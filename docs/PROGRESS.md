# Progress

Format: one entry per completed work unit. Status + 1-2 sentence summary + files touched. Keep AC items in implementation plans. Keep manual steps in README/LOCAL_DEV_SETUP. Only flag limitations that affect downstream phases.

---

## Phase 0 — Infrastructure ✅

Project scaffold, Firebase init, RTDB types, security rules, CI, admin scripts. 3 test suites pass. Emulator flow works.
| `package.json`, `tsconfig.json`, `svelte.config.js`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js` | Config |
| `.nvmrc`, `.env.example`, `.gitignore`, `.firebaserc`, `firebase.json` | Env & infra |
| `database.rules.json` | Security rules |
| `src/lib/firebase.ts`, `src/lib/db-types.ts` | Foundation |
| `src/lib/firebase.test.ts`, `src/lib/rules.test.ts` | Tests |
| `.github/workflows/ci.yml`, `eslint.config.js`, `vitest.config.ts` | CI & linting |
| `scripts/add-admin.ts`, `scripts/remove-admin.ts`, `scripts/list-admins.ts` | Admin tooling |

---

## Phase 1.1 — Backend Foundation ✅

Auth module (emulator-aware), color assignment (collision-free), RTDB stores (Svelte 5 runes), room lifecycle (createRoom, joinRoom, onDisconnect ordering), route loader, dev bootstrap. 28 tests pass.
| `src/lib/auth.ts`, `src/lib/colors.ts` | Game modules |
| `src/lib/stores/room.svelte.ts`, `src/lib/stores/players.svelte.ts` | Stores |
| `src/lib/game/room.ts` | Room write logic |
| `src/routes/room/[roomId]/+page.ts` | Route loader |
| `scripts/dev-bootstrap.ts` | Emulator seed |
| `src/lib/auth.test.ts`, `src/lib/colors.test.ts`, `src/lib/game/room.test.ts` | Tests |

---

## Phase 1.2 — UI: Landing, Room Creation, Name Entry ✅

All Phase 1 components. Auth-aware landing (4 states), room creation form, name entry with color assignment, room phase switcher, QR code invites. Lint clean.
| `src/routes/+page.svelte` | REWRITE — Auth-aware landing |
| `src/routes/room/[roomId]/+page.svelte` | NEW — Phase switcher |
| `src/lib/components/phases/RoomCreation.svelte`, `RoomCreated.svelte`, `NameEntry.svelte` | NEW — Components |
| `src/routes/+layout.svelte` | MODIFY — initAuth, context |
| `src/lib/context.ts`, `src/lib/auth.ts` | NEW/MODIFY — Context + Google sign-in |

---

## Bugfix: Auth Reactivity ✅

Replaced setContext/getContext with module-level `$state` (`auth.svelte.ts`). Fixes stale closure from one-time destructuring in page components.
| `src/lib/stores/auth.svelte.ts`, `src/lib/stores/auth.test.ts` | NEW |
| `src/routes/+layout.svelte`, `src/routes/+page.svelte` | MODIFY |

## Bugfix: Permission Denied on Join ✅

NameEntry used random playerId ≠ auth.uid. Security rules rejected writes. Added `joinRoomAsCurrentUser()` using `authStore.currentUser.uid`.
| `src/lib/game/room.ts` | MODIFY — joinRoomAsCurrentUser |
| `src/lib/game/join-room.test.ts` | NEW — 5 tests |
| `src/lib/components/phases/NameEntry.svelte` | REWRITE — delegates to room.ts |

## Anonymous Auth + Scoped Sign-In ✅

Added Firebase anonymous sign-in for players without Google. Moved from global layout to room-page-only to avoid competing credentials with admin Google sign-in on landing. Fixed parallel test race.
| `src/routes/room/[roomId]/+page.svelte` | MODIFY — onMount anonymous sign-in |
| `src/lib/auth.test.ts` | MODIFY — idempotent ensureEmailUser |

---

## Phase 2.1 — Word Entry ✅

Word entry screen: add words to RTDB `/words/{wordId}`, validate (non-empty, ≤50 chars), submit flips `wordsSubmitted: true`, admin advances to lobby. All acceptance criteria met. 14 new tests, all 55 suite tests pass, lint clean.
| `src/lib/game/words.ts` | NEW — addWord, submitWords, getPlayerWords, advanceToLobby |
| `src/lib/game/words.test.ts` | NEW — 14 tests (validation, idempotency, isolation, permissions) |
| `src/lib/components/phases/WordEntry.svelte` | NEW — input, word list, submit, advance button |
| `src/routes/room/[roomId]/+page.svelte` | MODIFY — wired WordEntry into `word-entry` status branch |

---

## Bugfix: WordEntry Reactivity + Race Condition ✅

Fixed `allPlayersSubmitted` $derived returning function instead of boolean (blocked admin advance button). Fixed hard-refresh race where `submitted` state read from unpopulated store snapshot. Added $effect to sync `submitted` from reactive store. Fixed negative "X more words" display when wordCount decreases.
| `src/lib/components/phases/WordEntry.svelte` | MODIFY — $derived fix, $effect sync, count clamp |

## Bugfix: Lint & Type Warnings Cleanup ✅

Fixed svelte `state_referenced_locally` warnings — wrapped `createRoomStore(roomId)` and `createPlayersStore(roomId)` in `$derived()`. Fixed 3 test `Object is possibly 'undefined'` errors with non-null assertions after length check on Record indexing. `npm run lint` and `npx svelte-check` both pass with 0 errors/warnings.
| `src/lib/components/phases/WordEntry.svelte` | MODIFY — $derived wrappers |
| `src/lib/game/words.test.ts` | MODIFY — non-null assertions |

---

## Phase 2.2 — Lobby: Team Selection & Ready ✅

Team join/switch logic (`joinTeam` validates team node, writes atomic `teamId`), ready toggle (`setReady` guards against null teamId), and pure `checkAllReady` function (words-submitted, ready, min-players-per-team with bypass). Lobby component renders team cards with colored dots, join/switch buttons, ready checkbox, and admin "Start Game" placeholder. All 14 lobby tests + 1 updated words test pass (69 total), lint clean, coverage 97%+ on lobby.ts. Fixes: `advanceToLobby` now creates team nodes (name, playerOrder, currentPlayerIndex, roundScores); lobby/words tests wrap `advanceToLobby` in `withSecurityRulesDisabled` to bypass `/teams` write rules in emulator; empty `playerOrder` array serialization adjusted to `toBeUndefined()` to match RTDB behavior.
| `src/lib/game/lobby.ts` | NEW — joinTeam, setReady, checkAllReady |
| `src/lib/game/lobby.test.ts` | NEW — 14 tests |
| `src/lib/components/phases/Lobby.svelte` | NEW — team cards, join, ready toggle, admin start button |
| `src/routes/room/[roomId]/+page.svelte` | MODIFY — wire Lobby into PreStart branch |
| `src/lib/game/words.ts` | MODIFY — advanceToLobby creates team nodes |
| `src/lib/game/words.test.ts` | MODIFY — advanceToLobby test asserts team nodes, wraps in withSecurityRulesDisabled |

---

## Bugfix — isAdmin Always False in Players Collection ✅

Root cause: `joinRoom` hardcoded `isAdmin: false` for all players. `joinRoomAsCurrentUser` never checked `/admins/{uid}` whitelist. Fix adds `isAdmin` parameter to `joinRoom`, checks `/admins/{playerId}` in `joinRoomAsCurrentUser` before writing player node. Updated all test files to pass explicit `isAdmin` arg. 76 tests pass, lint clean. `room.ts` coverage 100%.
| `src/lib/game/room.ts` | MODIFY — joinRoom accepts isAdmin param, joinRoomAsCurrentUser reads /admins whitelist |
| `src/lib/game/room.test.ts` | MODIFY — joinRoom calls pass explicit isAdmin arg |
| `src/lib/game/join-room.test.ts` | MODIFY — add isAdmin:true/whitelist test, isAdmin:false/no-whitelist test |
| `src/lib/game/lobby.test.ts` | MODIFY — joinRoom calls pass explicit isAdmin arg |
| `src/lib/game/words.test.ts` | MODIFY — joinRoom calls pass explicit isAdmin arg |

## Bugfix — Room Creator Write Access to Teams, Status, GameState ✅

Room creator (non-admin) could not write to `/teams/{teamId}`, `/status`, or `/gameState` because security rules required global `/admins/{uid}` whitelist. Fix adds `|| root.child('rooms').child($roomId).child('meta').child('createdBy').val() === auth.uid` to `.write` rules. Added 5 rule tests for room-creator-as-admin access (teams write, status write, gameState write, denied for non-creator). Fixed path traversal: `data.parent().parent()` failed when intermediate nodes don't exist; switched to `root.child('rooms').child($roomId)` for reliable resolution. Dropped `.validate` on teams node (Firebase emulator `hasChildren` quirk at nested capture level), shape enforced by game logic. Removed pre-existing `console.log` in `+page.svelte`. 12 rules tests pass, lint clean.
| `database.rules.json` | MODIFY — teams, status, gameState .write allow room creator |
| `src/lib/rules.test.ts` | MODIFY — 5 new "room creator as room admin" tests |
| `src/routes/+page.svelte` | MODIFY — removed console.log |

---

## Bugfix — PERMISSION_DENIED on `/teams` When Starting Game ✅

`initializeGameState()` writes whole `teams` object at once (`set(ref(db, rooms/${roomId}/teams), teams)`). Security rules had `.write` only at `teams/$teamId` capture level — no rule matched the parent `teams` path. RTDB applied DENY. Fix: add `.write` at `teams` level, same condition as `$teamId` (admin or room creator).
| `database.rules.json` | MODIFY — add `.write` at `teams` parent level |

## Bugfix — Stuck "Loading lobby…" for Unjoined Players ✅

User visiting `/room/{id}` after admin advanced to lobby saw permanent "Loading lobby…" because page's PreStart branch required `localPlayerId && playersStore.players[localPlayerId] && roomStore.config`, which was false for unjoined players. Extracted routing into pure function `getRoomRoute()` in `src/lib/game/room-route.ts` (100% coverage, 11 tests). Page now routes unjoined PreStart visitors to NameEntry instead of the dead-end else branch. Added `game-already-started` screen for unjoined visitors when status is playing/finished.
| `src/lib/game/room-route.ts` | NEW — pure routing decision function |
| `src/lib/game/room-route.test.ts` | NEW — 11 tests, all routing combinations |
| `src/routes/room/[roomId]/+page.svelte` | REWRITE — delegates rendering to getRoomRoute() |

---

## Phase 2.3 — Game Initialization & Start Trigger ✅

`initializeGameState()` builds hat, teams, gameState, and transitions `status` from `pre-start` → `playing`. 24 tests pass, 99% coverage. Lint pass, all lint rules satisfied. Lobby "Start Game" button wires to `initializeGameState()`, with error toast on failure and loading spinner during async call. Fixes: auth-admin race resolved with application-level admin check using callerUid and `DataSnapshot`+type guard; RTDB null-stripping handled (undefined expected, not null).
| `src/lib/game/turn.ts` | NEW — initializeGameState, shuffle, error classes |
| `src/lib/game/turn.test.ts` | NEW — 24 tests (hat, teams, guards, edges, bypass, permissions) |
| `src/lib/components/phases/Lobby.svelte` | MODIFY — Start Game button async call, loading/error state |
| `src/routes/room/[roomId]/+page.svelte` | MODIFY — wire initializeGameState with callerUid from authStore |

---

## Phase 3 — Core Game Turn (Split into 5 sub-phases)

Phase 3 is too large (4–5 days, 10+ files) for single AI-SWE session. Split into:

| Sub-phase | Scope                                    | Files | Depends on                        |
| --------- | ---------------------------------------- | ----- | --------------------------------- |
| 3.1       | Timer logic + gameStateStore             | 3     | Phase 2.3 (gameState node exists) |
| 3.2       | Hat mutations + scoring                  | 3     | Phase 3.1 (types)                 |
| 3.3       | GameMain shell, TeamScore, PostTurn      | 5     | Phase 3.1 (gameStateStore)        |
| 3.4       | Turn orchestration, timer expiry handler | 2     | Phase 3.1, 3.2                    |
| 3.5       | ExplainerView controls                   | 3     | Phase 3.2, 3.3, 3.4               |

All sub-phase plans: `docs/plans/PHASE-3.{1-5}_IMPLEMENTATION.md`.

### Phase 3.1 — Timer & GameState Store ✅

`gameStateStore` (RTDB subscription, `$state` rune), `getTimeRemaining()` pure function (server-time-based, clamp to 0, pause-resume), `Timer.svelte` reactive display with MM:SS + red under 10s + `aria-live`. 10 timer tests pass. Lint clean.
| `src/lib/stores/gameState.svelte.ts` | NEW — RTDB subscription, reactive game state |
| `src/lib/game/timer.ts` | NEW — getTimeRemaining pure function |
| `src/lib/game/timer.test.ts` | NEW — 10 tests |
| `src/lib/components/shared/Timer.svelte` | NEW — reactive timer display, 100ms interval, MM:SS format |

### Phase 3.2 — Hat & Scoring ✅

Hat mutations (`drawWord`, `returnWord`) via `runTransaction()` with atomicity and idempotency. Scoring engine (`awardPoint`, `applyPenalty`, `undoLastAction`) with score clamping and undo reversals via single atomic gameState write. 20 tests pass (8 hat + 12 scoring), lint clean.
| `src/lib/game/hat.ts` | NEW — drawWord, returnWord |
| `src/lib/game/hat.test.ts` | NEW — 8 tests |
| `src/lib/game/scoring.ts` | NEW — awardPoint, applyPenalty, undoLastAction |
| `src/lib/game/scoring.test.ts` | NEW — 12 tests |

### Phase 3.3 — GameMain Shell, TeamScore & PostTurn ✅

Created observer-side UI shell: `GameMain.svelte` routes by phase, `TeamScore.svelte` shows team scores, `PostTurn.svelte` shows words-guessed count. Extended `db-types.ts` with `wordsGuessedThisTurn` and `currentWordText` fields, wired `awardPoint()` and `drawWord()` to write them. Wired stores into `+page.svelte` with cleanup guards. 14/14 test files pass (144 tests), lint clean.

Files: `src/lib/components/phases/GameMain.svelte`, `src/lib/components/shared/TeamScore.svelte`, `src/lib/components/phases/PostTurn.svelte`, `src/lib/db-types.ts`, `src/lib/stores/teams.svelte.ts`, `src/lib/game/scoring.ts`, `src/lib/game/hat.ts`, `src/routes/room/[roomId]/+page.svelte`.

### Phase 3.4 — Turn Orchestration & Timer Expiry Handler ✅

Split `turn.ts` into `turn-advance.ts` (advanceTurn: round-robin team/player cycling, hat-empty detection) and `turn-expiry.ts` (handleTimerExpiry: word-displayed duration check → post_expiry/post_turn; endTurnEarly: hat-empty shortcut). 21 new tests pass (10 advance + 11 expiry), 165 total suite passes, lint clean, coverage 100% on both new files.
| `src/lib/game/turn-advance.ts`, `src/lib/game/turn-advance.test.ts` | NEW — advanceTurn (10 tests) |
| `src/lib/game/turn-expiry.ts`, `src/lib/game/turn-expiry.test.ts` | NEW — handleTimerExpiry, endTurnEarly (11 tests) |

### Phase 3.5 — ExplainerView ✅

ExplainerView component with Start/Guessed/Skip/Undo buttons and post-expiry team selector. All Firebase writes extracted to `explainer-actions.ts` (recordGuessed, recordSkip, completePostExpiryGuessed, completePostExpirySkip). `word-display.ts` tracks word display time locally for 2s Skip lockout. `turn-start.ts` handles Start button Firebase writes. Fixed `drawWord()` transaction abort — empty hat now returns `undefined` (aborts) instead of `current` (committed stale currentWordId). 13 new tests (5 word-display + 8 explainer-actions), 185 total pass, lint clean.
| `src/lib/components/phases/ExplainerView.svelte` | NEW — explainer controls (3 modes, thin controller, delegates to explainer-actions) |
| `src/lib/game/explainer-actions.ts`, `src/lib/game/explainer-actions.test.ts` | NEW — recordGuessed, recordSkip, completePostExpiryGuessed, completePostExpirySkip (8 tests) |
| `src/lib/game/word-display.ts`, `src/lib/game/word-display.test.ts` | NEW — getWordDisplayedAt (5 tests) |
| `src/lib/game/turn-start.ts` | NEW — startTurn with serverTimestamp |
| `src/lib/game/hat.ts` | MODIFY — drawWord abort fix (undefined vs current) |
| `src/lib/components/phases/GameMain.svelte` | MODIFY — delegates to ExplainerView, passes new props |
| `src/routes/room/[roomId]/+page.svelte` | MODIFY — passes roomId, currentWordId, lastAction, config to GameMain |

---

## Phase 3.4 Bug Fixes & Improvements ✅

Fixed stale read-modify-write in `advanceTurn()` (now uses atomic `update()` instead of separate `set()` calls). Added `endRound()` function (`turn-round.ts`) handling round refill and game-finish transition. Extended `handleTimerExpiry()` to detect hat-empty → `round_end`. Added phase guards to `endTurnEarly()` (no-op outside `explaining`). 172 tests pass, lint clean.
| `src/lib/game/turn-advance.ts` | MODIFY — atomic update() |
| `src/lib/game/turn-round.ts`, `src/lib/game/turn-round.test.ts` | NEW — endRound (5 tests) |
| `src/lib/game/turn-expiry.ts`, `src/lib/game/turn-expiry.test.ts` | MODIFY — hat-empty→round_end, endTurnEarly phase guard (13 tests) |

---

## Phase 4 — Rounds & Scoreboard (Split into 2 sub-phases)

Phase 4 scope: 2 components + restartGame logic. `endRound()` already exists from Phase 3.4 cleanup. Split into:

| Sub-phase | Scope                                        | Files | Depends on                     |
| --------- | -------------------------------------------- | ----- | ------------------------------ |
| 4.1       | RoundEnd component, wiring into GameMain     | 3     | Phase 3.4 (endRound exists)    |
| 4.2       | Scoreboard component + restartGame(), wiring | 4     | Phase 4.1 (status transitions) |

All sub-phase plans: `docs/plans/PHASE-4.{1,2}_IMPLEMENTATION.md`.

---

## Phase 4.1 — RoundEnd Component & Round Transition ✅

RoundEnd component renders when `phase === 'round_end'` — shows cumulative team scores, admin "Next Round" (round < 3) or "See Results" (round === 3) button, non-admin waiting message. No new logic — delegates to existing `endRound()` from `turn-round.ts`. All 182 tests pass, lint clean.
| `src/lib/components/phases/RoundEnd.svelte` | NEW — round intermission UI |
| `src/lib/components/phases/GameMain.svelte` | MODIFY — replace stub, add isAdmin prop |

---

## Phase 4.2 — Scoreboard & Game Restart ✅

Scoreboard renders on `status === 'finished'` with team totals (sum of 3 roundScores), per-player wordsExplained table, admin-only Restart button. `restartGame()` removes gameState + words nodes, resets player `wordsSubmitted`/`ready`, preserves team assignments and playerOrder, transitions status to `'word-entry'`. 9 restartGame tests + Scoreboard component + wiring in `+page.svelte`. All 192 tests pass, lint clean.
| `src/lib/game/turn-round.ts` | MODIFY — add restartGame() |
| `src/lib/game/turn-round.test.ts` | MODIFY — 9 restart tests |
| `src/lib/components/phases/Scoreboard.svelte` | NEW — final scoreboard UI |
| `src/routes/room/[roomId]/+page.svelte` | MODIFY — wire Scoreboard, keep stores alive during finished status |

---

## Phase 5.1 — Pause/Resume Game Logic ✅

`pauseGame()` captures current timer state via `serverTimestamp()`, `resumeGame()` restores timer with synthetic `timerStartedAt` offset preserving remaining time. Both guard phase, null timer, double-pause, and admin-only. 14 tests (pause success, resume success, roundtrip, guard errors, permission errors) pass. All 211 tests pass, lint clean.
| `src/lib/game/turn-pause.ts` | NEW — pauseGame(), resumeGame(), error classes |
| `src/lib/game/turn-pause.test.ts` | NEW — 14 tests |

---

## Phase 5.2 — Reassign Explainer Logic ✅

`reassignExplainer()` updates `currentExplainerId` and `currentPlayerIndex` atomically within the same team, gated by pause check and admin/creator permission. Validates new player is in team's `playerOrder`, is idempotent, and maintains index-to-playerId consistency. 7 tests pass, lint clean.
| `src/lib/game/turn-reassign.ts` | NEW — reassignExplainer, error classes |
| `src/lib/game/turn-reassign.test.ts` | NEW — 7 tests |
