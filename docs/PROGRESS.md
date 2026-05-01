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
