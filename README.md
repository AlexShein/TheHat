# 🎩 The Hat (Шляпа)

[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-RTDB-DD2C00?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/test-vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Real-time multiplayer word-guessing party game for mobile. Players split into teams, explain words from a virtual hat, and compete across three rounds. Built for a private group of friends (~5–16 players).

---

## Table of Contents

- [How to Play](#how-to-play)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Admin Management](#admin-management)
- [Development](#development)
- [CI/CD](#cicd)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## How to Play

The Hat (Шляпа) is a classic party word-guessing game played in three rounds with the same set of words.

1. **Word Entry** — Every player submits words (e.g., 5 each). All words go into a shared "hat."
2. **Round 1 — Explain Freely** — Use any words to describe the target word. No gestures, no translations.
3. **Round 2 — Pantomime** — No words at all. Act it out.
4. **Round 3 — One Word** — Explain using only ONE word. Teammates guess from that single hint.

Each turn, one player explains while their team guesses. Timer counts down. Correct guesses score points. Hat empties → round ends. Three rounds → scoreboard shows the winner.

**Roles:**

| Role       | Capabilities                                                               |
| ---------- | -------------------------------------------------------------------------- |
| **Admin**  | Creates rooms, pauses timer, reassigns explainer. Google sign-in required. |
| **Player** | Joins via link. No auth needed. Enters name, picks team, plays.            |

---

## Features

- **Real-time multiplayer** — Firebase RTDB syncs game state across all clients
- **Mobile-first** — Touch targets ≥ 44px, works on any screen size
- **Atomic word drawing** — Transactions prevent two players from drawing the same word
- **Server-synced timer** — Firebase server timestamps eliminate clock drift
- **Admin controls** — Pause, change explainer, restart game
- **Team rotation** — Round-robin turn order preserved across rounds
- **Skip penalty** — Optional -1 point for skipped words (skipping is disabled in round 3)
- **Undo** — Revert last action during a turn
- **Scoreboard** — Per-team scores + per-player words-explained stats
- **QR code invites** — Generate shareable invite links

---

## Tech Stack

| Layer     | Technology                   |
| --------- | ---------------------------- |
| Framework | SvelteKit + Svelte 5 (runes) |
| Language  | TypeScript 5.7               |
| Database  | Firebase Realtime Database   |
| Auth      | Firebase Auth (Google)       |
| Styling   | Tailwind CSS 3.4             |
| Testing   | Vitest + Firebase Emulators  |
| Hosting   | Firebase Hosting (static)    |
| CI/CD     | GitHub Actions               |

**Why RTDB over Firestore?** RTDB bills by data transferred, not operations — cheaper for high-frequency game state updates. Firestore would bill per read/write (10–20 ops/min per client).

**Why no backend?** All game logic runs client-side. RTDB transactions provide atomicity. Only server-side code is one scheduled Cloud Function for room cleanup.

---

## Project Structure

```
src/
├── lib/
│   ├── firebase.ts              # Firebase app init, db/auth exports
│   ├── db-types.ts              # TypeScript interfaces for all RTDB nodes
│   ├── auth.ts                  # Admin auth helpers
│   ├── colors.ts                # Player color assignment (collision-free)
│   ├── team-colors.ts           # Team identity colors
│   ├── context.ts               # Svelte context keys
│   ├── game/                    # Game logic (no UI)
│   │   ├── hat.ts               # Word drawing/returning transactions
│   │   ├── timer.ts             # Timer math (server-timestamp based)
│   │   ├── turn.ts              # Turn advancement, rotations
│   │   ├── turn-start.ts        # Turn initialization
│   │   ├── turn-advance.ts      # Post-turn transitions
│   │   ├── turn-expiry.ts       # Timer expiry handling
│   │   ├── turn-round.ts        # Round end/refill logic
│   │   ├── scoring.ts           # Score computation
│   │   ├── explainer-actions.ts # Guessed/Skip/Undo actions
│   │   ├── word-display.ts      # Word visibility timing
│   │   ├── words.ts             # Word submission helpers
│   │   ├── room.ts              # Room creation
│   │   ├── room-route.ts        # Room join/route helpers
│   │   ├── join-room.ts         # Player join logic
│   │   └── lobby.ts             # Lobby/ready logic
│   ├── stores/                  # Svelte 5 reactive stores (RTDB subscriptions)
│   │   ├── auth.svelte.ts       # Auth state
│   │   ├── gameState.svelte.ts  # gameState node subscription
│   │   ├── players.svelte.ts    # players map subscription
│   │   ├── room.svelte.ts       # room meta/config subscription
│   │   └── teams.svelte.ts      # teams subscription
│   └── components/
│       ├── phases/              # Game phase screens
│       │   ├── NameEntry.svelte
│       │   ├── WordEntry.svelte
│       │   ├── Lobby.svelte
│       │   ├── GameMain.svelte
│       │   ├── ExplainerView.svelte
│       │   ├── PostTurn.svelte
│       │   ├── RoundEnd.svelte
│       │   ├── Scoreboard.svelte
│       │   ├── RoomCreation.svelte
│       │   └── RoomCreated.svelte
│       └── shared/              # Reusable components
│           ├── Timer.svelte
│           └── TeamScore.svelte
├── routes/
│   ├── +page.svelte             # Landing page
│   └── room/[roomId]/
│       ├── +page.svelte         # Phase switcher (main game route)
│       └── +page.ts             # URL param parsing
└── app.css                      # Global styles, Tailwind imports
```

---

## Getting Started

### Prerequisites

- Node.js == 25
- Firebase project with RTDB and Google Auth enabled
- Service account key for admin scripts

### Setup

```bash
git clone git@github.com:AlexShein/TheHat.git
cd TheHat
npm install
```

Copy `.env.example` to `.env` and configure:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app
VITE_USE_EMULATOR=true  # true for local dev, false for production
```

### Run Locally

```bash
# Start Firebase emulators + dev server with solo mode
npm run dev:solo:full

# Or start them separately
npm run emulators        # Firebase emulators (RTDB + Auth)
npm run dev:solo         # Dev server with min-player bypass
```

App runs at `http://localhost:5173`.

---

## Admin Management

Admins are stored in RTDB at `/admins/{uid}: true`. Three scripts in `scripts/` manage admins without the Firebase Console.

### Prerequisites

1. **Service account key:** Download from [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → Generate new private key. Save as `service-account.json` in the project root (git-ignored).
2. **Database URL:** From Firebase Console → Realtime Database → Data tab (e.g., `https://the-word-guessing-game-default-rtdb.europe-west1.firebasedatabase.app`).

### Setup (one-time)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"
export FIREBASE_DATABASE_URL="https://YOUR-PROJECT-default-rtdb.REGION.firebasedatabase.app"
```

### Commands

```bash
npx tsx scripts/list-admins.ts              # List current admins
npx tsx scripts/add-admin.ts friend@gmail.com   # Add admin by email
npx tsx scripts/remove-admin.ts friend@gmail.com # Remove admin by email
```

### First Admin Setup

Before running admin scripts, add your own UID manually once:

1. Sign in to the app locally with Google.
2. Open DevTools → Application → Session Storage → copy `firebase:authUser` UID.
3. In Firebase Console → Realtime Database → add `/admins/{YOUR_UID}` with value `true`.
4. Deploy rules: `firebase deploy --only database`.

After this, use `scripts/add-admin.ts` for everyone else.

---

## Development

### Scripts

| Command                 | Description                                   |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Start dev server                              |
| `npm run dev:solo`      | Dev server with min-player bypass             |
| `npm run emulators`     | Firebase emulators (RTDB + Auth)              |
| `npm run dev:solo:full` | Emulators + dev server + bypass (one command) |
| `npm run dev:bootstrap` | Seed emulator data (test users)               |
| `npm test`              | Run all tests with Firebase emulators         |
| `npm run test:watch`    | Vitest in watch mode                          |
| `npm run test:rules`    | RTDB security rules tests only                |
| `npm run lint`          | ESLint + svelte-check + TypeScript            |
| `npm run typecheck`     | svelte-check + tsc --noEmit                   |
| `npm run build`         | Production build                              |

### Solo Testing

Set `VITE_DEV_BYPASS_MIN_PLAYERS=true` (or use `npm run dev:solo`) to bypass:

- Minimum 2 players per team requirement
- All-players-ready gate

This flag only affects `Lobby.svelte` and game initialization. Never true in production.

### Running Tests

All tests run against Firebase emulators — never against production:

```bash
npm test
```

Tests use Vitest with `@firebase/rules-unit-testing`. Coverage reports generated automatically.

---

## CI/CD

GitHub Actions workflow on PR and push to `main`:

1. **lint-and-typecheck** — ESLint, svelte-check, TypeScript. Must pass with zero warnings.
2. **unit-tests** — Vitest with Firebase emulators.
3. **firebase-rules** — RTDB security rules validation.
4. **build** — Production build + bundle-size gate (non-blocking, ≤ 1024 KB).

All checks complete under 4 minutes.

---

## Documentation

| Document                                                         | Description                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| [PRD](./docs/PRD.md)                                             | Product requirements and game flow                       |
| [Architecture](./docs/ARCHITECTURE.md)                           | Technical architecture and key decisions                 |
| [Design Brief](./docs/DESIGN_BRIEF.md)                           | Visual design direction                                  |
| [Data Schema](./docs/DATA_SCHEMA.md)                             | RTDB node shapes and relationships                       |
| [Constraints](./docs/CONSTRAINTS.md)                             | AI development rules (Svelte 5 runes, Firebase patterns) |
| [Cross-Cutting Constraints](./docs/CROSS_CUTTING_CONSTRAINTS.md) | Invariants and phase-to-phase dependencies               |
| [Progress](./docs/PROGRESS.md)                                   | Implementation status tracker                            |
| [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)             | Phase-by-phase development plan                          |
| [Readiness Checklist](./docs/READINESS_CHECKLIST.md)             | Pre-launch verification items                            |
| [Local Dev Setup](./docs/LOCAL_DEV_SETUP.md)                     | Detailed local environment configuration                 |
| [Design System](./DESIGN.md)                                     | Brand colors, typography, components                     |

---

## Contributing

This is a personal project for a private group of friends. No public contribution process at this time.

If you find a bug or have a suggestion, open an issue on GitHub.

---

## License

MIT — see [LICENSE](./LICENSE) file.
