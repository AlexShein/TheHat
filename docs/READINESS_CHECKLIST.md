# Pre-Development Readiness Checklist

Complete every item before writing production code. Each item either unblocks development or prevents a class of problem that is expensive to fix mid-build.

---

## Firebase Project Setup

- [ ] Firebase project created (Spark plan)
- [ ] Realtime Database provisioned, region selected (choose closest to your users — europe-west1 for Finland)
- [ ] Google Auth provider enabled in Firebase Console
- [ ] Your Google account UID added to `/admins/{uid}` manually in RTDB console
- [ ] `database.rules.json` committed with initial rules (not open `true/true`)
- [ ] RTDB index for `meta/lastActiveAt` added to rules file
- [ ] Firebase CLI installed and authenticated (`firebase login`)
- [ ] `firebase use --add` run, project linked

## Repository & Tooling

- [ ] Git repo created, `.gitignore` includes `.env.local`, `build/`, `.firebase/`
- [ ] `.nvmrc` committed with Node version
- [ ] `package.json` scripts defined (see LOCAL_DEV_SETUP.md)
- [ ] ESLint configured with TypeScript + Svelte plugins
- [ ] `tsconfig.json` with `strict: true`
- [ ] Prettier configured (optional but AI generates inconsistent formatting)
- [ ] `.env.example` committed, `.env.local` populated and gitignored

## Firebase Emulator

- [ ] Java 11+ installed locally
- [ ] `firebase init emulators` run, `firebase.json` emulator config committed
- [ ] `npm run emulators` starts successfully
- [ ] `firebase.ts` uses `connectDatabaseEmulator` when `VITE_USE_EMULATOR=true`
- [ ] Emulator UI accessible at localhost:4000

## SvelteKit

- [ ] SvelteKit project initialized with TypeScript
- [ ] `@sveltejs/adapter-static` installed, configured with `fallback: '200.html'`
- [ ] `firebase.json` hosting configured to serve from `build/`
- [ ] `npm run build && firebase deploy --only hosting` works end-to-end

## Testing Foundation

- [ ] Vitest installed and configured
- [ ] `@firebase/rules-unit-testing` installed
- [ ] At least one smoke test exists and passes: `npm test`
- [ ] `npm run test` (with emulator lifecycle) works
- [ ] Coverage thresholds configured in `vitest.config.ts`

## CI

- [ ] GitHub Actions workflow file committed (`.github/workflows/ci.yml`)
- [ ] GitHub Secrets populated: all `VITE_FIREBASE_*` vars + `FIREBASE_TOKEN`
- [ ] Branch protection rules enabled on `main`
- [ ] First CI run passes on `main`

## Design

- [ ] Stitch mockups reviewed and accepted (or wireframes sufficient to start)
- [ ] Tailwind CSS installed and configured
- [ ] Typography scale decided (base size, heading sizes)
- [ ] Team color palette finalized (at minimum 4 colors defined in `lib/colors.ts`)
- [ ] Touch target size verified in browser DevTools mobile simulation

## Documentation

- [ ] All 7 PRD questions answered ✅ (done)
- [ ] `CONSTRAINTS.md` committed and referenced in `.clinerules`
- [ ] `LOCAL_DEV_SETUP.md` walkthrough completed successfully by at least one person

## Game Logic Clarity (before Phase 3)

- [ ] State machine diagram drawn (even on paper) for `gameState.phase` transitions
- [ ] Timer pause/resume math verified by hand with example timestamps
- [ ] Hat transaction behavior understood: what happens on concurrent access in emulator

---

## What Can Wait

These are explicitly deferred — do not implement before the item above that unblocks them:

| Item                              | Wait for                |
| --------------------------------- | ----------------------- |
| Sound/vibration on timer          | Phase 3 complete        |
| QR code generation                | Phase 1 (room creation) |
| Settings panel (name/team change) | Phase 5                 |
| Cloud Function (cleanup)          | Phase 6                 |
| Bundle size CI job                | First clean build       |
| E2E tests (Playwright)            | Post-MVP                |
