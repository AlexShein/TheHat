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
