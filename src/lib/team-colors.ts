/**
 * Team color mapping for design system.
 * Maps team ID to Tailwind CSS classes for border stripes, backgrounds, and text.
 */
const TEAM_COLOR_MAP: Record<
  string,
  {
    border: string
    bg: string
    text: string
    fixedBg: string
    fixedText: string
  }
> = {
  "team-1": {
    border: "border-secondary",
    bg: "bg-secondary",
    text: "text-secondary",
    fixedBg: "bg-secondary-fixed",
    fixedText: "text-on-secondary-fixed",
  },
  "team-2": {
    border: "border-on-tertiary-container",
    bg: "bg-on-tertiary-container",
    text: "text-on-tertiary-container",
    fixedBg: "bg-tertiary-fixed",
    fixedText: "text-on-tertiary-fixed",
  },
  "team-3": {
    border: "border-team-3",
    bg: "bg-team-3",
    text: "text-team-3",
    fixedBg: "bg-team-3-fixed",
    fixedText: "text-on-team-3-fixed",
  },
  "team-4": {
    border: "border-team-4",
    bg: "bg-team-4",
    text: "text-team-4",
    fixedBg: "bg-team-4-fixed",
    fixedText: "text-on-team-4-fixed",
  },
  "team-5": {
    border: "border-team-5",
    bg: "bg-team-5",
    text: "text-team-5",
    fixedBg: "bg-team-5-fixed",
    fixedText: "text-on-team-5-fixed",
  },
}

export interface TeamColorClasses {
  /** Border class for the team stripe (border-l-8) */
  stripe: string
  /** Background class for the active turn indicator bar */
  bar: string
  /** Background class for selected/active team card */
  activeBg: string
  /** Text class for active team */
  activeText: string
  /** Border class for active state */
  activeBorder: string
}

export function getTeamColorClasses(teamId: string): TeamColorClasses {
  const colors = TEAM_COLOR_MAP[teamId] ?? TEAM_COLOR_MAP["team-1"]!
  return {
    stripe: colors.border,
    bar: colors.bg,
    activeBg: colors.fixedBg,
    activeText: colors.fixedText,
    activeBorder: colors.border,
  }
}
