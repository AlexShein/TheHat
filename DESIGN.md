---
name: Hat Game Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#370e00'
  on-tertiary-container: '#e45405'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  container-padding: 24px
  gutter: 16px
---

## Brand & Style

This design system is built on the intersection of high-stakes social play and minimalist editorial design. The brand personality is **Human, Intellectual, and Energetic**. It avoids the cluttered tropes of traditional mobile gaming in favor of a "physical premium card game" aesthetic—clean white spaces, intentional voids, and surgically precise color application.

The emotional response should be one of clarity and focus during the heat of competition. By utilizing high-fidelity typography and a restricted palette, the UI disappears to let the social interaction and the "words in the hat" take center stage. The style is **High-Contrast Minimalism**, using bold weights and vibrant functional colors to guide the eye without decorative noise.

## Colors

The color strategy uses a monochrome foundation to ensure the team and player colors carry maximum functional weight. 

- **Team Identity:** Team A is defined by a high-definition Blue, while Team B utilizes a vibrant Orange. These are used for "Team Stripes" (thick 8px vertical borders on cards) and score highlights.
- **Player Avatars:** A secondary palette of six distinct, high-saturation colors is reserved for individual player identification, ensuring no overlap with team branding.
- **Active Indicators:** Turn indicators use a "pulse" of the respective team color. 
- **High Contrast:** Text is strictly pure black on white or tinted surfaces to maintain AAA accessibility and a modern editorial feel.

## Typography

Typography is the primary vehicle for the "modern" aesthetic of this design system. 

- **Epilogue** is used for all headlines and brand moments. Its geometric yet slightly quirky construction provides the "Human" element. Heavy weights (700+) are preferred for score displays and active words.
- **Be Vietnam Pro** handles all functional body text and player lists. It is contemporary and highly legible at small sizes on mobile screens.
- **Hierarchy:** Use extreme scale differences. The "Word to Guess" should be significantly larger than any other element on the screen to maintain focus during fast-paced play.

## Layout & Spacing

This design system employs a **Fluid Grid** model centered on an 8px base unit. 

- **Vertical Rhythm:** Generous whitespace (the "Lg" and "Xl" units) is used to separate the "Action Zone" (the word being guessed) from the "Status Zone" (score and timer).
- **Margins:** A standard 24px side margin ensures content feels safe and centered. 
- **Team Stripes:** Layout elements like player lists or team cards feature a mandatory 8px solid color stripe on the leading edge (left) to denote team affiliation instantly.

## Elevation & Depth

To maintain a minimalist and modern profile, this design system avoids traditional drop shadows. Depth is communicated through **Tonal Layers and Low-Contrast Outlines**.

- **Surface Tiers:** The base background is white. Secondary information resides on "Surface" containers—subtle grey (#F8FAFC) or very light team-tints (10% opacity of the team color).
- **Ghost Borders:** Cards and containers use a 1px solid border (#E2E8F0). When a card is "Active" (e.g., the current player's turn), the border thickness increases to 2px and takes the player's or team's specific color.
- **Glassmorphism:** Use a heavy backdrop blur (20px) on modal overlays to keep the game state visible but obscured, maintaining the sense of a single-page continuous flow.

## Shapes

The shape language is **Rounded**, creating a friendly and tactile feel that balances the sharp typography.

- **Standard Containers:** Use 0.5rem (8px) for buttons and small cards.
- **Hero Cards:** The main word-guessing card uses 1.5rem (24px) for a distinct, physical appearance.
- **Avatars:** Player avatars are always perfect circles to contrast against the predominantly rectangular grid.
- **Interactive States:** Buttons should feel "squishy"—a subtle scale-down effect (0.98) on tap is more effective than a shadow change.

## Components

- **Primary Button:** Solid black background with white Epilogue text. High contrast, no icons unless necessary for navigation.
- **Team Score Highlight:** A large Epilogue number paired with a vertical Team Stripe. The background of the score container should be the team's Surface Tint.
- **Active Turn Indicator:** A 4px glowing bar at the top of the screen in the current Team's color, acting as a progress bar for the timer.
- **Player Chips:** Small, pill-shaped containers with the player's name and a circular avatar in their assigned Player Color.
- **The "Hat" Card:** A central, large-format card with a 24px radius and a 2px border. This is the only element allowed to use the "Display" type size.
- **Status Badges:** Use the `label-caps` typography style for status like "READY" or "WAITING," encased in a pill-shape with a 1px border.