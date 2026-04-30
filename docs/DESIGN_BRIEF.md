# Design Task: Hat Game UI Mockups (Google Stitch)

## Product Summary

A mobile-first real-time party game app. Players are in the same room, holding their phones. The UI must be operable one-handed, readable in poor lighting, and forgiving of accidental taps (the undo action is a first-class feature, not an afterthought).

---

## Design Principles

- **Clarity over cleverness.** Every screen has one primary action. Secondary actions are visually subordinate.
- **Undo is sacred.** The "undo last action" button must be visually prominent, always reachable with a thumb, and impossible to confuse with other actions.
- **Touch-first.** All interactive targets ≥ 44px. No hover states. No tiny controls.
- **Team identity through color.** Each team has a color. That color appears on scoreboards, highlights, and active-turn indicators. Players also have personal colors (smaller dot/avatar).
- **Calm timer.** The timer counts down for everyone. It should feel present but not anxiety-inducing — until the last 10 seconds, where urgency is appropriate.

---

## Visual Style

- **Aesthetic:** Minimalist, modern, human. Think Linear or Notion's typography discipline applied to a game. Not playful/cartoon — clean and readable.
- **Color mode:** Light background, high contrast. Team colors are the primary chromatic elements.
- **Typography:** Single typeface, 2 weights (regular + bold). Large type for the current word being explained (the most important element in the game).
- **Spacing:** Generous. This is used in social settings, often glanced at quickly.
- **Iconography:** Minimal. Only where a symbol is universally understood (✓, ✕, ↩). Never decorative icons.

---

## Screens to Mockup

### Screen 1: Name Entry
- Single text field: "Your name"
- Confirm button (primary, full-width)
- Room name shown at top (e.g. "Room: xK9mP2qL")
- No logo, no clutter

### Screen 2: Word Entry
- Header: "Add your words (3/5)" — counter updates live
- Text input + Add button
- List of submitted words below (simple list, with a subtle remove option per word)
- Primary CTA: "Done" — appears only when count is met, full-width, prominent

### Screen 3: Team Selection Lobby
- Header: "Choose your team"
- 2–4 team cards, each showing: team color stripe, team name, player avatars (colored dots + names)
- Join button on each card
- Status bar: "Waiting for 2 more players..." 
- Ready button (appears once you've selected a team)
- Admin-only: "Start Game" — only enabled when all players are ready

### Screen 4: Game Main — Waiting (non-explainer view)
- Top bar: Round 1 of 3 | Words left: 24
- Center: Large countdown timer (inactive, dimmed)
- Active explainer's name prominently displayed: "Maria is explaining..."
- Below timer: Team scores — active team block highlighted with team color
- Scores minimal: "Team A: 7 | Team B: 5"

### Screen 5: Game Main — Explainer's Turn (waiting to start)
- Timer (large, 1:00, not running)
- "It's your turn" — clear, centered
- **START** — single large primary button, full-width, hard to miss

### Screen 6: Active Explaining View (most critical screen)
**Layout (top to bottom):**
- Small timer countdown — turns red in last 10 seconds
- Current word — LARGE, bold, centered. This is the most important element.
- **GUESSED ✓** — large green button, left half or top position
- **SKIP ✕** — large red/muted button, right half or below. Visually de-emphasized vs Guessed. Greyed out for first 2 seconds.
- **↩ Undo** — below both, full-width but smaller height. Neutral color (not red, not green). Label: "Undo last action"

> Key constraint: Guessed and Skip must not be adjacent in a way that makes fat-finger mistakes likely. Consider vertical stacking (Guessed on top, Skip below) rather than side by side.

### Screen 7: Post-Timer — Last Word Decision
- Timer at 0:00 (stopped)
- "Time's up!" header
- Current word still displayed
- "Did they get it?" subtext
- Team selector (if guessed): simple list of team names with colored dots — tap to award point
- SKIP button still present
- Undo still present

### Screen 8: Post-Turn Summary
- "Your team guessed 4 words this turn 🎉" (or 0 if nothing)
- Simple word list: words guessed this turn
- Next up: "Team B's turn — Pavel explains"
- Continue button (primary)

### Screen 9: Round End
- "Round 1 complete"
- Score summary: team scores side by side with color blocks
- "Round 2 starting — same words, different rules"
- Continue (admin triggers, others see loading state)

### Screen 10: Scoreboard (Final)
- "Game over" header
- Winning team highlighted (team color background)
- Score table: Team | R1 | R2 | R3 | Total
- Player stats below: Name | Words explained
- Admin only: "Play again" button

### Screen 11: Disconnect Overlay (modal over any game screen)
- Dimmed background
- "Waiting for [Name] to reconnect..."
- Spinner
- Admin only: "Reassign explainer" button

### Screen 12: Admin Header Controls (persistent, admin-only)
- Thin persistent bar or accessible via a settings icon
- Pause / Resume toggle
- "Change explainer" (only active when paused)

---

## Component Notes for Designer

- **Team color** appears as: left border stripe on cards, background tint on score blocks, color dot next to player names.
- **Player personal color** appears as: small filled circle (avatar) next to player name only.
- **Undo button** should never be accidentally triggered alongside Guessed/Skip. Visual separation (margin + different weight/style) is required.
- **Timer turning red** at 10 seconds is the only animation required. Avoid other animations — they distract.
- Screen 6 (active explaining) will be used under social pressure, likely one-handed. Prioritize thumb reach for all 3 action buttons.

---

## Deliverables Requested

1. Mobile frames (390px width / iPhone 14 proportions) for all 12 screens
2. One color theme demonstrated (can use a neutral team palette: blue + orange as example teams)
3. Component inventory: buttons (primary, secondary, destructive, disabled states), cards, score blocks, timer display, word display
4. Spacing and typography scale (used to implement in Tailwind)
