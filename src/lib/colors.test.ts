import { describe, it, expect } from "vitest"
import { assignColor, PLAYER_COLORS, PlayerLimitError } from "./colors"

describe("colors", () => {
  it("PLAYER_COLORS has at least 15 entries", () => {
    expect(PLAYER_COLORS.length).toBeGreaterThanOrEqual(15)
  })

  it("assignColor() returns a color not in usedColors", () => {
    const used = new Set<string>([PLAYER_COLORS[0], PLAYER_COLORS[1]])
    const color = assignColor(used)
    expect(color).toBeDefined()
    expect(used.has(color)).toBe(false)
    expect(PLAYER_COLORS.includes(color)).toBe(true)
  })

  it("assignColor() returns first unused color", () => {
    const used = new Set<string>([PLAYER_COLORS[0]])
    const color = assignColor(used)
    expect(color).toBe(PLAYER_COLORS[1])
  })

  it("assignColor() with full palette used throws PlayerLimitError", () => {
    const used = new Set<string>(PLAYER_COLORS)
    expect(() => assignColor(used)).toThrow(PlayerLimitError)
  })

  it("two sequential assignColor() calls return different colors", () => {
    const used = new Set<string>()
    const color1 = assignColor(used)
    used.add(color1)
    const color2 = assignColor(used)
    expect(color1).not.toBe(color2)
  })
})
