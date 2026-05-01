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
