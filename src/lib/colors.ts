export const PLAYER_COLORS: readonly string[] = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#78716c", // warm gray
  "#84cc16", // lime
  "#14b8a6", // teal
  "#a855f7", // purple
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#d946ef", // fuchsia
]

export class PlayerLimitError extends Error {
  constructor() {
    super("Maximum number of players reached — all colors assigned")
    this.name = "PlayerLimitError"
  }
}

export function assignColor(usedColors: Set<string>): string {
  for (const color of PLAYER_COLORS) {
    if (!usedColors.has(color)) {
      return color
    }
  }
  throw new PlayerLimitError()
}
